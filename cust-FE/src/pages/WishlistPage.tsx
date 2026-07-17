import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Heart, ShoppingCart } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { getProductImageUrl } from '../lib/api';
import AccountNav from '../components/AccountNav';

const WishlistPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { items, loading, toggleWishlist } = useWishlist();
  const { dispatch } = useCart();

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AccountNav />
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Wishlist</h1>

      {loading ? (
        <p className="text-gray-500">Loading wishlist...</p>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <Heart className="mx-auto w-12 h-12 text-gray-300 mb-4" />
          <p className="text-gray-600 mb-6">Your wishlist is empty.</p>
          <Link to="/products" className="text-amber-600 hover:text-amber-700 font-medium">
            Browse products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((product) => {
            const effectivePrice = product.sale_price
              ? Number(product.sale_price)
              : Number(product.price);
            return (
              <div
                key={product.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden group"
              >
                <div className="relative aspect-square">
                  <img
                    src={getProductImageUrl(product.image_filenames[0])}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => toggleWishlist(product)}
                    className="absolute top-3 right-3 p-2 bg-white bg-opacity-90 rounded-full hover:bg-opacity-100 transition-all"
                    title="Remove from wishlist"
                  >
                    <Heart className="w-4 h-4 text-red-500 fill-current" />
                  </button>
                </div>
                <div className="p-4">
                  <Link to={`/product/${product.id}`}>
                    <h3 className="font-semibold text-gray-900 hover:text-amber-600 transition-colors mb-2">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-lg font-bold text-gray-900 mb-3">
                    ${effectivePrice.toFixed(2)}
                  </p>
                  <button
                    onClick={() =>
                      dispatch({
                        type: 'ADD_TO_CART',
                        payload: {
                          id: product.id,
                          name: product.name,
                          price: effectivePrice,
                          image: getProductImageUrl(product.image_filenames[0]),
                          leadTimeDays: product.lead_time_days,
                        },
                      })
                    }
                    disabled={product.stock_qty === 0}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white py-2 rounded-lg hover:bg-amber-700 transition-colors font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    {product.stock_qty === 0 ? 'Out of Stock' : 'Add to Cart'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
