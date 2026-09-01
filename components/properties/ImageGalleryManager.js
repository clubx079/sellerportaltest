"use client";

import { useState, useEffect, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Star, Loader } from 'lucide-react';
import imageCompression from 'browser-image-compression';

const MAX_CONCURRENT_UPLOADS = 15;

const ALLOWED_PHOTO_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
const checkHeic = f => f.type === 'image/heic' || f.type === 'image/heif' || /\.(heic|heif)$/i.test(f.name)
const isPhoto = f => ALLOWED_PHOTO_TYPES.includes(f.type) || checkHeic(f)
// A file genuinely needs HEIC→JPEG conversion only when its CONTENT is HEIC. Browsers
// that pre-transcode iPhone photos hand us a readable JPEG (sometimes still named .heic) —
// those must NOT go through heic2any (it throws "already browser readable").
const isReadableImageType = f => /^image\/(jpe?g|png|webp|gif)$/i.test(f.type)
const needsHeicConvert = f => f.type === 'image/heic' || f.type === 'image/heif' || (/\.(heic|heif)$/i.test(f.name) && !isReadableImageType(f))

// Server-side HEIC→JPEG fallback (heic-convert via /api/convert-heic) for the HEIC
// variants the browser's heic2any can't decode. Returns a JPEG File, or throws.
async function serverConvertHeic(file) {
  const fd = new FormData()
  fd.append('file', file, file.name || 'image.heic')
  const res = await fetch('/api/convert-heic', { method: 'POST', body: fd })
  if (!res.ok) throw new Error(`server HEIC convert failed (${res.status})`)
  const blob = await res.blob()
  if (!blob?.size) throw new Error('server HEIC convert returned empty')
  return new File([blob], (file.name || 'image').replace(/\.(heic|heif)$/i, '') + '.jpg', { type: 'image/jpeg' })
}
// Sniff the first bytes for a browser-viewable image format → returns its MIME, else null.
// Used as a last resort so a readable JPEG/PNG that merely carries a .heic name (some
// browsers pre-transcode) still uploads, while genuinely-HEIC bytes are rejected.
async function sniffViewable(file) {
  try {
    const b = new Uint8Array(await file.slice(0, 4).arrayBuffer())
    const hex = [...b].map(x => x.toString(16).padStart(2, '0')).join('')
    if (hex.startsWith('ffd8ff')) return 'image/jpeg'
    if (hex.startsWith('89504e47')) return 'image/png'
    if (hex.startsWith('52494646')) return 'image/webp'
    if (hex.startsWith('47494638')) return 'image/gif'
  } catch { /* ignore */ }
  return null
}

