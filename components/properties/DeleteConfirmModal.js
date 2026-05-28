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
          className="fixed inset-0 bg-[#1A1816]/40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative bg-white rounded shadow-lg border border-[#E8E8E4] max-w-md w-full p-6 z-10">
          <h3 className="text-base font-semibold text-[#1A1816] tracking-tight mb-4">
            {title}
          </h3>

          <p className="text-sm text-[#444441] mb-3">
            {question}
          </p>

          <div className="py-2.5 px-3 mb-4 bg-[#FAFAF8] border border-[#F0F0EC] rounded">
            <p className="text-sm text-[#1A1816] font-medium break-words" title={itemName}>
              {itemName}
            </p>
          </div>

          <p className="text-sm text-[#737370] mb-6">
            {supportingText}
          </p>

          {isPermanent && (
            <div className="p-3 bg-[#FAFAF8] border border-[#E8E8E4] rounded mb-6">
              <p className="text-xs text-[#737370] leading-relaxed">
                The property and all associated images will be permanently removed.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-[#444441] bg-[#FAFAF8] hover:bg-[#F0F0EC] border border-[#E8E8E4] rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-[#D03839] hover:bg-[#E0493B] rounded transition-colors"
            >
              {isPermanent ? 'Delete' : 'Move to trash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
