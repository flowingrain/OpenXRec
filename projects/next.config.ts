import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  /**
   * 推荐 API 等服务端代码引用 @langchain/langgraph；由 Webpack 打进 bundle 时易出现
   *「Class extends value undefined」（ESM/循环依赖导致基类未解析）。列为外部包由 Node 直接 require/import。
   */
  serverExternalPackages: [
    '@langchain/langgraph',
    '@langchain/core',
    '@langchain/langgraph-checkpoint',
    '@langchain/langgraph-sdk',
    /** 与 create-llm-client 运行时 require 配合，避免 Webpack 打包后类继承链断裂 */
    'coze-coding-dev-sdk',
  ],
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
