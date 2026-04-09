/**
 * 认证服务
 * 
 * 提供用户认证、权限验证功能
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';
import { cookies } from 'next/headers';
import { User } from '@/types/user';

// JWT 简化实现（生产环境应使用 jose 或 jsonwebtoken 库）
const JWT_SECRET = process.env.JWT_SECRET || 'openxrec-secret-key-change-in-production';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7天

// ==================== 类型定义 ====================

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  full_name?: string;
  avatar_url?: string;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  token?: string;
  error?: string;
}

export interface PermissionCheck {
  canAddKnowledge: boolean;
  canEditKnowledge: boolean;
  canDeleteKnowledge: boolean;
  canReviewKnowledge: boolean;
  canManageUsers: boolean;
  canViewAdminPanel: boolean;
}

// ==================== Token 工具函数 ====================

// Base64 编码
function base64Encode(str: string): string {
  return Buffer.from(str).toString('base64url');
}

// Base64 解码
function base64Decode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf-8');
}

// 简单签名（生产环境应使用 HMAC）
function sign(data: string): string {
  // 简化的签名实现
  const hash = data.split('').reduce((acc, char, i) => {
    return acc ^ (char.charCodeAt(0) * (i + 1) * 31);
  }, 0xDEADBEEF);
  return base64Encode(hash.toString(16));
}

// 生成 Token
function generateToken(userId: string, email: string, role: string): string {
  const payload = {
    userId,
    email,
    role,
    exp: Date.now() + TOKEN_EXPIRY,
    iat: Date.now(),
  };
  const payloadStr = JSON.stringify(payload);
  const encodedPayload = base64Encode(payloadStr);
  const signature = sign(payloadStr);
  return `${encodedPayload}.${signature}`;
}

// 验证 Token
function verifyToken(token: string): { userId: string; email: string; role: string } | null {
  try {
    const [encodedPayload, signature] = token.split('.');
    if (!encodedPayload || !signature) return null;

    const payloadStr = base64Decode(encodedPayload);
    
    // 验证签名
    const expectedSignature = sign(payloadStr);
    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(payloadStr);
    
    // 检查过期
    if (payload.exp < Date.now()) return null;

    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// ==================== 认证服务类 ====================

class AuthService {
  private currentUser: AuthUser | null = null;

  /**
   * 从请求头获取当前用户（服务端）
   */
  async getCurrentUserFromRequest(): Promise<AuthUser | null> {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token')?.value;
      
      if (!token) return null;
      
      const payload = verifyToken(token);
      if (!payload) return null;

      // 从数据库获取最新用户信息
      const supabase = getSupabaseClient();
      if (!supabase) return null;

      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, username, role, full_name, avatar_url')
        .eq('id', payload.userId)
        .eq('is_active', true)
        .single();

      if (error || !user) return null;

      return {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        full_name: user.full_name,
        avatar_url: user.avatar_url,
      };
    } catch (error) {
      console.error('[AuthService] Get current user error:', error);
      return null;
    }
  }

  /**
   * 用户登录
   */
  async login(email: string, password: string): Promise<AuthResult> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { success: false, error: '数据库连接失败' };
      }

      // 查找用户
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      if (error || !user) {
        return { success: false, error: '邮箱或密码错误' };
      }

      // 验证密码（简化实现，生产环境应使用 bcrypt）
      // 这里使用简单的哈希比较
      const passwordHash = this.hashPassword(password);
      if (user.password_hash !== passwordHash) {
        return { success: false, error: '邮箱或密码错误' };
      }

      // 更新最后登录时间
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      // 生成 token
      const token = generateToken(user.id, user.email, user.role);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          full_name: user.full_name,
          avatar_url: user.avatar_url,
        },
        token,
      };
    } catch (error) {
      console.error('[AuthService] Login error:', error);
      return { success: false, error: '登录失败，请稍后重试' };
    }
  }

  /**
   * 用户注册
   */
  async register(email: string, username: string, password: string, fullName?: string): Promise<AuthResult> {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) {
        return { success: false, error: '数据库连接失败' };
      }

      // 检查邮箱是否已存在
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return { success: false, error: '该邮箱已被注册' };
      }

      // 检查用户名是否已存在
      const { data: existingUsername } = await supabase
        .from('users')
        .select('id')
        .eq('username', username)
        .single();

      if (existingUsername) {
        return { success: false, error: '该用户名已被使用' };
      }

      // 创建用户
      const passwordHash = this.hashPassword(password);
      const userId = this.generateUserId();

      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          id: userId,
          email,
          username,
          password_hash: passwordHash,
          full_name: fullName,
          role: 'user', // 默认普通用户
          is_active: true,
          email_verified: false,
        })
        .select()
        .single();

      if (error) {
        console.error('[AuthService] Insert error:', error);
        return { success: false, error: '注册失败，请稍后重试' };
      }

      // 生成 token
      const token = generateToken(newUser.id, newUser.email, newUser.role);

      return {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          username: newUser.username,
          role: newUser.role,
          full_name: newUser.full_name,
        },
        token,
      };
    } catch (error) {
      console.error('[AuthService] Register error:', error);
      return { success: false, error: '注册失败，请稍后重试' };
    }
  }

  /**
   * 获取用户权限
   */
  getPermissions(user: AuthUser | null): PermissionCheck {
    if (!user) {
      // 未登录用户
      return {
        canAddKnowledge: false,
        canEditKnowledge: false,
        canDeleteKnowledge: false,
        canReviewKnowledge: false,
        canManageUsers: false,
        canViewAdminPanel: false,
      };
    }

    const isAdmin = user.role === 'admin';

    return {
      canAddKnowledge: true,      // 登录用户都可以添加
      canEditKnowledge: isAdmin,  // 仅管理员可编辑
      canDeleteKnowledge: isAdmin, // 仅管理员可删除
      canReviewKnowledge: isAdmin, // 仅管理员可审核
      canManageUsers: isAdmin,    // 仅管理员可管理用户
      canViewAdminPanel: isAdmin, // 仅管理员可访问后台
    };
  }

  /**
   * 设置当前用户（客户端）
   */
  setCurrentUser(user: AuthUser | null) {
    this.currentUser = user;
  }

  /**
   * 获取当前用户（客户端缓存）
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * 生成用户ID
   */
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 简单密码哈希（生产环境应使用 bcrypt）
   */
  private hashPassword(password: string): string {
    // 简化的哈希实现
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
      const char = password.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return base64Encode(`${hash}_${password.length}_${password.split('').reverse().slice(0, 4).join('')}`);
  }
}

