'use client';

/**
 * StickyActionBar — canonical bottom action footer for long forms in the seller portal.
 *
 * The bar sticks to the bottom of the parent scroll container. Negative margins (`-mx-*`
 * and `-mb-*`) cancel the standard DashboardLayout `<main>` padding so it extends
 * edge-to-edge with the viewport and sits flush against the bottom (no gap below).
 *
 * Usage:
 *   <StickyActionBar>
 *     <SaveStatus ... />                          // left slot — status / secondary info
 *     <button>Publish</button>                    // right slot — primary action
 *   </StickyActionBar>
 *
 * The component uses `justify-between` so the first child anchors left and the last
 * child anchors right. For multiple actions, wrap them in a flex container:
 *
 *   <StickyActionBar>
 *     <SaveStatus ... />
 *     <div className="flex items-center gap-2">
 *       <button>Cancel</button>
 *       <button>Publish</button>
 *     </div>
 *   </StickyActionBar>
 *
 * Assumes the parent <main> uses `p-4 md:p-6` padding (the DashboardLayout default).
 * If you need to use this outside DashboardLayout, pass a `className` that overrides
 * the negative margins.
 */
export default function StickyActionBar({ children, className = '' }) {
  return (
    <div
      className={`sticky bottom-0 -mb-4 md:-mb-6 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white/95 backdrop-blur border-t border-[#E8E8E4] shadow-[0_-2px_8px_rgba(0,0,0,0.04)] flex items-center justify-between gap-3 z-10 ${className}`}
    >
      {children}
    </div>
  );
}
