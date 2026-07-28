import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Menu, LogOut, Heart } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useWishlist } from '../context/WishlistContext';

const Header: React.FC = () => {
  const { state } = useCart();
  const { user, logout } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const navigate = useNavigate();
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAccountClick = () => {
    navigate(user ? '/account/orders' : '/login');
  };

  const handleWishlistClick = () => {
    navigate(user ? '/wishlist' : '/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="/logo-dark.png" alt="Casa Yun" className="h-8 w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Home
            </Link>
            <Link to="/products" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Shop
            </Link>
            <Link to="/visit-us" className="text-gray-700 hover:text-amber-600 transition-colors font-medium">
              Visit Us
            </Link>
          </nav>

          {/* Search Bar */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search furniture..."
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleWishlistClick}
              className="relative text-gray-700 hover:text-amber-600 transition-colors"
              title="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {user && wishlistItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate('/cart')}
              className="relative text-gray-700 hover:text-amber-600 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-amber-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>

            {user && (
              <button
                onClick={handleAccountClick}
                className="text-gray-700 hover:text-amber-600 transition-colors"
                title="My Orders"
              >
                <User className="w-5 h-5" />
              </button>
            )}

            {user && (
              <button
                onClick={logout}
                className="text-gray-700 hover:text-amber-600 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}

            <button className="md:hidden text-gray-700 hover:text-amber-600 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