// 单例
export const authService = new AuthService();

// ==================== API 辅助函数 ====================

/**
 * 从请求中获取用户（API路由使用）
 */
export async function getUserFromRequest(request: Request): Promise<AuthUser | null> {
  // 先从 Authorization header 获取
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = verifyToken(token);
    if (payload) {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: user } = await supabase
          .from('users')
          .select('id, email, username, role, full_name, avatar_url')
          .eq('id', payload.userId)
          .eq('is_active', true)
          .single();
        
        if (user) {
          return {
            id: user.id,
            email: user.email,
            username: user.username,
            role: user.role,
            full_name: user.full_name,
            avatar_url: user.avatar_url,
          };
        }
      }
    }
  }

  // 从 cookie 获取
  return authService.getCurrentUserFromRequest();
}

/**
 * 检查用户是否为管理员
 */
export async function requireAdmin(request: Request): Promise<{ user: AuthUser } | { error: string }> {
  const user = await getUserFromRequest(request);
  
  if (!user) {
    return { error: '未登录' };
  }
  
  if (user.role !== 'admin') {
    return { error: '需要管理员权限' };
  }
  
  return { user };
}

/**
 * 检查用户是否登录
 */
export async function requireAuth(request: Request): Promise<{ user: AuthUser } | { error: string }> {
  const user = await getUserFromRequest(request);
  
  if (!user) {
    return { error: '请先登录' };
  }
  
  return { user };
}
