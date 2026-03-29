import Decimal from "decimal.js";

Decimal.set({
  precision: 20,
});

export const Money = {
  // Add money
  add: (a: number, b: number): number => new Decimal(a).plus(b).toNumber(),

  // Subtract money
  subtract: (a: number, b: number): number =>
    new Decimal(a).minus(b).toNumber(),

  // Multiply money
  multiply: (amount: number, quantity: number): number =>
    new Decimal(amount).times(quantity).toNumber(),

  // Apply discount
  applyDiscount: (amount: number, discountPercent: number): number =>
    new Decimal(amount)
      .times(new Decimal(1).minus(new Decimal(discountPercent).dividedBy(100)))
      .toNumber(),

  // Format display
  format: (amount: number): string =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount),
};
