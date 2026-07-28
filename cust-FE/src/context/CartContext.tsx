import React, { createContext, useContext, useEffect, useReducer, ReactNode } from 'react';
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
  | { type: 'ADD_TO_CART'; payload: Omit<CartItem, 'quantity'> }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_QUANTITY'; payload: { id: number; quantity: number } }
  | { type: 'APPLY_COUPON'; payload: string }
  | { type: 'REMOVE_COUPON' }
  | { type: 'CLEAR_CART' }
  | { type: 'HYDRATE'; payload: CartState };

interface CartContextValue {
  state: CartState;
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
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
          item.id === action.payload.id ? { ...item, quantity: item.quantity + 1 } : item
        );
        return { ...state, items: updatedItems, total: calcTotal(updatedItems) };
      }

      const newItems = [...state.items, { ...action.payload, quantity: 1 }];
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
  };
}

const toCartItem = (row: ServerCartRow): CartItem => ({
  id: row.product.id,
  name: row.product.name,
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
    const guestItems: CartItem[] = stored ? JSON.parse(stored).items || [] : [];

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
        dispatch({ type: 'HYDRATE', payload: { items, total: calcTotal(items), couponCode: null } });
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

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    dispatch({ type: 'ADD_TO_CART', payload: item });
    if (user) {
      apiFetch('/api/cart', {
        method: 'POST',
        body: JSON.stringify({ product_id: item.id, quantity: 1 }),
      }).catch(() => undefined);
    }
  };

  const removeFromCart = (id: number) => {
    dispatch({ type: 'REMOVE_FROM_CART', payload: id });
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
