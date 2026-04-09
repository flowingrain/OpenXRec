import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lf-coze-web-cdn.coze.cn',
        pathname: '/**',
      },
    ],
  },
  // 禁用 React 严格模式中的一些开发检查（避免 React 19 的已知警告）
  reactStrictMode: false,
  // 禁用某些类型检查以避免 React 19 兼容性问题
  typescript: {
    // 允许构建时跳过类型检查（如果需要）
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
