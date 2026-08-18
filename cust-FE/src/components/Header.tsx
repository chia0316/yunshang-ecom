import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search,
  ShoppingCart,
  User,
  Menu,
  LogOut,
  Heart,
  Clock,
  Phone,
} from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";

const OPERATING_HOURS = "Open 24 Hours";
const SUPPORT_NUMBER = "+65 8983 5830";

const Header: React.FC = () => {
  const { state } = useCart();
  const { user, logout } = useAuth();
  const { items: wishlistItems } = useWishlist();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(
    searchParams.get("search") || "",
  );
  const itemCount = state.items.reduce((sum, item) => sum + item.quantity, 0);

  const handleAccountClick = () => {
    navigate(user ? "/account/orders" : "/login");
  };

  const handleWishlistClick = () => {
    navigate(user ? "/wishlist" : "/login");
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    navigate(
      trimmed ? `/products?search=${encodeURIComponent(trimmed)}` : "/products",
    );
  };

  return (
    <header className="bg-stone-900 shadow-sm">
      {/* Info bar */}
      <div className="hidden lg:flex items-center justify-end gap-6 border-b border-stone-800 px-4 py-1.5 text-xs text-stone-400 sm:px-6 lg:px-8">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {OPERATING_HOURS}
        </span>
        <span className="flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" />
          Support: {SUPPORT_NUMBER}
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src="/logo-light.png" alt="Casa Yun" className="h-8 w-auto" />
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/"
              className="text-stone-200 hover:text-terracotta-400 transition-colors font-medium"
            >
              Home
            </Link>
            <Link
              to="/products"
              className="text-stone-200 hover:text-terracotta-400 transition-colors font-medium"
            >
              Shop
            </Link>
            <Link
              to="/visit-us"
              className="text-stone-200 hover:text-terracotta-400 transition-colors font-medium"
            >
              Visit Us
            </Link>
          </nav>

          {/* Search Bar */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex items-center flex-1 max-w-md mx-8"
          >
            <div className="relative w-full">
              <button
                type="submit"
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-stone-400 hover:text-terracotta-400"
                title="Search"
              >
                <Search className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search furniture..."
                className="w-full pl-10 pr-4 py-2 bg-stone-800 border border-stone-700 text-white placeholder:text-stone-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
          </form>

          {/* Actions */}
          <div className="flex items-center space-x-4">
            <button
              onClick={handleWishlistClick}
              className="relative text-stone-200 hover:text-terracotta-400 transition-colors"
              title="Wishlist"
            >
              <Heart className="w-5 h-5" />
              {user && wishlistItems.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-terracotta-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {wishlistItems.length}
                </span>
              )}
            </button>

            <button
              onClick={() => navigate("/cart")}
              className="relative text-stone-200 hover:text-terracotta-400 transition-colors"
            >
              <ShoppingCart className="w-5 h-5" />
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-terracotta-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </button>

            <button
              onClick={handleAccountClick}
              className="text-stone-200 hover:text-terracotta-400 transition-colors"
              title={user ? "My Orders" : "Login"}
            >
              <User className="w-5 h-5" />
            </button>

            {user && (
              <button
                onClick={logout}
                className="text-stone-200 hover:text-terracotta-400 transition-colors"
                title="Log out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            )}

            <button className="md:hidden text-stone-200 hover:text-terracotta-400 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
