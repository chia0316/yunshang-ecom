import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';

const SignupPage: React.FC = () => {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: '',
    password: '',
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    deliveryAddress: '',
    deliveryPostal: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [conflictFields, setConflictFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Once the customer edits a flagged field, drop the "already taken"
    // highlight for it — it no longer reflects what they've typed.
    if (conflictFields.includes(e.target.name)) {
      setConflictFields((prev) => prev.filter((f) => f !== e.target.name));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setConflictFields([]);
    setLoading(true);
    try {
      await signup(form);
      navigate('/account/orders');
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setConflictFields(err.fields || []);
      } else {
        setError(err instanceof Error ? err.message : 'Sign up failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (name: string) =>
    `w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
      conflictFields.includes(name)
        ? 'border-red-400 focus:ring-red-400'
        : 'border-gray-200 focus:ring-terracotta-500'
    }`;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create Account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name *</label>
              <input
                name="firstName"
                value={form.firstName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name *</label>
              <input
                name="lastName"
                value={form.lastName}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username *</label>
            <input
              name="username"
              value={form.username}
              onChange={handleChange}
              required
              minLength={5}
              className={fieldClass('username')}
            />
            {conflictFields.includes('username') && (
              <p className="text-xs text-red-600 mt-1">This username is already taken.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email *</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className={fieldClass('email')}
            />
            {conflictFields.includes('email') && (
              <p className="text-xs text-red-600 mt-1">This email is already registered.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
            <input
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password *</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              title="Minimum eight characters, at least one letter, one number and one special character"
              pattern="(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Min. 8 characters with a letter, a number, and a special character (@$!%*#?&).
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
            <input
              name="deliveryAddress"
              value={form.deliveryAddress}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
            <input
              name="deliveryPostal"
              value={form.deliveryPostal}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-stone-900 text-white py-3 px-4 rounded-lg hover:bg-stone-800 transition-colors font-semibold disabled:opacity-50"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>
        <p className="text-sm text-gray-600 mt-6 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignupPage;
