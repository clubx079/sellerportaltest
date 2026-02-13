"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, X, Image as ImageIcon, Star, Loader } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const MAX_CONCURRENT_UPLOADS = 4;

export default function ImageGalleryManager({ images = [], onImagesChange, sellerId }) {
  const [localImages, setLocalImages] = useState(images);
  const [dragActive, setDragActive] = useState(false);

  const inFlightIdsRef = useRef(new Set());
  const imagesRef = useRef(localImages);

  useEffect(() => {
    imagesRef.current = localImages;
  }, [localImages]);

  useEffect(() => {
    setLocalImages(images);
  }, [images]);

  // Notify parent of changes (debounced to prevent excessive re-renders)
  const notifyTimeoutRef = useRef(null);
  useEffect(() => {
    if (onImagesChange) {
      // Clear existing timeout
      if (notifyTimeoutRef.current) {
        clearTimeout(notifyTimeoutRef.current);
      }

      // Debounce the notification
      notifyTimeoutRef.current = setTimeout(() => {
        const queuedCount = localImages.filter(img => img.status === 'queued').length;
        const uploadingCount = localImages.filter(img => img.status === 'uploading').length;

        onImagesChange({
          images: localImages,
          isUploading: queuedCount > 0 || uploadingCount > 0,
          uploadingCount: queuedCount + uploadingCount
        });
      }, 100);
    }

    return () => {
      if (notifyTimeoutRef.current) {
        clearTimeout(notifyTimeoutRef.current);
      }
    };
  }, [localImages, onImagesChange]);

  async function startUpload(image) {
    if (inFlightIdsRef.current.has(image.id)) return;
    inFlightIdsRef.current.add(image.id);

    try {
      // Update status to uploading
      setLocalImages(prev => prev.map(img =>
        img.id === image.id ? { ...img, status: 'uploading' } : img
      ));

      // Wait a frame for state to update
      await new Promise(resolve => setTimeout(resolve, 10));

      // Compress image
      console.log('Compressing image...');
      const compressedFile = await compressImage(image.file);
      console.log('Compression complete');

      // Generate unique filename
      const fileExt = image.file.name.split('.').pop();
      const fileName = `${sellerId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Supabase
      console.log('Uploading to Supabase:', fileName);
      const { data, error } = await supabase.storage
        .from('sellerpropertyimages')
        .upload(fileName, compressedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;
      console.log('Upload successful');

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('sellerpropertyimages')
        .getPublicUrl(fileName);

      // Update local images with completed status
      setLocalImages(prev => prev.map(img =>
        img.id === image.id
          ? { ...img, status: 'completed', imageUrl: publicUrl, imageKey: fileName, file: null }
          : img
      ));

      console.log('Image processing complete:', image.id);

    } catch (error) {
      console.error('Upload error:', error);
      setLocalImages(prev => prev.map(img =>
        img.id === image.id
          ? { ...img, status: 'error', error: error.message }
          : img
      ));
    } finally {
      inFlightIdsRef.current.delete(image.id);
      // Continue processing queued images
      const stillHasQueued = imagesRef.current.some(img => img.status === 'queued');
      if (stillHasQueued) {
        scheduleUploads();
      }
    }
  }

  function scheduleUploads() {
    const currentImages = imagesRef.current;
    const availableSlots = MAX_CONCURRENT_UPLOADS - inFlightIdsRef.current.size;
    if (availableSlots <= 0) return;

    const queuedImages = currentImages.filter(
      img => img.status === 'queued' && !inFlightIdsRef.current.has(img.id)
    );

    queuedImages.slice(0, availableSlots).forEach((img) => {
      startUpload(img);
    });
  }

  // Auto-process queued images
  useEffect(() => {
    const hasQueued = localImages.some(img => img.status === 'queued');
    if (hasQueued) {
      const timer = setTimeout(() => scheduleUploads(), 50);
      return () => clearTimeout(timer);
    }
  }, [localImages]);

  const compressImage = async (file) => {
    const options = {
      maxSizeMB: 0.8,
      maxWidthOrHeight: 1920,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.85
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.error('Image compression error:', error);
      return file;
    }
  };

  const handleFileSelect = async (files) => {
    const fileArray = Array.from(files);

    // Filter only image files
    const imageFiles = fileArray.filter(file =>
      file.type.startsWith('image/')
    );

    if (imageFiles.length === 0) return;

    // Create temp image objects with queued status
    const newImages = imageFiles.map((file, index) => ({
      id: `temp-${Date.now()}-${Math.random()}-${index}`,
      file,
      preview: URL.createObjectURL(file),
      status: 'queued',
      progress: 0,
      originalSize: file.size
    }));

    setLocalImages(prev => [...prev, ...newImages]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleRemove = async (imageId, imageKey) => {
    // If image is uploaded to Supabase, delete it
    if (imageKey) {
      try {
        await supabase.storage
          .from('sellerpropertyimages')
          .remove([imageKey]);
      } catch (error) {
        console.error('Failed to delete image from storage:', error);
      }
    }

    // Revoke blob URL
    const img = localImages.find(i => i.id === imageId);
    if (img?.preview?.startsWith('blob:')) {
      URL.revokeObjectURL(img.preview);
    }

    // Remove from local state
    setLocalImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSetFeatured = (imageId) => {
    setLocalImages(prev => {
      const isAlreadyFeatured = prev.find(img => img.id === imageId)?.isFeatured;
      if (isAlreadyFeatured) {
        return prev.map(img => ({ ...img, isFeatured: false }));
      }
      return prev.map(img => ({
        ...img,
        isFeatured: img.id === imageId
      }));
    });
  };

  const handleRetry = (imageId) => {
    // Reset stuck image to queued status to retry upload
    setLocalImages(prev => prev.map(img =>
      img.id === imageId ? { ...img, status: 'queued', error: null } : img
    ));
  };

  const queuedCount = localImages.filter(img => img.status === 'queued').length;
  const uploadingCount = localImages.filter(img => img.status === 'uploading').length;
  const completedCount = localImages.filter(img => img.status === 'completed').length;
  const totalUploading = queuedCount + uploadingCount;

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
          dragActive
            ? 'border-[#472F97] bg-[#F5F3FF]'
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-4 bg-[#472F97]">
            {totalUploading > 0 ? (
              <Loader className="w-8 h-8 text-white animate-spin" />
            ) : (
              <Upload className="w-8 h-8 text-white" />
            )}
          </div>
          <p className="text-base font-semibold text-neutral-900 mb-2">
            {totalUploading > 0
              ? `Uploading ${totalUploading} image${totalUploading > 1 ? 's' : ''}...`
              : 'Upload Property Images'}
          </p>
          <p className="text-sm text-neutral-600 mb-1">
            {totalUploading > 0
              ? `Processing ${uploadingCount} • ${queuedCount} in queue`
              : 'Click to select or drag and drop multiple images'}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            Images optimized & uploaded up to {MAX_CONCURRENT_UPLOADS} at a time
          </p>
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={totalUploading > 0}
          />
          <label
            htmlFor="image-upload"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-[#472F97] hover:bg-[#3a2578] text-white rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              totalUploading > 0 ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Upload size={16} />
            Choose Images
          </label>
        </div>
      </div>

      {/* Stats Bar */}
      {localImages.length > 0 && (
        <div className="flex items-center justify-between text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-xl p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {totalUploading > 0 ? (
                <Loader size={14} className="text-[#472F97] animate-spin" />
              ) : (
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              )}
              <span className="font-semibold text-neutral-900">{localImages.length} Total</span>
            </div>
            {uploadingCount > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                Uploading: {uploadingCount}
              </span>
            )}
            {queuedCount > 0 && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                Queue: {queuedCount}
              </span>
            )}
            {completedCount > 0 && (
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                Completed: {completedCount}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Image Grid */}
      {localImages.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {localImages.map((image, index) => (
            <div
              key={image.id}
              className="relative group bg-neutral-100 rounded-xl overflow-hidden aspect-square transition-all duration-300"
            >
              {/* Image Preview */}
              {image.status === 'queued' || image.status === 'uploading' ? (
                <div className="w-full h-full relative group">
                  <img
                    src={image.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="text-center">
                      <Loader className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                      <p className="text-xs text-white font-medium">
                        {image.status === 'queued' ? 'Queued...' : 'Uploading...'}
                      </p>
                    </div>
                  </div>
                  {/* Retry/Cancel button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleRemove(image.id, null)}
                      className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Cancel upload"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : image.status === 'error' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-red-50">
                  <img
                    src={image.preview}
                    alt={`Failed ${index + 1}`}
                    className="w-full h-full object-cover opacity-20 absolute inset-0"
                  />
                  <div className="text-center p-4 relative z-10">
                    <X className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-xs text-red-600 mb-2">Upload failed</p>
                    <button
                      onClick={() => handleRetry(image.id)}
                      className="px-3 py-1.5 bg-[#472F97] hover:bg-[#3a2578] text-white text-xs rounded-lg transition-colors"
                    >
                      Retry Upload
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src={image.imageUrl || image.preview}
                    alt={`Property image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />

                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleSetFeatured(image.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        image.isFeatured
                          ? 'bg-yellow-500 text-white'
                          : 'bg-white text-neutral-700 hover:bg-yellow-500 hover:text-white'
                      }`}
                      title="Set as featured"
                    >
                      <Star size={16} fill={image.isFeatured ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={() => handleRemove(image.id, image.imageKey)}
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Featured Badge */}
                  {image.isFeatured && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded-lg flex items-center gap-1">
                      <Star size={12} fill="currentColor" />
                      Featured
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