export default function ImageGalleryManager({ images = [], onImagesChange, sellerId, storageBucket = 'sellerpropertyimages', uploadPathPrefix = null }) {
  const [localImages, setLocalImages] = useState(images);
  const [dragActive, setDragActive] = useState(false);
  const [uploadError, setUploadError] = useState(null);

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

      // Convert HEIC → JPEG in the BROWSER (heic2any), but ONLY when the file is truly
      // HEIC. iOS Safari (and some Chrome builds) already transcode an iPhone photo to
      // JPEG at selection time while keeping the original `IMG_1234.HEIC` name — so the
      // File is image/jpeg but named .heic. Feeding that to heic2any throws
      // "ERR_USER Image is already browser readable", which failed uploads for those
      // users. We now detect real HEIC by content-type first (falling back to the name
      // only when the type is missing/unreadable), and wrap the conversion so that any
      // "already readable" file just uploads as-is with a normalized .jpg name.
      let uploadFile = image.file
      const nameIsHeic = /\.(heic|heif)$/i.test(image.file.name)
      const typeIsHeic = image.file.type === 'image/heic' || image.file.type === 'image/heif'
      const typeIsReadable = /^image\/(jpe?g|png|webp|gif)$/i.test(image.file.type)
      const renameToJpg = () => new File([image.file], image.file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: image.file.type || 'image/jpeg' })

      if (typeIsHeic || (nameIsHeic && !typeIsReadable)) {
        // Tier 1 — convert in the browser (fast, no upload round-trip).
        try {
          const heic2any = (await import('heic2any')).default
          const converted = await heic2any({ blob: image.file, toType: 'image/jpeg', quality: 0.85 })
          const jpegBlob = Array.isArray(converted) ? converted[0] : converted
          uploadFile = new File([jpegBlob], image.file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' })
        } catch (err) {
          // Tier 2 — heic2any couldn't decode it (common when the browser reports an
          // empty MIME type for .heic, e.g. Windows Chrome). Try the server converter
          // (heic-convert), which handles variants heic2any chokes on. We must NEVER
          // fall back to uploading the raw HEIC bytes — that produced "completed" but
          // unrenderable (broken) tiles.
          console.warn('heic2any failed, trying server convert:', err?.message || err)
          try {
            uploadFile = await serverConvertHeic(image.file)
          } catch (err2) {
            // Neither converter could read it. If the bytes are actually a browser-
            // viewable image that merely carries a .heic name, upload with the real type;
            // otherwise surface an error instead of storing bytes the browser can't show.
            const viewable = await sniffViewable(image.file)
            if (viewable) {
              uploadFile = new File([image.file], image.file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: viewable })
            } else {
              throw new Error('Could not convert this HEIC photo — please re-save it as JPEG and upload again.')
            }
          }
        }
      } else if (nameIsHeic && typeIsReadable) {
        // Browser already gave us a readable JPEG that just carries a .HEIC name.
        uploadFile = renameToJpg()
      }

      // Compress image
      console.log('Compressing image...');
      const compressedFile = await compressImage(uploadFile);
      console.log('Compression complete');

      // Generate unique filename (sellerId may be undefined for scraped until loaded; use fallback)
      const uploadDir = sellerId != null && String(sellerId).trim() ? String(sellerId) : 'deals';
      const fileExt = (uploadFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, 'jpg');
      const pathSegment = uploadPathPrefix ? `${uploadPathPrefix}/${uploadDir}` : uploadDir;
      const fileName = `${pathSegment}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      // Upload to Backblaze B2 via the seller-portal server route. Returns the stable
      // /api/img URL (served by the Cloudflare signing endpoint) that the buyer + seller
      // portals use to display the image. Replaces the old broken Supabase-Storage upload.
      console.log('Uploading to B2:', fileName);
      const fd = new FormData();
      fd.append('file', compressedFile ?? uploadFile, fileName.split('/').pop());
      fd.append('key', fileName);
      const res = await fetch('/api/seller/upload', { method: 'POST', body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error(json.error || 'Upload failed');
      console.log('Upload successful');
      const publicUrl = json.url;

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
    setUploadError(null);

    const imageFiles = fileArray.filter(file => isPhoto(file));
    const rejectedFiles = fileArray.filter(file => !isPhoto(file));

    if (rejectedFiles.length > 0) {
      const names = rejectedFiles.map(f => f.name).join(', ');
      setUploadError(`Only property photos are allowed (JPEG, PNG, WebP). Rejected: ${names}`);
    }

    if (imageFiles.length === 0) return;

    // Create temp image objects with queued status
    const newImages = imageFiles.map((file, index) => ({
      id: `temp-${Date.now()}-${Math.random()}-${index}`,
      file,
      preview: needsHeicConvert(file) ? null : URL.createObjectURL(file),
      status: 'queued',
      progress: 0,
      originalSize: file.size,
      converting: needsHeicConvert(file)
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
    // If image was uploaded to B2, delete it via the server route.
    if (imageKey) {
      try {
        await fetch('/api/seller/upload', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: imageKey }),
        });
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
      {uploadError && (
        <div className="flex items-start gap-2 p-3 bg-[#FEF0EF] border border-[#F5C4C0] rounded text-[13px] text-[#D03839]">
          <span className="flex-1">{uploadError}</span>
          <button type="button" onClick={() => setUploadError(null)} className="flex-shrink-0 text-[#D03839] hover:text-[#B02020]"><X size={14} /></button>
        </div>
      )}
      {/* Upload Area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded p-8 text-center transition-all ${
          dragActive
            ? 'border-[#D03839] bg-[#FEF0EF]'
            : 'border-neutral-300 hover:border-neutral-400'
        }`}
      >
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded flex items-center justify-center mb-4 bg-[#D03839]">
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
              ? `Processing ${totalUploading} image${totalUploading > 1 ? 's' : ''}...`
              : 'Click to select or drag and drop multiple images'}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            Images optimized & uploaded up to {MAX_CONCURRENT_UPLOADS} at a time
          </p>
          <input
            type="file"
            id="image-upload"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp,.heic,.heif"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
            disabled={totalUploading > 0}
          />
          <label
            htmlFor="image-upload"
            className={`inline-flex items-center gap-2 px-4 py-2 bg-[#D03839] hover:bg-[#E0493B] text-white rounded text-sm font-medium transition-colors cursor-pointer ${
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
        <div className="flex items-center justify-between text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 rounded p-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              {totalUploading > 0 ? (
                <Loader size={14} className="text-[#D03839] animate-spin" />
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
              className="relative group bg-neutral-100 rounded overflow-hidden aspect-square transition-all duration-300"
            >
              {/* Image Preview */}
              {image.status === 'queued' || image.status === 'uploading' ? (
                <div className="w-full h-full relative group">
                  {image.preview && <img
                    src={image.preview}
                    alt={`Preview ${index + 1}`}
                    className="w-full h-full object-cover opacity-50"
                  />}
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
                      className="p-1.5 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
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
                    <p className="text-xs text-red-600 mb-2 px-1">{image.error || 'Upload failed'}</p>
                    <button
                      onClick={() => handleRetry(image.id)}
                      className="px-3 py-1.5 bg-[#D03839] hover:bg-[#E0493B] text-white text-xs rounded transition-colors"
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
                      className={`p-2 rounded transition-colors ${
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
                      className="p-2 bg-red-500 hover:bg-red-600 text-white rounded transition-colors"
                      title="Remove"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {/* Featured Badge */}
                  {image.isFeatured && (
                    <div className="absolute top-2 left-2 px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded flex items-center gap-1">
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

