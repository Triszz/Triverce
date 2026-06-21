import { Link } from 'react-router-dom';

export function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Create your account</h2>
        <p className="mt-1 text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/auth/login" className="text-[#002b5b] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>

      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1.5">
              First name
            </label>
            <input
              id="firstName"
              type="text"
              name="firstName"
              autoComplete="given-name"
              required
              placeholder="John"
              className="w-full"
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1.5">
              Last name
            </label>
            <input
              id="lastName"
              type="text"
              name="lastName"
              autoComplete="family-name"
              required
              placeholder="Doe"
              className="w-full"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="w-full"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1.5">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            placeholder="At least 8 characters"
            minLength={8}
            className="w-full"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1.5">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            placeholder="Repeat your password"
            className="w-full"
          />
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            required
            className="mt-0.5 rounded border-slate-300 text-[#002b5b] focus:ring-[#002b5b]/20"
          />
          <span>
            I agree to the{' '}
            <Link to="/terms" className="text-[#002b5b] hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-[#002b5b] hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <button type="submit" className="btn-primary w-full">
          Create account
        </button>
      </form>
    </div>
  );
}
