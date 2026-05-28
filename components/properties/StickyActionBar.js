'use client';

/**
 * StickyActionBar — canonical bottom action footer for long forms in the seller portal.
 *
 * The bar sticks to the bottom of the parent scroll container. Negative offsets cancel
 * the standard DashboardLayout `<main>` padding so it extends edge-to-edge with the
 * viewport (no gap below).
 *
 * Why negative `bottom` (not negative `mb`):
 *   - `position: sticky` anchors to the scrollport, which is INSIDE the parent's padding.
 *     `margin-bottom: -1.5rem` doesn't push the element past that anchor.
 *   - A negative `bottom` value (`-bottom-6`) sticks the element 24px below the inner
 *     edge — i.e. into the padding region — so it ends flush with the viewport edge.
 *
 * Usage:
 *   <StickyActionBar>
 *     <SaveStatus ... />
 *     <button>Publish</button>
 *   </StickyActionBar>
 *
 * Assumes the parent <main> uses `p-4 md:p-6` (the DashboardLayout default).
 * If using elsewhere, override via `className`.
 */
export default function StickyActionBar({ children, className = '' }) {
  return (
    <div
      className={`sticky -bottom-4 md:-bottom-6 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-white/95 backdrop-blur border-t border-[#E8E8E4] shadow-[0_-2px_8px_rgba(0,0,0,0.04)] flex items-center justify-between gap-3 z-10 ${className}`}
    >
      {children}
    </div>
  );
}
