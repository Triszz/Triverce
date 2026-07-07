import { forwardRef, useImperativeHandle, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { MapPin, Phone, User, StickyNote } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';
import {
  shippingSchema,
  type ShippingFormHandle,
  type ShippingFormProps,
  type ShippingFormValues,
} from './checkout.types';

/* ──────────────────────────────────────────────────────────────────────────
 * ShippingForm — shipping details for an order.
 *
 * Field shape + validation rules live in `./checkout.types.ts`
 * (`shippingSchema` + `ShippingFormValues`). This file only contains the
 * JSX so the `react-refresh/only-export-components` ESLint rule stays
 * happy — component-only exports are required for Vite HMR.
 *
 * The form is intentionally uncontrolled-by-the-parent: a ref-based
 * imperative API (`useImperativeHandle`) lets the OrderSummary card's
 * "Place order" button trigger a submit cycle without being a DOM
 * child of the `<form>`.
 * ──────────────────────────────────────────────────────────────────────── */

export const ShippingForm = forwardRef<ShippingFormHandle, ShippingFormProps>(
  function ShippingForm({ defaultValues, onSubmit, className }, ref) {
    const formElRef = useRef<HTMLFormElement>(null);

    const {
      register,
      handleSubmit,
      formState: { errors, isValid },
    } = useForm<ShippingFormValues>({
      resolver: zodResolver(shippingSchema),
      mode: 'onTouched',
      defaultValues: {
        shippingName: defaultValues?.shippingName ?? '',
        shippingPhone: defaultValues?.shippingPhone ?? '',
        shippingAddress: defaultValues?.shippingAddress ?? '',
        note: defaultValues?.note ?? '',
      },
    });

    // Expose a stable submit trigger for the parent.
    useImperativeHandle(
      ref,
      () => ({
        submit: () => {
          formElRef.current?.requestSubmit();
        },
        isValid,
      }),
      [isValid],
    );

    return (
      <form
        ref={formElRef}
        noValidate
        onSubmit={handleSubmit(onSubmit)}
        className={cn('space-y-5', className)}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Input
            label="Recipient name"
            placeholder="Nguyen Van A"
            leftIcon={<User size={16} aria-hidden />}
            autoComplete="name"
            error={errors.shippingName?.message}
            {...register('shippingName')}
          />
          <Input
            label="Phone number"
            placeholder="0901234567"
            inputMode="numeric"
            leftIcon={<Phone size={16} aria-hidden />}
            autoComplete="tel"
            error={errors.shippingPhone?.message}
            {...register('shippingPhone')}
          />
        </div>

        <Input
          label="Shipping address"
          placeholder="House number, street, ward, district, city"
          leftIcon={<MapPin size={16} aria-hidden />}
          autoComplete="street-address"
          error={errors.shippingAddress?.message}
          {...register('shippingAddress')}
        />

        <div>
          <label
            htmlFor="checkout-note"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Order note <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-3 text-slate-400">
              <StickyNote size={16} aria-hidden />
            </span>
            <textarea
              id="checkout-note"
              rows={3}
              placeholder="Anything the seller should know (e.g. delivery window)"
              className={cn(
                'w-full rounded-lg border bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder-slate-400',
                'transition-colors duration-150',
                'focus:outline-none focus:ring-2',
                errors.note
                  ? 'border-danger-500 focus:border-danger-500 focus:ring-danger-500/20'
                  : 'border-slate-200 focus:border-[#002b5b] focus:ring-[#002b5b]/20',
                'resize-y',
              )}
              {...register('note')}
            />
          </div>
          {errors.note?.message && (
            <p className="mt-1.5 text-xs text-danger-600">{errors.note.message}</p>
          )}
        </div>
      </form>
    );
  },
);