import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { PriceTag } from '@/components/ui/PriceTag';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Skeleton } from '@/components/ui/Skeleton';
import { ZoomableLightbox } from '@/components/ui/ZoomableLightbox';
import { VariantPicker } from '@/features/catalog/components/VariantPicker';
import { buildAttributeAxes } from '@/features/catalog/components/variantUtils';
import { productService, type ProductVariant } from '@/services/productService';
import { cartService, type CartItemPublic } from '@/services/cartService';
import { cartKeys } from '@/hooks/useCart';

/* ──────────────────────────────────────────────────────────────────────────
 * EditCartItemModal
 *
 * Opens when the buyer clicks the variant button on a cart item (cart
 * interfaces only — not the checkout summary). Lets them:
 *   1. Reselect the variant (reusing VariantPicker from the product page).
 *   2. Adjust the quantity.
 *   3. Confirm → calls updateItem(cartItemId, { variantId, quantity }).
 *
 * On success the cart query is invalidated so the drawer/page re-fetch
 * and reflect the new variant and price.
 * ──────────────────────────────────────────────────────────────────────── */

export interface EditCartItemModalProps {
  /** Controls modal visibility. */
  open: boolean;
  /** Called when the modal should close (user dismissed or confirmed). */
  onClose: () => void;
  /** The cart item to edit. `item.productSlug` is required to re-fetch
   *  the full product with all variants. */
  item: CartItemPublic | null;
}

