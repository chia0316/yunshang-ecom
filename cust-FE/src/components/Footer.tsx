import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-stone-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <img src="/logo-light.png" alt="Casa Yun" className="h-8 w-auto" />
            <p className="text-gray-300 text-sm leading-relaxed">
              Crafting beautiful furniture for modern homes. Quality, style, and comfort in every piece.
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Quick Links</h3>
            <div className="space-y-2">
              <Link to="/products" className="block text-gray-300 hover:text-terracotta-400 transition-colors text-sm">
                All Products
              </Link>
              <Link to="/account/orders" className="block text-gray-300 hover:text-terracotta-400 transition-colors text-sm">
                Track Order
              </Link>
            </div>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Customer Service</h3>
            <div className="space-y-2">
              <Link to="/visit-us" className="block text-gray-300 hover:text-terracotta-400 transition-colors text-sm">
                Contact Us
              </Link>
              <a href="#" className="block text-gray-300 hover:text-terracotta-400 transition-colors text-sm">
                Shipping Info
              </a>
              <Link to="/terms" className="block text-gray-300 hover:text-terracotta-400 transition-colors text-sm">
                Terms &amp; Conditions
              </Link>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Contact</h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-terracotta-400" />
                <span className="text-gray-300 text-sm">Singapore</span>
              </div>
              <div className="flex items-center space-x-2">
                <Phone className="w-4 h-4 text-terracotta-400" />
                <span className="text-gray-300 text-sm">+65 6123 4567</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-terracotta-400" />
                <span className="text-gray-300 text-sm">admin@yunshang.com.sg</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-stone-700 mt-8 pt-8 text-center">
          <p className="text-gray-400 text-sm">
            © 2026 Casa Yun. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
