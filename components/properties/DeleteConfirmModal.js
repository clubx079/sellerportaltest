export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, isPermanent = false }) {
  if (!isOpen) return null;

  const title = isPermanent ? 'Delete permanently' : 'Move to trash';
  const question = isPermanent
    ? 'Permanently delete this property?'
    : 'Move this property to trash?';
  const supportingText = isPermanent
    ? 'This cannot be undone.'
    : 'You can restore it later from the trash view.';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-900/40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative bg-white rounded shadow-lg border border-gray-200 max-w-md w-full p-6 z-10">
          <h3 className="text-base font-semibold text-gray-900 tracking-tight mb-4">
            {title}
          </h3>

          <p className="text-sm text-gray-700 mb-3">
            {question}
          </p>

          <div className="py-2.5 px-3 mb-4 bg-gray-50 border border-gray-100 rounded">
            <p className="text-sm text-gray-800 font-medium break-words" title={itemName}>
              {itemName}
            </p>
          </div>

          <p className="text-sm text-gray-500 mb-6">
            {supportingText}
          </p>

          {isPermanent && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded mb-6">
              <p className="text-xs text-gray-600 leading-relaxed">
                The property and all associated images will be permanently removed.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary hover:bg-primary-600 rounded transition-colors"
            >
              {isPermanent ? 'Delete' : 'Move to trash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
