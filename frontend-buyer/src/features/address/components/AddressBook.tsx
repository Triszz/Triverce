import { useRef, useState } from 'react';
import { Check, MapPin, Phone, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { ShippingForm } from '@/features/checkout/ShippingForm';
import type { ShippingFormHandle, ShippingFormValues } from '@/features/checkout/checkout.types';
import type { SavedAddress } from '../types/address';

/* ──────────────────────────────────────────────────────────────────────────
 * AddressBook — selectable list of saved addresses + new address entry.
 *
 * UX flow:
 *   • Clicking a saved address card → immediately fires `onSelect`
 *     (auto-confirm — no extra button needed for pre-saved addresses).
 *   • Clicking "Add new address" → opens the inline ShippingForm;
 *     "Use this address" inside the form fires `onSaveNew` (if provided)
 *     then `onSelect` after the form validates.
 *
 * The `ShippingForm` is used here via `forwardRef` + `useImperativeHandle`
 * so the "Use this address" button can call `form.submit()` imperatively
 * to trigger RHF validation before dispatching the final values.
 * ──────────────────────────────────────────────────────────────────────── */

interface AddressBookProps {
  /** Fetched from useAddresses. Empty array is valid (no saved addresses). */
  addresses: SavedAddress[];
  /**
   * Called when:
   *   1. A saved address card is clicked (auto-confirm — no form needed).
   *   2. "Use this address" inside the new-address form is clicked and the
   *      form validates successfully.
   *
   * The parent (CheckoutPage) uses this to populate `confirmedValues`,
   * which unlocks the "Place order" button.
   */
  onSelect: (values: ShippingFormValues) => void;
  /**
   * Optional. When provided, the "Use this address" button inside the
   * new-address form first calls `onSaveNew(values)`. The caller should
   * persist the address and then call `onSelect(values)`.
   */
  onSaveNew?: (values: ShippingFormValues) => Promise<void>;
  /** Loading state for `onSaveNew`. */
  isCreating?: boolean;
  /**
   * Optional. Called when the user clicks "Add new address". The parent
   * should use this to clear any previously confirmed address, so the
   * "Place order" button re-locks until the new form is submitted.
   */
  onAddNew?: () => void;
  className?: string;
}

export function AddressBook({
  addresses,
  onSelect,
  onSaveNew,
  isCreating,
  onAddNew,
  className,
}: AddressBookProps) {
  // `selectedId` drives the radio-card highlight state.
  // `null` = nothing highlighted; `'__new__'` = new-address form open.
  const [selectedId, setSelectedId] = useState<string | null>(
    addresses.find((a) => a.isDefault)?.id ?? null,
  );
  const showNewForm = selectedId === '__new__';
  const [saveNew, setSaveNew] = useState(false);
  // Ref into the <ShippingForm> for imperative submit.
  const newFormRef = useRef<ShippingFormHandle>(null);

  /* ── Handlers ─────────────────────────────────────────────────────────── */

  /**
   * One-click confirm for saved address cards.
   * Immediately fires `onSelect` with that address's values.
   * No extra button needed.
   */
  const handleSavedCardClick = (id: string) => {
    const addr = addresses.find((a) => a.id === id);
    if (!addr) return;
    setSelectedId(id);
    onSelect({
      shippingName: addr.recipientName,
      shippingPhone: addr.phone,
      shippingAddress: addr.address,
      note: '',
    });
  };

  /**
   * Fires when the user clicks "Use this address" inside the new-address form.
   * If `onSaveNew` is provided, calls it first (persisting the address), then
   * always calls `onSelect` to confirm and unlock the Place Order button.
   */
  const handleNewFormUse = async (values: ShippingFormValues) => {
    if (saveNew && onSaveNew) {
      await onSaveNew(values);
    }
    onSelect(values);
  };

  const handleNewCardClick = () => {
    setSelectedId('__new__');
    onAddNew?.();
  };

  const handleCancelNew = () => {
    setSelectedId(addresses.find((a) => a.isDefault)?.id ?? addresses[0]?.id ?? null);
    setSaveNew(false);
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  return (
    <div className={cn('space-y-3', className)}>
      {/* Saved address cards — auto-confirm on click */}
      {addresses.map((addr) => (
        <AddressCard
          key={addr.id}
          address={addr}
          isSelected={selectedId === addr.id}
          onSelect={() => handleSavedCardClick(addr.id)}
        />
      ))}

      {/* "Add new address" toggle card */}
      <button
        type="button"
        onClick={handleNewCardClick}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border-2 p-4 text-left',
          'transition-colors duration-150 cursor-pointer',
          showNewForm
            ? 'border-[#002b5b] bg-blue-50/40'
            : 'border-dashed border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
        )}
      >
        <span
          className={cn(
            'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            showNewForm ? 'bg-[#002b5b] text-white' : 'bg-slate-100 text-slate-500',
          )}
          aria-hidden
        >
          <Plus size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {showNewForm ? 'New address' : 'Add new address'}
          </p>
          <p className="text-xs text-slate-500">
            {showNewForm ? 'Fill in your details below' : 'Use a different delivery address'}
          </p>
        </div>
      </button>

      {/* Inline new-address form — shown only when '__new__' is selected */}
      {showNewForm && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <ShippingForm
            ref={newFormRef}
            onSubmit={handleNewFormUse}
          />

          {/* "Save for next time" checkbox */}
          {onSaveNew && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveNew}
                onChange={(e) => setSaveNew(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#002b5b]
                  focus:ring-[#002b5b]/30 accent-[#002b5b]"
              />
              <span className="text-sm text-slate-700">
                Save this address for next time
              </span>
            </label>
          )}

          {/* Form actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancelNew}
              disabled={isCreating}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600
                hover:bg-slate-100 transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => newFormRef.current?.submit()}
              disabled={isCreating}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white
                bg-[#002b5b] hover:bg-[#001f3f] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isCreating ? 'Saving…' : 'Use this address'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * AddressCard — one saved address as a selectable radio-card.
 * ──────────────────────────────────────────────────────────────────────── */

function AddressCard({
  address,
  isSelected,
  onSelect,
}: {
  address: SavedAddress;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex items-start gap-3 rounded-xl border-2 p-4 text-left',
        'transition-colors duration-150 cursor-pointer',
        isSelected
          ? 'border-[#002b5b] bg-blue-50/40'
          : 'border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50',
      )}
    >
      {/* Radio circle */}
      <span
        className={cn(
          'shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center',
          isSelected ? 'border-[#002b5b] bg-[#002b5b]' : 'border-slate-300',
        )}
        aria-hidden
      >
        {isSelected && <Check size={10} className="text-white" strokeWidth={3} />}
      </span>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate">
            {address.recipientName}
          </p>
          {address.isDefault && (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5
              rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
              Default
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-600">
          <Phone size={11} className="shrink-0 text-slate-400" aria-hidden />
          <span className="tabular-nums">{address.phone}</span>
        </div>
        <div className="flex items-start gap-1.5 text-xs text-slate-600">
          <MapPin size={11} className="shrink-0 mt-0.5 text-slate-400" aria-hidden />
          <span className="leading-relaxed">{address.address}</span>
        </div>
      </div>
    </button>
  );
}

export default AddressBook;
