import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { apiFetch, getProductImageUrl } from '../lib/api';

interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  leadTimeDays: number;
}

interface CartState {
  items: CartItem[];
  total: number;
  couponCode: string | null;
}

type CartAction =
  | { type: 'ADD_TO_CART'; payload: CartItem }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'APPLY_COUPON'; payload: string }
  | { type: 'REMOVE_COUPON' }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartState };

interface CartContextValue {
  state: CartState;
  // quantity defaults to 1 — pass a larger number to add several at once in
  // a single dispatch (and a single toast), instead of calling this in a
  // loop (which used to fire one toast per unit). Pass silent to suppress
  // the toast entirely when the caller wants to show its own summary
  // instead (e.g. re-adding several different products from a past order).
  addToCart: (item: Omit<CartItem, 'quantity'>, quantity?: number, options?: { silent?: boolean }) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  applyCoupon: (code: string) => void;
  removeCoupon: () => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const STORAGE_KEY = 'yunshang_cart';
const emptyState: CartState = { items: [], total: 0, couponCode: null };

const calcTotal = (items: CartItem[]) =>
  items.reduce((sum, item) => sum + item.price * item.quantity, 0);

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case 'HYDRATE':
      return { couponCode: null, ...action.payload };

    case 'ADD_TO_CART': {
      const existingItem = state.items.find((item) => item.id === action.payload.id);

      if (existingItem) {
        const updatedItems = state.items.map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: item.quantity + action.payload.quantity }
            : item
        );
        return { ...state, items: updatedItems, total: calcTotal(updatedItems) };
      }

      const newItems = [...state.items, action.payload];
      return { ...state, items: newItems, total: calcTotal(newItems) };
    }

    case 'REMOVE_FROM_CART': {
      const updatedItems = state.items.filter((item) => item.id !== action.payload);
      return { ...state, items: updatedItems, total: calcTotal(updatedItems) };
    }

    case 'UPDATE_QUANTITY': {
      const updatedItems = state.items
        .map((item) =>
          item.id === action.payload.id
            ? { ...item, quantity: Math.max(0, action.payload.quantity) }
            : item
        )
        .filter((item) => item.quantity > 0);

      return { ...state, items: updatedItems, total: calcTotal(updatedItems) };
    }

    case 'APPLY_COUPON':
      return { ...state, couponCode: action.payload };

    case 'REMOVE_COUPON':
      return { ...state, couponCode: null };

    case 'CLEAR_CART':
      return { items: [], total: 0, couponCode: null };

    default:
      return state;
  }
};

interface ServerCartRow {
  product_id: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: string;
    sale_price: string | null;
    image_filenames: string[];
    lead_time_days: number;
    variant_options: Record<string, string> | null;
  };
}

// Appends the variant's distinguishing detail to the product name (e.g.
// "Sofa - 5279 L Shape — Solana") so cart/order line items don't show
// identical names for different variants of the same product.
export const withVariantLabel = (
  name: string,
  variantOptions: Record<string, string> | null | undefined
) => {
  if (!variantOptions || Object.keys(variantOptions).length === 0) return name;
  return `${name} — ${Object.values(variantOptions).join(', ')}`;
};

const toCartItem = (row: ServerCartRow): CartItem => ({
  id: row.product.id,
  name: withVariantLabel(row.product.name, row.product.variant_options),
  price: row.product.sale_price ? Number(row.product.sale_price) : Number(row.product.price),
  image: getProductImageUrl(row.product.image_filenames[0]),
  quantity: row.quantity,
  leadTimeDays: row.product.lead_time_days,
});

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [state, dispatch] = useReducer(cartReducer, emptyState);

  // Guests: cart lives in localStorage only, same as before.
  // Logged in: cart is server-backed (like the wishlist) so it survives
  // logging out/in and switching devices — any items added as a guest are
  // merged into the account cart once, then localStorage is cleared.
  useEffect(() => {
    if (!user) {
      const stored = localStorage.getItem(STORAGE_KEY);
      dispatch({ type: 'HYDRATE', payload: stored ? JSON.parse(stored) : emptyState });
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    const parsedGuestCart = stored ? JSON.parse(stored) : null;
    const guestItems: CartItem[] = parsedGuestCart?.items || [];
    // Carries across both a brand-new signup mid-checkout and an existing
    // user logging in with a guest cart still applied — either way, a
    // coupon they'd already typed in shouldn't silently vanish just
    // because they authenticated.
    const guestCouponCode: string | null = parsedGuestCart?.couponCode || null;

    const sync = async () => {
      if (guestItems.length > 0) {
        await apiFetch('/api/cart/merge', {
          method: 'POST',
          body: JSON.stringify({
            items: guestItems.map((item) => ({ product_id: item.id, quantity: item.quantity })),
          }),
        }).catch(() => undefined);
        localStorage.removeItem(STORAGE_KEY);
      }
      try {
        const res = await apiFetch<{ items: ServerCartRow[] }>('/api/cart');
        const items = res.items.map(toCartItem);
        dispatch({
          type: 'HYDRATE',
          payload: { items, total: calcTotal(items), couponCode: guestCouponCode }
        });
      } catch {
        // Leave state as-is if the account cart couldn't be fetched.
      }
    };
    sync();
  }, [user]);

  // Guests only — logged-in mutations sync straight to the backend instead.
  useEffect(() => {
    if (user) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state, user]);

  const addToCart = (
    item: Omit<CartItem, 'quantity'>,
    quantity = 1,
    options?: { silent?: boolean }
  ) => {
    dispatch({ type: 'ADD_TO_CART', payload: { ...item, quantity } });
    if (!options?.silent) {
      toast.success(
        quantity > 1 ? `Added ${quantity} × "${item.name}" to cart` : `Added "${item.name}" to cart`
      );
    }
    if (user) {
      apiFetch('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ product_id: item.id, quantity }),
      }).catch(() => undefined);
    }
  };

  const removeFromCart = (id: number) => {
    const removedItem = state.items.find((item) => item.id === id);
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
    toast(removedItem ? `Removed "${removedItem.name}" from cart` : 'Removed from cart');
    if (user) {
      apiFetch(`/api/cart/${id}`, { method: 'DELETE' }).catch(() => undefined);
    }
  };

  const updateQuantity = (id: number, quantity: number) => {
    dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    if (user) {
      apiFetch(`/api/cart/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quantity }),
      }).catch(() => undefined);
    }
  };

  const applyCoupon = (code: string) => dispatch({ type: 'APPLY_COUPON', payload: code });
  const removeCoupon = () => dispatch({ type: 'REMOVE_COUPON' });

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
    if (user) {
      apiFetch('/api/cart', { method: 'DELETE' }).catch(() => undefined);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <CartContext.Provider
      value={{ state, addToCart, removeFromCart, updateQuantity, applyCoupon, removeCoupon, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
