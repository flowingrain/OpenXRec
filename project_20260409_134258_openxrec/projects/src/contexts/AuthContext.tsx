'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, LoginRequest, UserCreate } from '@/types/user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<{ success: boolean; error?: string }>;
  register: (userData: UserCreate) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 从 localStorage 获取 token
  const getToken = () => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
  };

  // 保存 token 到 localStorage
  const saveToken = (token: string) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('token', token);
  };

  // 清除 token
  const clearToken = () => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
  };

  // 刷新用户信息
  const refreshUser = async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setUser(result.data);
        } else {
          clearToken();
          setUser(null);
        }
      } else {
        clearToken();
        setUser(null);
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // 登录
  const login = async (credentials: LoginRequest) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();

      if (result.success && result.data) {
        saveToken(result.data.token);
        setUser(result.data.user);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: '登录失败' };
    }
  };

  // 注册
  const register = async (userData: UserCreate) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const result = await response.json();

      if (result.success) {
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: '注册失败' };
    }
  };

  // 登出
  const logout = async () => {
    const token = getToken();
    if (token) {
      try {
        await fetch('/api/auth/me', {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    clearToken();
    setUser(null);
  };

  // 初始化时检查用户状态
  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
