import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Package, Calendar, Box, Star } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatVND } from "@/features/checkout/checkout.types";
import {
  getOrderStatusMeta,
  shortOrderId,
  formatOrderDate,
  type OrderStatus,
} from "@/features/orders/orders.types";
import type { OrderPublic } from "@/services/orderService";
import { cn } from "@/lib/cn";
import { WriteReviewModal } from "@/features/orders/components/WriteReviewModal";

/* ──────────────────────────────────────────────────────────────────────────
 * OrderCard — single row in the "My orders" list.
 *
 * Renders a clickable card that surfaces:
 *   • Short order ID + creation timestamp
 *   • Semantic status badge
 *   • Total amount (VND) + item count
 *
 * Navigation: clicking the card body navigates to /orders/:id; the
 * chevron mirrors the affordance. For `delivered` orders, a "Write a
 * Review" footer button is rendered alongside. Clicking it stops the
 * row-link navigation (`<button>` is a child of the `<Link>`) and opens
 * a modal so the buyer can submit reviews for individual line items.
 * ──────────────────────────────────────────────────────────────────────── */

export interface OrderCardProps {
  order: OrderPublic;
  className?: string;
}

export function OrderCard({ order, className }: OrderCardProps) {
  const meta = getOrderStatusMeta(order.status as OrderStatus);
  const StatusIcon = meta.icon;
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);

  // Track the review-modal state at the card level so each card owns
  // its own modal instance — switching tabs / paginating doesn't blow
  // away the modal mid-flow.
  const [reviewOpen, setReviewOpen] = useState(false);
  const canReview = order.status === "delivered";

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-100 bg-white shadow-sm",
        className,
      )}
    >
      <Link
        to={`/orders/${order.id}`}
        aria-label={`View order ${shortOrderId(order.id)}`}
        className={cn(
          // `p-6` (vs the previous `p-5`) so the bumped text sizes
          // don't feel cramped against the card edges.
          "group block p-6",
          "transition-all duration-200 ease-out",
          "hover:shadow-md hover:-translate-y-0.5 hover:border-slate-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#002b5b] focus-visible:ring-offset-2",
          // Round the bottom corners so the divider above the footer
          // sits flush. The footer is only present for delivered orders,
          // so the conditional class keeps the card visually clean
          // when no footer is rendered.
          !canReview && "rounded-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          {/* Left: order ID + meta */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Bumped from text-sm font-semibold → text-base
               * font-bold so the order ID is the visual anchor of
               * the card. font-mono preserves the
               * #XXXXXXXX alignability. */}
              <span className="font-mono text-base font-bold text-slate-900">
                #{shortOrderId(order.id)}
              </span>
              {/*
               * Status badge: bumped from Badge's `sm` defaults
               * (`text-[10px] px-2 py-0.5`) to a custom
               * `text-sm font-medium px-2.5 py-1` so the status pill
               * reads at the same scale as the order ID next to it.
               *
               * The override is scoped to this single consumer via
               * `className` — we deliberately do NOT modify the
               * shared `Badge` primitive, since changing `size="sm"`
               * globally would cascade to every other Badge
               * consumer in the app (product cards, review cards,
               * etc.). The `cn` import is already present above.
               */}
              <Badge
                tone={meta.tone}
                size="sm"
                className="text-xs font-medium px-2.5 py-1"
              >
                <StatusIcon size={13} aria-hidden />
                {meta.label}
              </Badge>
            </div>

            {/* Date + item-count row: text-xs → text-sm so the meta
             * info reads at the same scale as the ID above. Icons
             * bumped from size=12 to size=14 to keep the glyph
             * proportional to the text. */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden />
                {formatOrderDate(order.createdAt)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Box size={14} aria-hidden />
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>
          </div>

          {/* Right: amount + chevron */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                Total
              </p>
              {/* Bumped from text-base font-bold → text-lg font-bold
               * so the grand total reads as the card's most
               * important number. tabular-nums keeps the digits
               * aligned across rows in the list. */}
              <p className="text-lg font-bold text-slate-900 tabular-nums">
                {formatVND(order.totalAmount)}
              </p>
            </div>
            <ChevronRight
              size={20}
              aria-hidden
              className="text-slate-300 group-hover:text-[#002b5b] group-hover:translate-x-0.5 transition-all"
            />
          </div>
        </div>

        {/* Item preview chips — first 3 line items as small pills */}
        {order.items.length > 0 && (
          <div className="mt-4 flex items-center gap-2 flex-wrap">
            <Package
              size={14}
              className="text-slate-400 shrink-0"
              aria-hidden
            />
            {/* Product names row bumped from text-xs → text-base so
             * the product list reads cleanly at the same scale as
             * the ID / total / date row above. */}
            <span className="text-base text-slate-600 truncate">
              {order.items
                .slice(0, 3)
                .map((it) => it.productName)
                .join(" · ")}
              {order.items.length > 3 && (
                <span className="text-slate-400 text-sm">
                  {" "}
                  +{order.items.length - 3} more
                </span>
              )}
            </span>
          </div>
        )}
      </Link>

      {/* Footer: "Write a Review" CTA. Only on delivered orders. Kept
       * OUTSIDE the `<Link>` so clicking it doesn't navigate to the
       * detail page (the button's own onClick wins). */}
      {canReview && (
        <div className="border-t border-slate-100 px-5 py-3 flex items-center justify-end gap-2">
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Star size={14} aria-hidden />}
            onClick={() => setReviewOpen(true)}
          >
            Write a Review
          </Button>
        </div>
      )}

      {/* The modal is rendered inside the card so each card owns its
       * own modal instance. Closing it doesn't reset the list state. */}
      <WriteReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        order={order}
      />
    </div>
  );
}
