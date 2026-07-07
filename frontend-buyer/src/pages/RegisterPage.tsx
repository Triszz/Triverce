import { Check, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { authService } from "../services/authService";
import { PageMeta } from "@/components/common/PageMeta";

export function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const doPasswordsMatch =
    confirmPassword.length > 0 && password !== confirmPassword
      ? false
      : confirmPassword.length > 0 && password === confirmPassword;

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpperCase && hasNumber;

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.register({ email, password, fullName });
      toast.success("Account created successfully! Please sign in.");
      navigate("/auth/login");
    } catch (err) {
      const message =
        isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : "Registration failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta
        title="Create your account"
        description="Sign up for a Triverce account to checkout faster, track orders, and save your favourites."
      />
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Create your account
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            to="/auth/login"
            className="text-[#002b5b] hover:underline font-medium"
          >
            Sign in
          </Link>
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label
            htmlFor="fullName"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Full name
          </label>
          <input
            id="fullName"
            type="text"
            name="fullName"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Email address
          </label>
          <input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full"
            disabled={isLoading}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-1 text-xs mt-2">
            <div
              className={`flex items-center gap-1.5 ${hasMinLength ? "text-green-600" : "text-slate-400"}`}
            >
              {hasMinLength ? <Check size={14} /> : <X size={14} />}
              At least 8 characters
            </div>
            <div
              className={`flex items-center gap-1.5 ${hasUpperCase ? "text-green-600" : "text-slate-400"}`}
            >
              {hasUpperCase ? <Check size={14} /> : <X size={14} />}
              At least 1 uppercase letter
            </div>
            <div
              className={`flex items-center gap-1.5 ${hasNumber ? "text-green-600" : "text-slate-400"}`}
            >
              {hasNumber ? <Check size={14} /> : <X size={14} />}
              At least 1 number
            </div>
          </div>
        </div>

        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repeat your password"
            className="w-full"
            disabled={isLoading}
          />
          {confirmPassword.length > 0 && !doPasswordsMatch && (
            <p className="mt-1 text-red-500 text-sm">Passwords do not match</p>
          )}
        </div>

        <label className="flex items-start gap-2.5 text-sm text-slate-600">
          <input
            type="checkbox"
            required
            className="mt-0.5 rounded border-slate-300 text-[#002b5b] focus:ring-[#002b5b]/20"
            disabled={isLoading}
          />
          <span>
            I agree to the{" "}
            <Link to="/terms" className="text-[#002b5b] hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link to="/privacy" className="text-[#002b5b] hover:underline">
              Privacy Policy
            </Link>
          </span>
        </label>

        <button
          type="submit"
          className="btn-primary w-full"
          disabled={
            isLoading ||
            !isPasswordValid ||
            !doPasswordsMatch ||
            !email ||
            !fullName
          }
        >
          {isLoading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </div>
  );
}
