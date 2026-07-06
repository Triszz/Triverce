export function NotFoundPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
      <p className="text-sm font-medium text-brand-600">404</p>
      <h1 className="text-3xl font-bold text-slate-900">Page not found</h1>
      <p className="text-slate-500">
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </p>
      <a
        href="/"
        className="inline-flex items-center justify-center rounded-lg bg-[#002b5b] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#001f3f] transition-colors"
      >
        Back to home
      </a>
    </div>
  );
}
