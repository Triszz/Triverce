import { useEffect, useRef, useState, type MouseEvent } from 'react';

/* ──────────────────────────────────────────────────────────────────────────
 * ZoomableLightbox — full-screen, frosted-glass image viewer with
 * scroll-to-zoom + drag-pan + Escape-to-close.
 *
 * Originally built for EditCartItemModal; promoted to the shared UI
 * folder so the Product Detail Page can reuse the same premium zoom
 * experience. Mount it conditionally at the call site
 * (`{isOpen && <ZoomableLightbox ... />}`); the key on the JSX
 * remounts the component each time `isOpen` flips, which resets
 * scale/position state without needing a separate effect.
 *
 * Scroll isolation:
 *   • While `open` is true, the document body is pinned via
 *     `document.body.style.overflow = 'hidden'`. The previous value
 *     is captured on mount and restored on unmount/close so we don't
 *     clobber a sibling layer that may have already locked the body.
 *   • The wheel handler is attached as a native listener with
 *     `{ passive: false }` on the backdrop element. React's synthetic
 *     `onWheel` is delivered as a passive listener in modern browsers,
 *     so `preventDefault()` inside it is silently ignored and the
 *     page underneath still scrolls. A native non-passive listener is
 *     the only reliable way to prevent the default page scroll.
 * ──────────────────────────────────────────────────────────────────────── */

interface ZoomableLightboxProps {
  src: string;
  alt: string;
  open: boolean;
  onClose: () => void;
}

const clampScale = (next: number) => Math.min(Math.max(1, next), 5);

export const ZoomableLightbox = ({ src, alt, open, onClose }: ZoomableLightboxProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // Backdrop element ref. The native non-passive wheel listener is
  // attached to this node so `preventDefault()` actually prevents
  // the underlying page from scrolling when the user wheels on the
  // lightbox.
  const backdropRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape. Capture the event so the parent `<Modal>`'s
  // own keydown handler (mounted elsewhere in the tree) doesn't
  // also see the Escape and close the modal underneath the lightbox.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while the lightbox is open. We capture the
  // current `overflow` value on mount and restore it on cleanup so
  // we don't blow away a value another layer (e.g. a sticky mobile
  // nav) may have already set. Guarded by `open` so the lock is
  // released when the lightbox is closed but still mounted.
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  // Native wheel listener on the backdrop. React's synthetic
  // `onWheel` is delivered as a passive listener in modern browsers,
  // so `e.preventDefault()` inside it is silently ignored and the
  // page underneath still scrolls as the user wheels. Attaching the
  // listener natively with `{ passive: false }` makes
  // `preventDefault()` actually work, isolating the zoom from the
  // rest of the page.
  useEffect(() => {
    if (!open) return;
    const el = backdropRef.current;
    if (!el) return;
    const handleWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      // Wheel up zooms in, wheel down zooms out. Each notch ≈ ±0.25x.
      const delta = e.deltaY > 0 ? -0.25 : 0.25;
      setScale((prev) => clampScale(prev + delta));
    };
    el.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => el.removeEventListener('wheel', handleWheelNative);
  }, [open]);

  if (!open) return null;

  const handleMouseDown = (e: MouseEvent<HTMLImageElement>) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging || scale <= 1) return;
    setPosition((prev) => ({
      x: prev.x + e.movementX,
      y: prev.y + e.movementY,
    }));
  };

  const endDrag = () => setIsDragging(false);

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-modal="true"
      aria-label="Zoomed product image"
      className="fixed inset-0 z-[100] bg-white/70 backdrop-blur-xl flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onClick={(e) => {
        // Click on backdrop closes; image clicks are reserved for drag-to-pan.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close zoom"
        className="absolute top-4 right-4 z-10 h-10 w-10 rounded-full bg-slate-900/5 hover:bg-slate-200/60 text-slate-700 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>

      {/* Clip overflow so a zoomed-in image never escapes the viewport edges. */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden p-8">
        <img
          src={src}
          alt={alt}
          draggable={false}
          onMouseDown={handleMouseDown}
          onClick={(e) => e.stopPropagation()}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 200ms ease-out',
          }}
          className={
            'max-h-full max-w-full object-contain select-none ' +
            (isDragging
              ? 'cursor-grabbing'
              : scale > 1
                ? 'cursor-grab'
                : 'cursor-zoom-in')
          }
        />
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-slate-700 bg-white/60 border border-slate-200/80 px-3 py-1.5 rounded-full pointer-events-none shadow-sm">
        Scroll to zoom · Drag to pan · Esc to close
      </div>
    </div>
  );
};
