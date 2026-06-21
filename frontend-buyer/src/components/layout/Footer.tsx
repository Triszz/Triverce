import { Link } from 'react-router-dom';

const FOOTER_LINKS = {
  Shop: [
    { label: 'All Products', href: '/shop' },
    { label: 'Categories', href: '/categories' },
    { label: 'Featured Sellers', href: '/sellers' },
    { label: 'New Arrivals', href: '/shop?sort=newest' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Shipping Info', href: '/shipping' },
    { label: 'Returns & Refunds', href: '/returns' },
    { label: 'Contact Us', href: '/contact' },
  ],
  Company: [
    { label: 'About Triverce', href: '/about' },
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Cookie Policy', href: '/cookies' },
  ],
};

function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">

          {/* Brand column */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <Link
              to="/"
              className="text-[#002b5b] font-bold text-xl tracking-tight block"
            >
              Triverce
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              A premium multi-vendor marketplace connecting buyers with trusted sellers worldwide.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-sm font-semibold text-slate-900 mb-3">
                {section}
              </h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      to={link.href}
                      className="text-sm text-slate-500 hover:text-[#002b5b] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-slate-100 mt-10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} Triverce. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {/* Social icons */}
            {['facebook', 'twitter', 'instagram'].map((social) => (
              <a
                key={social}
                href={`https://${social}.triverce.com`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social}
                className="text-slate-400 hover:text-[#002b5b] transition-colors"
              >
                <span className="sr-only">{social}</span>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect width="24" height="24" fill="none" />
                </svg>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
