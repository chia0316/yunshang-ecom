"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { apiFetch, ApiError } from "@/lib/api";

interface AdminUser {
  userId: number;
  username: string;
  firstName: string;
  isAdmin: boolean;
}

interface AuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const TOKEN_KEY = "yunshang_admin_token";
const USER_KEY = "yunshang_admin_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
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
      isAdmin: boolean;
      token: string;
    }>("/user/login/notoken", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ username, password }),
    });

    if (!data.isAdmin) {
      throw new ApiError("This account does not have admin access", 403);
    }

    const adminUser: AdminUser = {
      userId: data.userId,
      username: data.username,
      firstName: data.firstName,
      isAdmin: data.isAdmin,
    };

    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(adminUser));
    setUser(adminUser);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
