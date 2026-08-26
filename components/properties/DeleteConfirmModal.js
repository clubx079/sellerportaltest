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
          className="fixed inset-0 bg-ink/40 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        <div className="relative bg-white rounded-[14px] border-[1.5px] border-ink shadow-offset-6 max-w-md w-full p-6 z-10">
          <h3 className="font-display text-[16.5px] font-semibold tracking-[-0.01em] text-body mb-4">
            {title}
          </h3>

          <p className="text-sm text-smoke-2 mb-3">
            {question}
          </p>

          <div className="py-2.5 px-3 mb-4 bg-tint-3 border border-hairline-2 rounded-[10px]">
            <p className="text-sm text-body font-medium break-words" title={itemName}>
              {itemName}
            </p>
          </div>

          <p className="text-sm text-muted mb-6">
            {supportingText}
          </p>

          {isPermanent && (
            <div className="p-3 bg-tint border-[1.5px] border-ink rounded-[10px] mb-6">
              <p className="text-xs font-semibold text-ink leading-relaxed">
                The property and all associated images will be permanently removed.
              </p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-ink bg-white hover:bg-tint border-[1.5px] border-ink rounded-[10px] shadow-offset-3 transition-all duration-120"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-ink hover:bg-smoke-2 border-[1.5px] border-ink rounded-[10px] shadow-soft-3 transition-all duration-120"
            >
              {isPermanent ? 'Delete' : 'Move to trash'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
