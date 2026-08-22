export interface Category {
  id: number;
  name: string;
  sub: string | null;
  description: string | null;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  brand: string | null;
  category_id: number;
  category?: Category;
  short_description: string | null;
  description: string | null;
  price: string;
  sale_price: string | null;
  stock_qty: number;
  weight_kg: string | null;
  dimensions: string | null;
  lead_time_days: number;
  tags: string[];
  image_filenames: string[];
  video_filename: string | null;
  featured_tag_id: number | null;
  featured_tag?: { id: number; label: string } | null;
  product_handle: string | null;
  variant_options: Record<string, string> | null;
  is_active: boolean;
  // Only present when fetched via ?grouped=true (product listing pages).
  variant_count?: number;
  min_price?: number;
  max_price?: number;
  // Only present on the single-product detail fetch — sibling variants
  // (including this one) sharing the same product_handle.
  variants?: ProductVariant[];
}

// Sibling variant, returned in Product.variants from the single-product
// fetch — powers the variant switcher on the product detail page.
export interface ProductVariant {
  id: number;
  sku: string;
  price: string;
  sale_price: string | null;
  stock_qty: number;
  variant_options: Record<string, string> | null;
  image_filenames: string[];
}

export interface OrderDetailItem {
  id: number;
  product_id: number;
  quantity: number;
  price: string;
  product?: Pick<Product, 'name' | 'price' | 'sku' | 'image_filenames' | 'variant_options'>;
}

export interface AvailableCoupon {
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_order_amount: number | null;
  remaining_uses: number | null;
  expires_at: string | null;
}

export interface DeliverySlot {
  id: number;
  name: string;
  time_range: string | null;
  sort_order: number;
}

export interface OrderDelivery {
  id: number;
  order_id: number;
  first_name: string;
  last_name: string;
  delivery_address: string;
  delivery_postal: string | null;
  delivery_date: string | null;
  delivery_slot: string | null;
  contact: string;
  remarks: string | null;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: string;
  currency: string;
  method: 'PayNow' | 'NETS' | 'Card' | 'Cash';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  paid_at: string | null;
}

export type OrderStatus = 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: number;
  order_number: string;
  user_id: number;
  total_price: string;
  status: OrderStatus;
  created_at: string;
  orderdetails?: OrderDetailItem[];
  delivery?: OrderDelivery | null;
  payments?: Payment[];
}
