import { ContentLayout } from '@/layouts/ContentLayout';
import { AlertCircle } from 'lucide-react';

export function ReturnsPage() {
  return (
    <ContentLayout
      title="Returns & Refunds"
      subtitle="Our hassle-free return policy for buyers."
    >
      <section className="mb-8">
        <h2>Our Return Policy</h2>
        <p>
          We want you to be completely satisfied with your purchase. If you're not happy
          with your order, you may return most items within <strong>7 days of delivery</strong>{' '}
          for a full refund, subject to the conditions below.
        </p>
        <p>
          Return requests must be submitted through your account within the 7-day window.
          Once approved, you'll receive a prepaid shipping label and instructions.
        </p>
      </section>

      <section className="mb-8">
        <h2>Eligibility Requirements</h2>
        <p>To be eligible for a return, your item must be:</p>
        <ul>
          <li>Unused, unworn, and in its original condition with all tags attached.</li>
          <li>Returned in its original packaging (box, pouch, etc.).</li>
          <li>Submitted with a valid order number and reason for return.</li>
        </ul>
        <p className="mt-4">
          <strong>Final-sale items</strong> (e.g., personalised goods, perishables, intimate
          apparel) are not eligible for return unless they arrive damaged or defective.
        </p>
      </section>

      <section className="mb-8">
        <h2>Non-Returnable Items</h2>
        <ul>
          <li>Items that have been used, altered, or damaged by the buyer.</li>
          <li>Personalised or custom-made products.</li>
          <li>Digital products and software licenses.</li>
          <li>Health and personal care items that have been opened.</li>
          <li>Items returned after the 7-day window.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>Damaged or Defective Items</h2>
        <p>
          If your item arrives damaged, defective, or significantly different from its
          listing description, contact us within <strong>48 hours</strong> of delivery.
          Please include clear photos of the item and packaging.
        </p>
        <p>
          We will arrange a replacement or full refund, including return shipping costs,
          at no additional charge to you.
        </p>
      </section>

      <section className="mb-8">
        <h2>Refund Process</h2>
        <ul>
          <li>Once we receive and inspect your return, we'll notify you by email within 3–5 business days.</li>
          <li>Approved refunds are processed to your original payment method.</li>
          <li>Credit card refunds typically appear within 5–10 business days after processing, depending on your bank.</li>
          <li>Original shipping fees are non-refundable unless the return is due to our error or a defective product.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>Seller Returns Policies</h2>
        <p>
          Individual sellers may offer their own return policies that extend beyond our
          platform-wide policy. These are displayed on each product page and in your
          order confirmation. Seller-specific policies take precedence where more generous.
        </p>
      </section>

      <section className="rounded-xl border border-slate-100 bg-slate-50 p-6">
        <div className="flex items-start gap-3">
          <AlertCircle size={20} className="text-slate-500 mt-0.5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium text-slate-900 mb-1">
              Need help with a return?
            </p>
            <p className="text-sm text-slate-500">
              Our support team is here to assist. Contact us at{' '}
              <a href="mailto:support@triverce.com" className="text-[#002b5b] hover:underline">
                support@triverce.com
              </a>{' '}
              or visit our{' '}
              <a href="/contact" className="text-[#002b5b] hover:underline">
                contact page
              </a>
              .
            </p>
          </div>
        </div>
      </section>
    </ContentLayout>
  );
}
