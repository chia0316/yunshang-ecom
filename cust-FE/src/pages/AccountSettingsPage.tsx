import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import AccountNav from '../components/AccountNav';

interface Profile {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string | null;
  deliveryAddress: string | null;
  deliveryPostal: string | null;
}

const AccountSettingsPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (!user) return;
    apiFetch<{ data: Profile }>('/user/user-data')
      .then(({ data }) => setProfile(data))
      .finally(() => setLoading(false));
  }, [user]);

  if (!authLoading && !user) {
    return <Navigate to="/login" replace />;
  }

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!profile) return;
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      await apiFetch('/user/update', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: profile.firstName,
          lastName: profile.lastName,
          mobile: profile.mobile,
          deliveryAddress: profile.deliveryAddress,
          deliveryPostal: profile.deliveryPostal,
        }),
      });
      setProfileSuccess(true);
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirmation do not match');
      return;
    }
    setSavingPassword(true);
    try {
      await apiFetch('/user/update-password', {
        method: 'PUT',
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      setPasswordSuccess(true);
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-gray-500">
        Loading account...
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <AccountNav />
      <div className="space-y-8">
      <h1 className="text-3xl font-bold text-gray-900">Account Settings</h1>

      {/* Profile */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Profile</h2>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
              <input
                type="text"
                name="firstName"
                value={profile.firstName}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
              <input
                type="text"
                name="lastName"
                value={profile.lastName}
                onChange={handleProfileChange}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={profile.username}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Mobile</label>
            <input
              type="tel"
              name="mobile"
              value={profile.mobile || ''}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Delivery Address</label>
            <input
              type="text"
              name="deliveryAddress"
              value={profile.deliveryAddress || ''}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
            <input
              type="text"
              name="deliveryPostal"
              value={profile.deliveryPostal || ''}
              onChange={handleProfileChange}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          {profileSuccess && <p className="text-sm text-green-600">Profile updated successfully.</p>}
          <button
            type="submit"
            disabled={savingProfile}
            className="px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium disabled:opacity-50"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </div>

      {/* Password */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Change Password</h2>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
            <input
              type="password"
              required
              value={passwordForm.currentPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
            <input
              type="password"
              required
              pattern="(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}"
              title="Minimum eight characters, at least one letter, one number and one special character"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
            <input
              type="password"
              required
              value={passwordForm.confirmPassword}
              onChange={(e) =>
                setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-terracotta-500 focus:border-transparent"
            />
          </div>
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          {passwordSuccess && <p className="text-sm text-green-600">Password updated successfully.</p>}
          <button
            type="submit"
            disabled={savingPassword}
            className="px-6 py-3 bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors font-medium disabled:opacity-50"
          >
            {savingPassword ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
};

export default AccountSettingsPage;
