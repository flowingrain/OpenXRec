// ============================================================================
// 用户服务 - 用户认证和管理
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type {
  User,
  UserCreate,
  UserUpdate,
  UserSession,
  LoginRequest,
  LoginResponse,
  ApiResponse,
} from '@/types/user';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// ============================================================================
// 密码工具
// ============================================================================

class PasswordUtils {
  /**
   * 哈希密码
   */
  static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * 验证密码
   */
  static async verifyPassword(
    password: string,
    hash: string
  ): Promise<boolean> {
    const hashedPassword = await this.hashPassword(password);
    return hashedPassword === hash;
  }
}

// ============================================================================
// JWT 工具
// ============================================================================

class JwtUtils {
  /**
   * 生成 JWT 令牌
   */
  static async generateToken(userId: string, expiresIn: number = 7 * 24 * 60 * 60 * 1000): Promise<string> {
    const header = {
      alg: 'HS256',
      typ: 'JWT'
    };

    const payload = {
      userId,
      iat: Date.now(),
      exp: Date.now() + expiresIn
    };

    const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = this.base64UrlEncode(JSON.stringify(payload));

    const signatureInput = `${headerEncoded}.${payloadEncoded}`;
    const signature = await this.sign(signatureInput);

    return `${signatureInput}.${signature}`;
  }

  /**
   * 验证 JWT 令牌
   */
  static async verifyToken(token: string): Promise<any | null> {
    try {
      const [headerEncoded, payloadEncoded, signature] = token.split('.');

      const signatureInput = `${headerEncoded}.${payloadEncoded}`;
      const expectedSignature = await this.sign(signatureInput);

      if (signature !== expectedSignature) {
        return null;
      }

      const payload = JSON.parse(this.base64UrlDecode(payloadEncoded));

      // 检查过期时间
      if (payload.exp && payload.exp < Date.now()) {
        return null;
      }

      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * 签名
   */
  private static async sign(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(process.env.JWT_SECRET || 'your-secret-key'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(data)
    );

    return this.base64UrlEncode(signature);
  }

  /**
   * Base64 URL 编码
   */
  private static base64UrlEncode(data: string | ArrayBuffer): string {
    const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  /**
   * Base64 URL 解码
   */
  private static base64UrlDecode(str: string): string {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
  }
}

// ============================================================================
// 用户服务
// ============================================================================

export class UserService {
  /**
   * 用户注册
   */
  static async register(userData: UserCreate): Promise<ApiResponse<User>> {
    try {
      // 检查邮箱是否已存在
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .or(`email.eq.${userData.email},username.eq.${userData.username}`)
        .single();

      if (existingUser) {
        return {
          success: false,
          error: '邮箱或用户名已存在'
        };
      }

      // 哈希密码
      const passwordHash = await PasswordUtils.hashPassword(userData.password);

      // 创建用户
      const { data: user, error } = await supabase
        .from('users')
        .insert({
          email: userData.email,
          username: userData.username,
          password_hash: passwordHash,
          full_name: userData.full_name,
          bio: userData.bio
        })
        .select()
        .single();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      // 创建用户画像
      await supabase.from('user_profiles').insert({
        user_id: user.id
      });

      return {
        success: true,
        data: user,
        message: '注册成功'
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: '注册失败，请稍后重试'
      };
    }
  }

  /**
   * 用户登录
   */
  static async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    try {
      // 查找用户
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', credentials.email)
        .single();

      if (error || !user) {
        return {
          success: false,
          error: '用户不存在'
        };
      }

      // 验证密码
      const isValidPassword = await PasswordUtils.verifyPassword(
        credentials.password,
        user.password_hash
      );

      if (!isValidPassword) {
        return {
          success: false,
          error: '密码错误'
        };
      }

      // 检查用户状态
      if (!user.is_active) {
        return {
          success: false,
          error: '账户已被禁用'
        };
      }

      // 生成令牌
      const token = await JwtUtils.generateToken(user.id);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // 创建会话
      await supabase.from('user_sessions').insert({
        user_id: user.id,
        token,
        expires_at: expiresAt
      });

      // 更新最后登录时间
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);

      // 返回用户信息（不包含密码）
      const { password_hash, ...userWithoutPassword } = user;

      return {
        success: true,
        data: {
          user: userWithoutPassword,
          token,
          expires_at: expiresAt
        },
        message: '登录成功'
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: '登录失败，请稍后重试'
      };
    }
  }

  /**
   * 获取当前用户
   */
  static async getCurrentUser(token: string): Promise<ApiResponse<User>> {
    try {
      const payload = await JwtUtils.verifyToken(token);

      if (!payload || !payload.userId) {
        return {
          success: false,
          error: '无效的令牌'
        };
      }

      // 检查会话是否有效
      const { data: session, error: sessionError } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('token', token)
        .eq('user_id', payload.userId)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (sessionError || !session) {
        return {
          success: false,
          error: '会话已过期'
        };
      }

      // 获取用户信息
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', payload.userId)
        .single();

      if (error || !user) {
        return {
          success: false,
          error: '用户不存在'
        };
      }

      return {
        success: true,
        data: user
      };
    } catch (error) {
      console.error('Get current user error:', error);
      return {
        success: false,
        error: '获取用户信息失败'
      };
    }
  }

  /**
   * 更新用户信息
   */
  static async updateUser(
    userId: string,
    updates: UserUpdate
  ): Promise<ApiResponse<User>> {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error || !user) {
        return {
          success: false,
          error: error?.message || '更新失败'
        };
      }

      return {
        success: true,
        data: user,
        message: '更新成功'
      };
    } catch (error) {
      console.error('Update user error:', error);
      return {
        success: false,
        error: '更新失败，请稍后重试'
      };
    }
  }

  /**
   * 用户登出
   */
  static async logout(token: string): Promise<ApiResponse<void>> {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('token', token);

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        message: '登出成功'
      };
    } catch (error) {
      console.error('Logout error:', error);
      return {
        success: false,
        error: '登出失败'
      };
    }
  }

  /**
   * 修改密码
   */
  static async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<ApiResponse<void>> {
    try {
      // 获取用户当前密码
      const { data: user, error } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (error || !user) {
        return {
          success: false,
          error: '用户不存在'
        };
      }

      // 验证旧密码
      const isValidPassword = await PasswordUtils.verifyPassword(
        oldPassword,
        user.password_hash
      );

      if (!isValidPassword) {
        return {
          success: false,
          error: '旧密码错误'
        };
      }

      // 哈希新密码
      const newPasswordHash = await PasswordUtils.hashPassword(newPassword);

      // 更新密码
      const { error: updateError } = await supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', userId);

      if (updateError) {
        return {
          success: false,
          error: updateError.message
        };
      }

      return {
        success: true,
        message: '密码修改成功'
      };
    } catch (error) {
      console.error('Change password error:', error);
      return {
        success: false,
        error: '密码修改失败'
      };
    }
  }
}