export function EditCartItemModal({
  open,
  onClose,
  item,
}: EditCartItemModalProps) {
  const queryClient = useQueryClient();

  // ── Product fetch ────────────────────────────────────────────────────
  // Re-fetch the product so we have the full variant list + availability.
  // `enabled` is always true when `item` is present because we gate on
  // `open` in the parent, but we also guard the slug to be defensive.
  const productQuery = useQuery({
    queryKey: ['product', 'edit-modal', item?.productSlug],
    queryFn: () => {
      if (!item?.productSlug) throw new Error('Missing product slug');
      return productService.getBySlug(item.productSlug);
    },
    enabled: open && !!item?.productSlug,
  });

  const product = productQuery.data ?? null;

  // ── Pre-select from cart item ─────────────────────────────────────────
  // Derive the initial `selectedOptions` from the cart item's stored
  // attributes. This is what the VariantPicker highlights on open.
  // The `item` dependency covers every case: null→object, object→object,
  // or object→null (all different renders where we need fresh options).
  const initialSelectedOptions = useMemo<Record<string, string>>(() => {
    if (!item?.attributes) return {};
    return Object.fromEntries(
      item.attributes.map((a) => [a.attributeName, a.value]),
    );
  }, [item]);

  // ── Local selection state ─────────────────────────────────────────────
  // Initialised directly from the cart item so the VariantPicker opens
  // with the buyer's current selection highlighted. When the parent
  // switches `item` (a different cart row is being edited),
  // `initialSelectedOptions` changes and React re-evaluates the lazy
  // initialiser — no `useEffect` sync required.
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    initialSelectedOptions,
  );
  const [quantity, setQuantity] = useState(item?.quantity ?? 1);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  // Hand the modal a wrapped close that also dismisses the lightbox, so we
  // don't need an effect to reset `isLightboxOpen` when the modal closes.
  const handleModalClose = () => {
    setIsLightboxOpen(false);
    onClose();
  };

  // ── Variant resolution ────────────────────────────────────────────────
  // Identical resolution logic to ProductDetailPage — find the variant
  // whose attributes exactly match `selectedOptions`.
  const axes = useMemo(
    () => buildAttributeAxes(product?.variants ?? []),
    [product?.variants],
  );

  const selectedVariant = useMemo<ProductVariant | null>(() => {
    if (!product || axes.length === 0) return null;
    const filledAxes = axes.filter((a) => selectedOptions[a.name] !== undefined);
    if (filledAxes.length !== axes.length) return null;
    for (const v of product.variants) {
      const attrMap = new Map(v.attributes.map((a) => [a.attributeName, a.value]));
      let matches = true;
      for (const [name, value] of Object.entries(selectedOptions)) {
        if (attrMap.get(name) !== value) {
          matches = false;
          break;
        }
      }
      if (matches) return v;
    }
    return null;
  }, [product, axes, selectedOptions]);

  const isOutOfStock =
    !!selectedVariant &&
    (selectedVariant.stockStatus === 'out_of_stock' || !selectedVariant.isActive);

  // ── Confirm mutation ─────────────────────────────────────────────────
  // Declared before any usage so the `canConfirm` derivation below is valid.
  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!item || !selectedVariant) throw new Error('Nothing to update');
      return cartService.updateItem(item.id, {
        quantity,
        variantId: selectedVariant.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: cartKeys.all() });
      onClose();
    },
    onError: (err) => {
      // Surface backend rejections so the user knows why the update failed.
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string };
      const msg =
        anyErr?.response?.data?.message ??
        anyErr?.message ??
        'Failed to update cart item. Please try again.';
      toast.error(msg);
    },
  });

  const canConfirm = !!selectedVariant && !isOutOfStock && !confirmMutation.isPending;

  const handleConfirm = () => {
    if (!canConfirm) return;
    confirmMutation.mutate();
  };

  // ── Variant picker handler ─────────────────────────────────────────────
  const handleOptionSelect = useCallback((axis: string, value: string) => {
    setSelectedOptions((prev) => {
      if (prev[axis] === value) {
        const next = { ...prev };
        delete next[axis];
        return next;
      }
      return { ...prev, [axis]: value };
    });
  }, []);

  // ── Loading / error states ────────────────────────────────────────────
  const isLoading = productQuery.isLoading;
  const isError = productQuery.isError || !product;

  return (
    <Modal
      open={open}
      onClose={handleModalClose}
      title={isError ? 'Could not load product' : 'Change options'}
      size="3xl"
      dismissable={!isLightboxOpen}
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" size="md" onClick={handleModalClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleConfirm}
            disabled={!canConfirm}
            isLoading={confirmMutation.isPending}
          >
            {confirmMutation.isPending ? 'Saving…' : 'Confirm'}
          </Button>
        </div>
      }
    >
      {/* Loading skeleton — mirrors the 2-column layout */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="flex flex-col gap-5">
            <Skeleton className="h-7 w-5/6" />
            <Skeleton className="h-6 w-1/3" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-9 w-2/3" />
            </div>
            <div className="flex items-center gap-4 mt-1">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <p className="text-sm text-slate-500">
          Could not load product variants. Please try again.
        </p>
      )}

      {/* Product content — two-column quick-view */}
      {product && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8">
          {/* Left column: hero image (clickable for lightbox) */}
          <div>
            <button
              type="button"
              onClick={() => setIsLightboxOpen(true)}
              aria-label="Zoom product image"
              className="group relative w-full aspect-square overflow-hidden rounded-2xl bg-slate-50 border border-slate-100 cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
            >
              {(selectedVariant?.imageUrl ?? product.images?.[0]) ? (
                <img
                  src={selectedVariant?.imageUrl ?? product.images![0]}
                  alt={product.name}
                  className="w-full h-full object-cover transition-opacity duration-200 group-hover:opacity-90"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300 text-5xl font-semibold">
                  {product.name.charAt(0).toUpperCase()}
                </div>
              )}
              {/* Subtle zoom hint chip on hover */}
              <span className="absolute bottom-3 right-3 text-[11px] font-medium text-white bg-slate-900/70 px-2.5 py-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Click to zoom
              </span>
            </button>
          </div>

          {/* Right column: details & controls */}
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <p className="text-xl font-semibold text-slate-900 line-clamp-2 leading-snug">
                {product.name}
              </p>
              <div>
                {selectedVariant ? (
                  <PriceTag
                    value={selectedVariant.price}
                    size="lg"
                    className="font-semibold"
                  />
                ) : (
                  <p className="text-sm text-slate-400">Select options below</p>
                )}
              </div>
            </div>

            {axes.length > 0 && (
              <VariantPicker
                variants={product.variants}
                selectedOptions={selectedOptions}
                onOptionSelect={handleOptionSelect}
              />
            )}

            <div className="flex items-center gap-4 pt-1">
              <span className="text-sm font-medium text-slate-700 shrink-0">Quantity</span>
              <QuantityStepper
                value={quantity}
                max={selectedVariant?.available}
                disabled={!selectedVariant || isOutOfStock}
                onCommit={(val) => setQuantity(val)}
                onCommitError={() => {
                  /* Reset draft to the server-authoritative value on failure.
                   * `setQuantity(quantity)` preserves the current local state. */
                  setQuantity(quantity);
                }}
              />
              {selectedVariant && (
                <span className="ml-2 text-xs text-slate-500">
                  {selectedVariant.available !== undefined
                    ? `${selectedVariant.available} available`
                    : null}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zoomable lightbox overlay */}
      {product && (
        <ZoomableLightbox
          key={isLightboxOpen ? 'open' : 'closed'}
          src={selectedVariant?.imageUrl ?? product.images?.[0] ?? ''}
          alt={product.name}
          open={isLightboxOpen}
          onClose={() => setIsLightboxOpen(false)}
        />
      )}
    </Modal>
  );
}
