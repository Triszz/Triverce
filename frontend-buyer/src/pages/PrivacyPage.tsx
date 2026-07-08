import { ContentLayout } from '@/layouts/ContentLayout';

export function PrivacyPage() {
  return (
    <ContentLayout
      title="Privacy Policy"
      description="Last updated: June 22, 2026"
    >
      <section className="mb-8">
        <h2>1. Information We Collect</h2>
        <p>
          We collect information you provide directly, including your name, email address,
          phone number, shipping address, and payment details when you create an account
          or place an order.
        </p>
        <p>
          We also collect usage data automatically, such as your IP address, browser type,
          pages visited, and device identifiers, to improve our platform and prevent fraud.
        </p>
      </section>

      <section className="mb-8">
        <h2>2. How We Use Your Information</h2>
        <ul>
          <li>To process and fulfil your orders, including shipping and delivery.</li>
          <li>To send order confirmations, shipping updates, and account notifications.</li>
          <li>To respond to your inquiries and provide customer support.</li>
          <li>To detect and prevent fraudulent transactions and abuse.</li>
          <li>To personalise your experience and recommend products.</li>
          <li>To comply with our legal obligations.</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2>3. Information Sharing</h2>
        <p>
          We share your information with sellers (only the data necessary to fulfil your
          order), payment processors, shipping carriers, and analytics providers. We do not
          sell your personal information to third parties.
        </p>
        <p>
          We may also disclose information when required by law, court order, or
          governmental regulation.
        </p>
      </section>

      <section className="mb-8">
        <h2>4. Data Retention</h2>
        <p>
          We retain your personal data for as long as your account is active, or as needed
          to provide services. Account data may be retained for up to 5 years after
          account closure for legal and tax compliance purposes.
        </p>
      </section>

      <section className="mb-8">
        <h2>5. Data Security</h2>
        <p>
          We implement industry-standard encryption (TLS 1.3), secure data centres, and
          regular security audits. No method of transmission over the internet is 100%
          secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section className="mb-8">
        <h2>6. Your Rights</h2>
        <p>Depending on your location, you may have the right to:</p>
        <ul>
          <li>Access the personal data we hold about you.</li>
          <li>Request correction of inaccurate data.</li>
          <li>Request deletion of your data, subject to legal retention requirements.</li>
          <li>Object to certain processing activities.</li>
          <li>Withdraw consent at any time, where processing is based on consent.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a href="mailto:privacy@triverce.com" className="text-[#002b5b] hover:underline">
            privacy@triverce.com
          </a>
          .
        </p>
      </section>

      <section className="mb-8">
        <h2>7. Cookies</h2>
        <p>
          We use cookies and similar technologies to keep you logged in, remember your
          preferences, and understand how you use our platform. You can manage cookie
          preferences in your browser settings. For more details, see our{' '}
          <a href="/cookies" className="text-[#002b5b] hover:underline">
            Cookie Policy
          </a>
          .
        </p>
      </section>

      <section>
        <h2>8. Changes to This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. We will notify you of
          material changes by posting the updated policy on this page and updating the
          "Last updated" date.
        </p>
      </section>
    </ContentLayout>
  );
}
