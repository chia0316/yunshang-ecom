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
  lead_time_days: number;
  tags: string[];
  image_filenames: string[];
  is_featured: boolean;
  is_active: boolean;
}

export interface OrderDetailItem {
  id: number;
  product_id: number;
  quantity: number;
  price: string;
  product?: Pick<Product, 'name' | 'price' | 'sku' | 'image_filenames'>;
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
  user_id: number;
  total_price: string;
  status: OrderStatus;
  created_at: string;
  orderdetails?: OrderDetailItem[];
  delivery?: OrderDelivery | null;
  payments?: Payment[];
}
