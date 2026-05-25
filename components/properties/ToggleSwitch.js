'use client';

/**
 * ToggleSwitch — binary on/off control for actions that only have two states.
 *
 * Use this instead of a <select> with two options. The visual makes it clear
 * to users that there are two possible states, not a list to choose from.
 *
 * Props:
 *   value     boolean   — current state (true = on, false = off)
 *   onChange  (next: boolean) => void
 *   disabled  boolean   — disables clicks; visual is dimmed
 *   label     string    — accessible aria-label
 *   onLabel   string    — text shown when value is true (default 'On')
 *   offLabel  string    — text shown when value is false (default 'Off')
 *   size      'sm'|'md' — 'sm' for tight rows, 'md' default
 *
 * Usage:
 *   <ToggleSwitch
 *     value={listing.status === 'active'}
 *     onChange={(next) => setStatus(next ? 'active' : 'inactive')}
 *     label="Listing visible to buyers"
 *     onLabel="Active"
 *     offLabel="Inactive"
 *     size="sm"
 *   />
 */
export default function ToggleSwitch({
  value,
  onChange,
  disabled = false,
  label,
  onLabel = 'On',
  offLabel = 'Off',
  size = 'md',
}) {
  const dims = size === 'sm'
    ? { track: 'w-7 h-4', knob: 'w-3 h-3', translate: 'translate-x-3' }
    : { track: 'w-9 h-5', knob: 'w-4 h-4', translate: 'translate-x-4' };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`inline-flex items-center gap-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`relative inline-flex items-center ${dims.track} rounded-full transition-colors ${value ? 'bg-[#0F6E56]' : 'bg-[#D4D4CF]'}`}>
        <span className={`absolute left-0.5 ${dims.knob} bg-white rounded-full shadow-sm transition-transform ${value ? dims.translate : 'translate-x-0'}`} />
      </span>
      <span className={`text-[12px] font-medium ${value ? 'text-[#0F6E56]' : 'text-[#737370]'}`}>
        {value ? onLabel : offLabel}
      </span>
    </button>
  );
}
