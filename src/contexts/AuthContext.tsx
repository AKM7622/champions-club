"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "FRONT_DESK" | "PRO_SHOP" | "BAR_STAFF" | "CHEF" | "COACH" | "MEMBER" | "HR" | "CAFE_MANAGER" | string;
  staff?: any | null;
  member?: any | null;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  retryAfter?: number;
}

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
  message?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<LoginResult>;
  demoLogin: (email: string) => Promise<LoginResult>;
  changePassword: (currentPassword: string, newPassword: string, confirmPassword: string) => Promise<ChangePasswordResult>;
  logout: () => Promise<void>;
  hasRole: (roles: string[]) => boolean;
  refreshUser: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ success: false, error: "Not initialized" }),
  demoLogin: async () => ({ success: false, error: "Not initialized" }),
  changePassword: async () => ({ success: false, error: "Not initialized" }),
  logout: async () => {},
  hasRole: () => false,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const fetchCurrentUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (
    email: string,
    password?: string,
    rememberMe: boolean = false
  ): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });
      const data = await res.json();

      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      } else {
        return {
          success: false,
          error: data.error || "Authentication failed",
          retryAfter: data.retryAfter,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || "Network error. Please try again.",
      };
    } finally {
      setIsLoading(false);
    }
  };

  const demoLogin = async (email: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, isDemoSwitch: true }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Demo switch failed" };
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to switch persona" };
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<ChangePasswordResult> => {
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });
      const data = await res.json();
      if (data.success) {
        return { success: true, message: data.message || "Password updated successfully." };
      }
      return { success: false, error: data.error || "Failed to update password." };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error while updating password." };
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
    } catch (err) {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const hasRole = (roles: string[]) => {
    if (!user) return false;
    if (user.role === "OWNER") return true; // Owner has super-admin access
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        demoLogin,
        changePassword,
        logout,
        hasRole,
        refreshUser: fetchCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
