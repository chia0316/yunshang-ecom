import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { apiFetch, ApiError } from '../lib/api';

interface CustomerUser {
  userId: number;
  username: string;
  firstName: string;
}

interface SignupPayload {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile?: string;
  deliveryAddress?: string;
  deliveryPostal?: string;
}

interface AuthContextValue {
  user: CustomerUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = 'yunshang_token';
const USER_KEY = 'yunshang_user';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem(USER_KEY);
    const token = localStorage.getItem(TOKEN_KEY);
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const data = await apiFetch<{
      userId: number;
      username: string;
      firstName: string;
      token: string;
    }>('/user/login/notoken', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ username, password }),
    });

    const customer: CustomerUser = {
      userId: data.userId,
      username: data.username,
      firstName: data.firstName,
    };
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(customer));
    setUser(customer);
  };

  const signup = async (payload: SignupPayload) => {
    await apiFetch('/user/signup/notoken', {
      method: 'POST',
      auth: false,
      body: JSON.stringify(payload),
    });
    await login(payload.username, payload.password);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
