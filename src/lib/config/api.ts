/**
 * API 配置
 * 支持切换 TypeScript 和 Python 后端
 */

// 后端类型
export type BackendType = 'typescript' | 'python';

// 从环境变量读取后端类型
export const BACKEND_TYPE: BackendType = 
  (process.env.NEXT_PUBLIC_BACKEND_TYPE as BackendType) || 'typescript';

// API 端点配置
export const API_ENDPOINTS = {
  typescript: {
    analyze: '/api/analyze-memory',
    sessions: '/api/analyze-memory?action=sessions',
    stats: '/api/analyze-memory?action=stats'
  },
  python: {
    analyze: process.env.NEXT_PUBLIC_PYTHON_API_URL 
      ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/analyze-stream`
      : 'http://localhost:8000/api/analyze-stream',
    analyzeSync: process.env.NEXT_PUBLIC_PYTHON_API_URL
      ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/api/analyze`
      : 'http://localhost:8000/api/analyze',
    health: process.env.NEXT_PUBLIC_PYTHON_API_URL
      ? `${process.env.NEXT_PUBLIC_PYTHON_API_URL}/`
      : 'http://localhost:8000/'
  }
} as const;

// 获取当前使用的 API 端点
export function getApiEndpoint(type?: 'analyze' | 'sessions' | 'stats' | 'health' | 'analyzeSync'): string {
  if (BACKEND_TYPE === 'python') {
    switch (type) {
      case 'health':
        return API_ENDPOINTS.python.health;
      case 'analyzeSync':
        return API_ENDPOINTS.python.analyzeSync;
      default:
        return API_ENDPOINTS.python.analyze;
    }
  }
  
  switch (type) {
    case 'sessions':
      return API_ENDPOINTS.typescript.sessions;
    case 'stats':
      return API_ENDPOINTS.typescript.stats;
    default:
      return API_ENDPOINTS.typescript.analyze;
  }
}

// 输出当前配置
console.log(`[API Config] Backend: ${BACKEND_TYPE}`);
console.log(`[API Config] Analyze endpoint: ${getApiEndpoint('analyze')}`);
