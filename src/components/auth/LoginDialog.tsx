/**
 * 用户认证组件
 * 
 * 提供登录、注册、用户信息展示功能
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  User,
  LogIn,
  LogOut,
  UserPlus,
  Shield,
  Settings,
  Loader2,
  AlertCircle,
} from 'lucide-react';

// ==================== 类型定义 ====================

interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  full_name?: string;
  avatar_url?: string;
}

interface PermissionCheck {
  canAddKnowledge: boolean;
  canEditKnowledge: boolean;
  canDeleteKnowledge: boolean;
  canReviewKnowledge: boolean;
  canManageUsers: boolean;
  canViewAdminPanel: boolean;
}

// ==================== 认证组件 ====================

export function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    fullName: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('login');

  // 检查登录状态
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.user) {
          setUser(data.data.user);
          setPermissions(data.data.permissions);
        }
      }
    } catch (e) {
      console.error('Auth check failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 登录
  const handleLogin = async () => {
    if (!loginForm.email || !loginForm.password) {
      setError('请填写邮箱和密码');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'login',
          email: loginForm.email,
          password: loginForm.password,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUser(data.data.user);
        setDialogOpen(false);
        setLoginForm({ email: '', password: '' });
        router.refresh();
      } else {
        setError(data.error || '登录失败');
      }
    } catch (e) {
      setError('登录失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 注册
  const handleRegister = async () => {
    if (!registerForm.email || !registerForm.username || !registerForm.password) {
      setError('请填写所有必填项');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    if (registerForm.password.length < 6) {
      setError('密码长度至少6位');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          email: registerForm.email,
          username: registerForm.username,
          password: registerForm.password,
          fullName: registerForm.fullName || undefined,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setUser(data.data.user);
        setDialogOpen(false);
        setRegisterForm({
          email: '',
          username: '',
          password: '',
          confirmPassword: '',
          fullName: '',
        });
      } else {
        setError(data.error || '注册失败');
      }
    } catch (e) {
      setError('注册失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  // 登出
  const handleLogout = async () => {
    try {
      await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      setUser(null);
      setPermissions(null);
      router.push('/');
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // 加载中
  if (loading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
      </Button>
    );
  }

  // 未登录
  if (!user) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="default" className="gap-1.5">
            <LogIn className="w-4 h-4" />
            登录
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>欢迎来到 OpenXRec</DialogTitle>
            <DialogDescription>
              登录后可以使用更多功能
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">登录</TabsTrigger>
              <TabsTrigger value="register">注册</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">邮箱</Label>
                <Input
                  id="login-email"
                  type="email"
                  placeholder="your@email.com"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">密码</Label>
                <Input
                  id="login-password"
                  type="password"
                  placeholder="••••••••"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <Button className="w-full" onClick={handleLogin} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                登录
              </Button>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="register-email">邮箱 *</Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="your@email.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-username">用户名 *</Label>
                <Input
                  id="register-username"
                  type="text"
                  placeholder="yourname"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-fullname">姓名</Label>
                <Input
                  id="register-fullname"
                  type="text"
                  placeholder="您的姓名（可选）"
                  value={registerForm.fullName}
                  onChange={(e) => setRegisterForm({ ...registerForm, fullName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-password">密码 *</Label>
                <Input
                  id="register-password"
                  type="password"
                  placeholder="至少6位"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-confirm">确认密码 *</Label>
                <Input
                  id="register-confirm"
                  type="password"
                  placeholder="再次输入密码"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-500">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <Button className="w-full" onClick={handleRegister} disabled={submitting}>
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                注册
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  }

  // 已登录
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <span className="hidden sm:inline">{user.username}</span>
          {user.role === 'admin' && (
            <Badge variant="outline" className="ml-1 bg-blue-50 text-blue-700 border-blue-200">
              管理员
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="font-medium">{user.full_name || user.username}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <DropdownMenuSeparator />

        {permissions?.canViewAdminPanel && (
          <DropdownMenuItem onClick={() => router.push('/admin')}>
            <Shield className="w-4 h-4 mr-2" />
            管理员仪表盘
          </DropdownMenuItem>
        )}

        <DropdownMenuItem onClick={() => router.push('/profile')}>
          <Settings className="w-4 h-4 mr-2" />
          个人设置
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-red-600">
          <LogOut className="w-4 h-4 mr-2" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ==================== Hook: 使用认证 ====================

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<PermissionCheck | null>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch('/api/auth');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.user) {
          setUser(data.data.user);
          setPermissions(data.data.permissions);
          return { user: data.data.user, permissions: data.data.permissions };
        }
      }
      return null;
    } catch (e) {
      console.error('Auth check failed:', e);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return { user, permissions, loading, checkAuth };
}
