import { ContentLayout } from '@/layouts/ContentLayout';

export function TermsPage() {
  return (
    <ContentLayout
      title="Terms of Service"
      description="Last updated: June 22, 2026"
    >
      <section className="mb-8">
        <h2>1. Acceptance of Terms</h2>
        <p>
          By accessing or using the Triverce marketplace platform, you agree to be bound
          by these Terms of Service and all applicable laws and regulations. If you do not
          agree with any part of these terms, you may not use our services.
        </p>
      </section>

      <section className="mb-8">
        <h2>2. Description of Service</h2>
        <p>
          Triverce operates a multi-vendor e-commerce platform that connects buyers with
          independent sellers. We provide the infrastructure, payment processing, and
          order management tools — but the products themselves are sold directly by
          third-party sellers.
        </p>
        <p>
          We reserve the right to modify, suspend, or discontinue any part of the service
          at any time without prior notice.
        </p>
      </section>

      <section className="mb-8">
        <h2>3. User Accounts</h2>
        <ul>
          <li>You must provide accurate and complete information when creating an account.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You must be at least 18 years old to create a buyer account.</li>
          <li>Seller accounts require additional verification and are subject to approval.</li>
          <li>One person or entity may not maintain more than one seller account without written permission.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>4. Product Listings & Seller Responsibilities</h2>
        <p>
          Sellers are solely responsible for the accuracy of their product listings,
          including descriptions, pricing, images, and stock levels. All listings must
          comply with our Prohibited Items Policy.
        </p>
        <p>
          Triverce reserves the right to remove listings that violate our policies
          without compensation to the seller.
        </p>
      </section>

      <section className="mb-8">
        <h2>5. Pricing & Payment</h2>
        <ul>
          <li>All prices are listed in the currency shown at checkout.</li>
          <li>Prices are set by sellers and may change at any time before an order is placed.</li>
          <li>Payment is processed by Triverce on behalf of sellers. Funds are typically disbursed to sellers within 3–5 business days after delivery confirmation.</li>
          <li>Triverce charges a commission on each sale, disclosed transparently to sellers in their dashboard.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>6. Intellectual Property</h2>
        <p>
          All content on the Triverce platform, including logos, text, graphics, and
          software, is the property of Triverce or its licensors and may not be
          reproduced without prior written consent.
        </p>
      </section>

      <section className="mb-8">
        <h2>7. Limitation of Liability</h2>
        <p>
          Triverce shall not be liable for any indirect, incidental, special, consequential,
          or punitive damages arising from your use of the platform. Our total liability
          for any claim shall not exceed the amount you paid for the transaction in question.
        </p>
      </section>

      <section className="mb-8">
        <h2>8. Governing Law</h2>
        <p>
          These terms are governed by the laws of Vietnam. Any disputes shall be
          resolved in the courts of Ho Chi Minh City.
        </p>
      </section>

      <section>
        <h2>9. Contact</h2>
        <p>
          For questions about these Terms of Service, please contact us at{' '}
          <a href="mailto:legal@triverce.com" className="text-[#002b5b] hover:underline">
            legal@triverce.com
          </a>
          .
        </p>
      </section>
    </ContentLayout>
  );
}
