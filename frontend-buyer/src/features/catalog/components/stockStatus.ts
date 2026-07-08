// Stock-status display constants shared by VariantPicker and StockBadge.
export const STOCK_LABEL: Record<string, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
};

export const STOCK_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'danger',
};
