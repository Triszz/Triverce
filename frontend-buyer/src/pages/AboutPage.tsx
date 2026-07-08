import { Truck, CreditCard, Users } from 'lucide-react';
import { ContentLayout } from '@/layouts/ContentLayout';

const FEATURES = [
  {
    icon: Users,
    title: 'Trusted Sellers',
    description:
      'Every seller on Triverce is vetted. We verify business registrations, collect proof of identity, and monitor reviews to maintain a marketplace you can rely on.',
  },
  {
    icon: Truck,
    title: 'Fast Shipping',
    description:
      'Sellers set their own dispatch times, but most orders ship within 1–3 business days. Track every order in real-time from your account.',
  },
  {
    icon: CreditCard,
    title: 'Secure Payments',
    description:
      'All transactions are processed through our PCI-DSS compliant payment gateway. Your card details are never stored on our servers.',
  },
];

export function AboutPage() {
  return (
    <ContentLayout
      title="About Triverce"
      subtitle="Building the marketplace we wished existed."
      heroImage="https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=1400&q=80"
    >
      {/* Mission block */}
      <section className="mb-10">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Our Mission</h2>
        <p className="text-slate-600 leading-relaxed mb-4">
          Triverce was born from a simple frustration: buying quality goods from independent makers online felt risky, fragmented, and often overpriced. We set out to change that.
        </p>
        <p className="text-slate-600 leading-relaxed mb-4">
          We built a marketplace where independent sellers from Vietnam and beyond can reach customers worldwide — without the overhead of running their own e-commerce operations. For buyers, we offer a curated, trustworthy environment where every product, seller, and review is verified.
        </p>
        <p className="text-slate-600 leading-relaxed">
          Our commission structure is transparent: sellers keep the majority of every sale. We make money when you succeed, not by extracting fees from either side of the transaction.
        </p>
      </section>

      {/* Values grid */}
      <section>
        <h2 className="text-2xl font-bold text-slate-900 mb-6">Why Triverce</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 space-y-3"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-[#002b5b]/10">
                <Icon size={20} className="text-[#002b5b]" aria-hidden />
              </div>
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats strip */}
      <section className="bg-[#002b5b] rounded-2xl px-8 py-10 my-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {[
            { value: '2,400+', label: 'Active sellers' },
            { value: '48,000+', label: 'Products listed' },
            { value: '120+', label: 'Countries reached' },
            { value: '4.7 / 5', label: 'Average seller rating' },
          ].map(({ value, label }) => (
            <div key={label}>
              <p className="text-2xl sm:text-3xl font-bold text-white">{value}</p>
              <p className="text-sm text-blue-100 mt-1">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-4">
        <p className="text-slate-600 mb-4">
          Ready to explore? Browse our full catalog or create a seller account today.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/shop"
            className="inline-flex items-center gap-2 rounded-lg bg-[#002b5b] text-white font-medium text-sm px-5 py-2.5 hover:bg-[#001f3f] transition-colors"
          >
            Browse products
          </a>
          <a
            href="/auth/register"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 text-slate-700 font-medium text-sm px-5 py-2.5 hover:bg-slate-50 transition-colors"
          >
            Become a seller
          </a>
        </div>
      </section>
    </ContentLayout>
  );
}
