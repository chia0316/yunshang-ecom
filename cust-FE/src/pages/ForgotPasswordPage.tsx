import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, ApiError } from '../lib/api';

const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/user/forgetpassword', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="bg-white border border-gray-200 rounded-lg p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password</h1>
        {sent ? (
          <>
            <p className="text-sm text-gray-600 mt-4">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent a link to
              reset your password. The link expires in 1 hour.
            </p>
            <Link
              to="/login"
              className="block text-center w-full mt-6 bg-stone-900 text-white py-3 px-4 rounded-lg hover:bg-stone-800 transition-colors font-semibold"
            >
              Back to Log In
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-6">
              Enter the email on your account and we&apos;ll send you a link to reset your
              password.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-white py-3 px-4 rounded-lg hover:bg-stone-800 transition-colors font-semibold disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </>
        )}
        <p className="text-sm text-gray-600 mt-6 text-center">
          Remembered your password?{' '}
          <Link to="/login" className="text-terracotta-600 hover:text-terracotta-700 font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
