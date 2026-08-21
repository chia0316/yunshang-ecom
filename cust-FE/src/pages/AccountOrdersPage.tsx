import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, MapPin, Package, CreditCard, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart, withVariantLabel } from '../context/CartContext';
import { apiFetch, getProductImageUrl } from '../lib/api';
import type { Order, OrderStatus } from '../lib/types';
import AccountNav from '../components/AccountNav';

const STAGES: { key: OrderStatus; label: string }[] = [
  { key: 'pending', label: 'Order Placed' },
  { key: 'paid', label: 'Paid' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending Payment',
  paid: 'Paid',
  processing: 'Processing',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const OrderStatusTimeline: React.FC<{ status: OrderStatus }> = ({ status }) => {
  if (status === 'cancelled') {
    return (
      <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
        This order has been cancelled.
      </div>
    );
  }

  const currentIndex = STAGES.findIndex((s) => s.key === status);

  return (
    <div className="flex items-center">
      {STAGES.map((stage, index) => (
        <React.Fragment key={stage.key}>
          <div className="flex flex-col items-center">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                index <= currentIndex
                  ? 'bg-stone-900 text-white'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {index < currentIndex ? <Check className="h-4 w-4" /> : index + 1}
            </div>
            <span
              className={`mt-1 w-20 text-center text-xs ${
                index <= currentIndex ? 'text-terracotta-700 font-medium' : 'text-gray-400'
              }`}
            >
              {stage.label}
            </span>
          </div>
          {index < STAGES.length - 1 && (
            <div
              className={`h-0.5 flex-1 ${index < currentIndex ? 'bg-stone-900' : 'bg-gray-200'}`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const AccountOrdersPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { addToCart } = useCart();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch<Order[]>(`/api/orders/user/${user.userId}`)
      .then(setOrders)
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  const buyAgain = (order: Order) => {
    order.orderdetails?.forEach((item) => {
      for (let i = 0; i < item.quantity; i++) {
        addToCart({
          id: item.product_id,
          name: item.product
            ? withVariantLabel(item.product.name, item.product.variant_options)
            : `Product #${item.product_id}`,
          price: Number(item.price),
          image: getProductImageUrl(item.product?.image_filenames?.[0]),
          leadTimeDays: 0,
        });
      }
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AccountNav />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">My Orders</h1>

      {loading ? (
        <p className="text-gray-500">Loading orders...</p>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <Package className="mx-auto w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-600 mb-6">You haven&apos;t placed any orders yet.</p>
          <Link to="/products" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between bg-gray-50 px-6 py-4 border-b">
                <div>
                  <p className="font-semibold text-gray-900">Order {order.order_number}</p>
                  <p className="text-sm text-gray-500">
                    Placed on {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-sm font-semibold text-terracotta-700">
                  {STATUS_LABEL[order.status]}
                </span>
              </div>

              {/* Status timeline */}
              <div className="px-6 py-5 border-b">
                <OrderStatusTimeline status={order.status} />
              </div>

              {/* Items */}
              <div className="divide-y">
                {order.orderdetails?.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 px-6 py-4">
                    <img
                      src={getProductImageUrl(item.product?.image_filenames?.[0])}
                      alt={item.product?.name}
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {item.product
                          ? withVariantLabel(item.product.name, item.product.variant_options)
                          : `Product #${item.product_id}`}
                      </p>
                      {item.product?.sku && (
                        <p className="text-xs text-gray-500">SKU: {item.product.sku}</p>
                      )}
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-medium text-gray-900">
                      ${(Number(item.price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Delivery + Payment info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-6 py-4 border-t bg-gray-50 text-sm">
                {order.delivery && (
                  <div className="flex gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">
                        {order.delivery.first_name} {order.delivery.last_name}
                      </p>
                      <p className="text-gray-600">{order.delivery.delivery_address}</p>
                      {order.delivery.delivery_postal && (
                        <p className="text-gray-600">Singapore {order.delivery.delivery_postal}</p>
                      )}
                      <p className="text-gray-600">{order.delivery.contact}</p>
                      {order.delivery.delivery_date && (
                        <p className="text-gray-500 mt-1">
                          Preferred delivery: {new Date(order.delivery.delivery_date).toLocaleDateString()}
                          {order.delivery.delivery_slot && ` (${order.delivery.delivery_slot})`}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {order.payments && order.payments.length > 0 && (
                  <div className="flex gap-2">
                    <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-gray-900">{order.payments[0].method}</p>
                      <p className="text-gray-600 capitalize">{order.payments[0].status}</p>
                      {order.payments[0].paid_at && (
                        <p className="text-gray-500">
                          Paid on {new Date(order.payments[0].paid_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer: total + actions */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div>
                  <span className="text-sm text-gray-600">Order Total: </span>
                  <span className="font-bold text-gray-900">${Number(order.total_price).toFixed(2)}</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => buyAgain(order)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Buy Again
                  </button>
                  <Link
                    to="/products"
                    className="px-4 py-2 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors text-sm font-medium"
                  >
                    Continue Shopping
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountOrdersPage;
