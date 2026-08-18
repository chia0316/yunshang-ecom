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
  is_featured: boolean;
  is_active: boolean;
  createdAt: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string | null;
  isAdmin: boolean;
  status: "Active" | "Suspended";
  deliveryAddress: string | null;
  deliveryPostal: string | null;
  createdAt: string;
  orderCount?: number;
  totalSpent?: number;
}

export interface OrderDetailItem {
  id: number;
  product_id: number;
  quantity: number;
  price: string;
  product?: Pick<Product, "name" | "price" | "sku" | "image_filenames">;
}

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

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
  method: "PayNow" | "NETS" | "Card" | "Cash";
  gateway_reference: string | null;
  status: "pending" | "completed" | "failed" | "refunded";
  paid_at: string | null;
}

export interface Order {
  id: number;
  user_id: number;
  total_price: string;
  status: OrderStatus;
  confirmation_email_sent: boolean;
  coupon_code: string | null;
  discount_amount: string | null;
  created_at: string;
  user?: Pick<User, "firstName" | "lastName" | "email" | "mobile">;
  orderdetails?: OrderDetailItem[];
  delivery?: OrderDelivery | null;
  payments?: Payment[];
}

export interface Coupon {
  id: number;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: string;
  min_order_amount: string | null;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  visibility: "public" | "exclusive";
  createdAt: string;
}

export type EnquiryType = "appointment" | "appointment_no_sales" | "enquiry" | "other";
export type EnquiryStatus = "new" | "contacted" | "closed";

export interface Enquiry {
  id: number;
  type: EnquiryType;
  name: string;
  email: string;
  mobile: string | null;
  preferred_date: string | null;
  preferred_time: string | null;
  message: string | null;
  status: EnquiryStatus;
  createdAt: string;
}

export interface CategoryFulfillmentReport {
  range: { from: string; to: string };
  categories: {
    categoryId: number;
    categoryName: string;
    quantityOrdered: number;
    quantityDelivered: number;
    balance: number;
  }[];
}

export interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  uen: string;
  gst: { enabled: boolean; rate: number };
}

export interface OrderDocument {
  order: Order;
  delivery: OrderDelivery | null;
  payments: Payment[];
  company: CompanySettings;
}

export interface BulkUploadReportRow {
  row: number;
  sku: string;
  status: "created" | "updated" | "error";
  message?: string;
  imageIssues?: string[];
}

export interface ZipReportEntry {
  filename: string;
  status: "skipped" | "overwritten";
  reason: string;
}

export interface BulkUploadResponse {
  summary: {
    total: number;
    created: number;
    updated: number;
    errors: number;
  };
  report: BulkUploadReportRow[];
  zipReport?: ZipReportEntry[];
}

export interface DeliverySlot {
  id: number;
  name: string;
  time_range: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface SalesReport {
  range: { from: string; to: string; groupBy: "day" | "week" | "month" };
  summary: {
    orderCount: number;
    totalRevenue: number;
    averageOrderValue: number;
  };
  series: { period: string; orderCount: number; revenue: number }[];
  topProducts: {
    productId: number;
    name: string;
    sku: string;
    unitsSold: number;
    revenue: number;
  }[];
}
