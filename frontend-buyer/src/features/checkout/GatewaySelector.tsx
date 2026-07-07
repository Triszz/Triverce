import { Truck, BadgeCheck, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

/* ──────────────────────────────────────────────────────────────────────────
 * GatewaySelector — pick between the only two gateways we ship:
 *   • VNPay  (sandbox)
 *   • COD    (cash on delivery)
 *
 * IMPORTANT: this UI intentionally hides Momo and Stripe per the product
 * spec. If a third gateway needs to come back later, just add it to the
 * `GATEWAYS` array — the card layout is fully data-driven.
 *
 * Each card carries:
 *   • Brand-colored icon block
 *   • Title + one-line subtitle
 *   • Perks row (instant confirmation, secure, etc.)
 *   • A radio-style indicator on the right
 *
 * The selected card uses the brand-50 wash + brand-700 ring, mirroring
 * the cart-drawer's "selected shipping address" pattern.
 * ──────────────────────────────────────────────────────────────────────── */

export type CheckoutGateway = "vnpay" | "cod";

export interface GatewayMeta {
  id: CheckoutGateway;
  title: string;
  subtitle: string;
  description: string;
  /** Tailwind classes for the brand icon block. */
  iconWrap: string;
  /** Brand-colored <svg> path node — kept inline so we don't add deps. */
  logo: React.ReactNode;
  perks: { icon: React.ReactNode; label: string }[];
}

const GATEWAYS: GatewayMeta[] = [
  {
    id: "vnpay",
    title: "VNPay",
    subtitle: "Sandbox · Vietnamese payment gateway",
    description:
      "Pay securely via ATM card, QR, or VNPay wallet in the sandbox env.",
    iconWrap: "bg-[#005bba] text-white",
    logo: (
      <svg
        viewBox="0 0 64 64"
        aria-hidden
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stylised "V" mark — references the VNPay wordmark */}
        <path d="M10 12 L30 50 L54 12" />
        <circle cx="30" cy="50" r="3.5" fill="currentColor" stroke="none" />
      </svg>
    ),
    perks: [
      { icon: <ShieldCheck size={13} aria-hidden />, label: "PCI-DSS secured" },
      {
        icon: <BadgeCheck size={13} aria-hidden />,
        label: "Instant confirmation",
      },
    ],
  },
  {
    id: "cod",
    title: "Cash on Delivery",
    subtitle: "Pay when your order arrives",
    description:
      "No online payment now — hand the cash to the courier on delivery.",
    iconWrap: "bg-emerald-600 text-white",
    logo: (
      <svg
        viewBox="0 0 64 64"
        aria-hidden
        className="h-7 w-7"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Truck silhouette — universal "COD" cue */}
        <path d="M4 18 H40 V44 H4 Z" />
        <path d="M40 26 H52 L60 36 V44 H40 Z" />
        <circle cx="16" cy="48" r="5" />
        <circle cx="50" cy="48" r="5" />
      </svg>
    ),
    perks: [
      { icon: <Truck size={13} aria-hidden />, label: "Nationwide coverage" },
      {
        icon: <BadgeCheck size={13} aria-hidden />,
        label: "No online banking needed",
      },
    ],
  },
];

export interface GatewaySelectorProps {
  /** Currently selected gateway. */
  value: CheckoutGateway;
  /** Called when the user picks a different gateway. */
  onChange: (next: CheckoutGateway) => void;
  className?: string;
}

/**
 * Renders the gateway cards inside a 1-col / md:2-col responsive grid.
 * Each card is keyboard-focusable and behaves like a real radio button
 * (radio role + `aria-checked`).
 */
export function GatewaySelector({
  value,
  onChange,
  className,
}: GatewaySelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Payment gateway"
      className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}
    >
      {GATEWAYS.map((g) => {
        const selected = value === g.id;
        return (
          <button
            key={g.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(g.id)}
            className={cn(
              "group relative w-full text-left rounded-xl border bg-white p-5",
              "transition-all duration-200 ease-out",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2",
              selected
                ? "border-[#002b5b] ring-2 ring-[#002b5b]/30 shadow-md bg-brand-50/40"
                : "border-slate-200 hover:border-slate-300 hover:shadow-sm",
            )}
          >
            {/* Top row: icon block + indicator */}
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex items-center justify-center h-12 w-12 rounded-xl shadow-sm",
                  g.iconWrap,
                )}
                aria-hidden
              >
                {g.logo}
              </div>

              {/* Radio indicator */}
              <div
                className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full border-2 transition-colors",
                  selected
                    ? "border-[#002b5b] bg-[#002b5b]"
                    : "border-slate-300 bg-white group-hover:border-slate-400",
                )}
              >
                {selected && (
                  <span className="h-2 w-2 rounded-full bg-white" aria-hidden />
                )}
              </div>
            </div>

            {/* Title block */}
            <div className="mt-4">
              <h3 className="text-base font-semibold text-slate-900">
                {g.title}
              </h3>
              <p className="mt-0.5 text-xs font-medium text-slate-500">
                {g.subtitle}
              </p>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                {g.description}
              </p>
            </div>

            {/* Perks row */}
            <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              {g.perks.map((perk) => (
                <li
                  key={perk.label}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600"
                >
                  <span className="text-[#002b5b]">{perk.icon}</span>
                  {perk.label}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
