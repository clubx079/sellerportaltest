import { X, AlertCircle, Archive, Trash2 } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, isPermanent = false }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full p-6 z-10">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon */}
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
            isPermanent ? 'bg-red-100' : 'bg-yellow-100'
          }`}>
            {isPermanent ? (
              <Trash2 className="w-6 h-6 text-red-600" />
            ) : (
              <Archive className="w-6 h-6 text-yellow-600" />
            )}
          </div>

          {/* Content */}
          <h3 className="text-lg font-semibold text-neutral-900 mb-2">
            {isPermanent ? 'Delete Permanently' : 'Archive Property'}
          </h3>
          <p className="text-sm text-neutral-600 mb-6">
            {isPermanent ? (
              <>
                Are you sure you want to permanently delete <span className="font-semibold">{itemName}</span>? This action cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to archive <span className="font-semibold">{itemName}</span>? You can restore it later from the trash.
              </>
            )}
          </p>

          {/* Warning */}
          {isPermanent && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-6">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">
                This will permanently delete the property and all associated images. This action cannot be undone.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 px-4 py-2 ${
                isPermanent
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-yellow-600 hover:bg-yellow-700'
              } text-white rounded-lg text-sm font-medium transition-colors`}
            >
              {isPermanent ? 'Delete' : 'Archive'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
