import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const links = [
  { to: '/account/orders', label: 'My Orders' },
  { to: '/account/settings', label: 'Account Settings' },
  { to: '/wishlist', label: 'Wishlist' },
];

const AccountNav: React.FC = () => {
  const location = useLocation();

  return (
    <div className="flex gap-6 border-b border-gray-200 mb-8">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className={`pb-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
            location.pathname === link.to
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
};

export default AccountNav;
