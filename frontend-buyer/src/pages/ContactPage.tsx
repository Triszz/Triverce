import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Mail, Phone, MapPin, Clock, Send } from "lucide-react";
import { ContentLayout } from "@/layouts/ContentLayout";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

const schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  message: z.string().min(20, "Message must be at least 20 characters"),
});

type FormValues = z.infer<typeof schema>;

const CONTACT_INFO = [
  {
    icon: Mail,
    label: "Email",
    value: "contact@triverce.com",
    href: "mailto:hello@triverce.com",
  },
  {
    icon: Phone,
    label: "Phone",
    value: "+84 28 1234 5678",
    href: "tel:+842812345678",
  },
  {
    icon: MapPin,
    label: "Address",
    value: "123 Nguyen Hue, District 1, Ho Chi Minh City, Vietnam",
    href: null,
  },
  {
    icon: Clock,
    label: "Support hours",
    value: "Mon – Fri, 9:00 AM – 6:00 PM (ICT)",
    href: null,
  },
];

export function ContactPage() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const onSubmit = async (_data: FormValues) => {
    // Simulate network delay; no backend API needed yet.
    await new Promise((r) => setTimeout(r, 800));
    toast.success(
      "Message sent! We'll get back to you within 1–2 business days.",
    );
    reset();
  };

  return (
    <ContentLayout
      title="Contact Us"
      subtitle="Have a question or feedback? We'd love to hear from you."
    >
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
        {/* Left: contact info */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Get in touch
            </h2>
            <p className="text-sm text-slate-500 leading-relaxed">
              Whether you're a buyer with a question about your order, or a
              seller looking to open a store — our team is here to help.
            </p>
          </div>

          <ul className="space-y-4">
            {CONTACT_INFO.map(({ icon: Icon, label, value, href }) => (
              <li key={label} className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 w-9 h-9 rounded-lg bg-[#002b5b]/10 flex items-center justify-center">
                  <Icon size={16} className="text-[#002b5b]" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    {label}
                  </p>
                  {href ? (
                    <a
                      href={href}
                      className="text-sm text-slate-700 hover:text-[#002b5b] transition-colors"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm text-slate-700">{value}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* FAQ teaser */}
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-5">
            <p className="text-sm font-medium text-slate-900 mb-1">
              Looking for a quick answer?
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Check our help centre for instant answers to common questions.
            </p>
            <a
              href="/shipping"
              className="text-xs font-medium text-[#002b5b] hover:underline"
            >
              Shipping info &rarr;
            </a>
          </div>
        </div>

        {/* Right: contact form */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-6 sm:p-8">
            <h2 className="text-lg font-semibold text-slate-900 mb-6">
              Send us a message
            </h2>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="space-y-5"
            >
              {/* Name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Full name
                  </label>
                  <Input
                    {...register("name")}
                    placeholder="Jane Smith"
                    autoComplete="name"
                    error={errors.name?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Email address
                  </label>
                  <Input
                    {...register("email")}
                    type="email"
                    placeholder="jane@example.com"
                    autoComplete="email"
                    error={errors.email?.message}
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Subject
                </label>
                <Input
                  {...register("subject")}
                  placeholder="How do I track my order?"
                  error={errors.subject?.message}
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Message
                </label>
                <textarea
                  {...register("message")}
                  rows={5}
                  placeholder="Tell us more about your question or issue…"
                  className={cn(
                    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900",
                    "placeholder:text-slate-400",
                    "focus:outline-none focus:ring-2 focus:ring-[#002b5b]/20 focus:border-[#002b5b]",
                    "transition-colors",
                    errors.message &&
                      "border-red-400 focus:border-red-400 focus:ring-red-400/20",
                  )}
                />
                {errors.message && (
                  <p className="mt-1.5 text-xs text-red-500">
                    {errors.message.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                leftIcon={
                  isSubmitting ? undefined : <Send size={15} aria-hidden />
                }
                className="w-full sm:w-auto"
              >
                {isSubmitting ? "Sending…" : "Send message"}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </ContentLayout>
  );
}
