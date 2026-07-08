import { ContentLayout } from '@/layouts/ContentLayout';
import { MapPin, Clock } from 'lucide-react';

const SHIPPING_TIERS = [
  {
    region: 'Ho Chi Minh City & Hanoi',
    time: '1–2 business days',
    note: 'Express same-day delivery available for select sellers.',
  },
  {
    region: 'Major cities (Da Nang, Can Tho, Hai Phong)',
    time: '2–4 business days',
    note: 'Standard tracked shipping via GHN or GHTK.',
  },
  {
    region: 'Other provinces',
    time: '4–7 business days',
    note: 'Delivery times may vary depending on remoteness.',
  },
  {
    region: 'International',
    time: '7–21 business days',
    note: 'Rates and availability vary by seller and destination country.',
  },
];

export function ShippingPage() {
  return (
    <ContentLayout
      title="Shipping Information"
      subtitle="Everything you need to know about getting your order delivered."
    >
      <section className="mb-8">
        <h2>How Shipping Works</h2>
        <p>
          When you place an order, the seller prepares and dispatches it within their
          stated processing time (usually 1–3 business days). Once shipped, you'll
          receive a tracking number by email and in your account dashboard.
        </p>
        <p>
          Triverce coordinates with trusted logistics partners in Vietnam — including
          GHN, GHTK, and ViettelPost — to ensure reliable delivery nationwide.
        </p>
      </section>

      <section className="mb-8">
        <h2>Delivery Times by Region</h2>
        <div className="space-y-4 not-prose">
          {SHIPPING_TIERS.map(({ region, time, note }) => (
            <div
              key={region}
              className="flex items-start gap-4 bg-white rounded-xl border border-slate-100 shadow-sm p-5"
            >
              <div className="shrink-0 mt-0.5">
                <MapPin size={18} className="text-[#002b5b]" aria-hidden />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{region}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} aria-hidden />
                    {time}
                  </span>
                  {' — '}
                  {note}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2>Shipping Fees</h2>
        <ul>
          <li>Shipping costs are set by individual sellers and are calculated at checkout based on item weight, dimensions, and destination.</li>
          <li>Orders over ₫500,000 qualify for free standard shipping within Vietnam (seller discretion).</li>
          <li>International shipping rates depend on the seller's location and the destination country.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>Tracking Your Order</h2>
        <p>
          Once your order ships, you'll receive a tracking link directly from the
          logistics provider. You can also view all your order tracking information
          in your Triverce account under <strong>My Orders</strong>.
        </p>
        <p>
          If your tracking shows no updates for more than 5 business days, please contact
          us and we'll investigate with the carrier on your behalf.
        </p>
      </section>

      <section>
        <h2>Shipping Restrictions</h2>
        <ul>
          <li>Some items may not be available for international shipping due to customs regulations.</li>
          <li>Sellers are responsible for ensuring items comply with local import laws.</li>
          <li>Triverce cannot deliver to P.O. box addresses for most orders.</li>
        </ul>
      </section>
    </ContentLayout>
  );
}
