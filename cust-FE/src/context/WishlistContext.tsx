import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { apiFetch } from '../lib/api';
import type { Product } from '../lib/types';

interface WishlistContextValue {
  items: Product[];
  isWishlisted: (productId: number) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);

export const WishlistProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    apiFetch<{ wishlist: Product[] }>('/api/products/wishlist')
      .then((res) => setItems(res.wishlist))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isWishlisted = (productId: number) => items.some((item) => item.id === productId);

  const toggleWishlist = async (product: Product) => {
    if (!user) return;
    const alreadyIn = isWishlisted(product.id);
    try {
      if (alreadyIn) {
        setItems((prev) => prev.filter((item) => item.id !== product.id));
        await apiFetch(`/api/products/wishlist/${product.id}`, { method: 'DELETE' });
      } else {
        setItems((prev) => [...prev, product]);
        await apiFetch('/api/products/wishlist', {
          method: 'POST',
          body: JSON.stringify({ product_id: product.id }),
        });
      }
    } catch {
      // Roll back on failure
      load();
    }
  };

  return (
    <WishlistContext.Provider value={{ items, isWishlisted, toggleWishlist, loading }}>
      {children}
    </WishlistContext.Provider>
  );
};

export const useWishlist = () => {
  const context = useContext(WishlistContext);
  if (context === undefined) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
};
