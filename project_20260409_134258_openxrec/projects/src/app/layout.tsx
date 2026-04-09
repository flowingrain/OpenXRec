import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'OpenXRec | 可解释推荐系统',
    template: '%s | OpenXRec',
  },
  description:
    'OpenXRec - 开放可解释多智能体推荐框架，支持知识图谱增强、PPO强化学习优化、多种推荐策略融合。',
  keywords: [
    'OpenXRec',
    '可解释推荐',
    '推荐系统',
    '多智能体',
    '知识图谱',
    'PPO强化学习',
    '个性化推荐',
    'LangGraph',
  ],
  authors: [{ name: 'OpenXRec Team' }],
  generator: 'OpenXRec',
  openGraph: {
    title: 'OpenXRec | 可解释推荐系统',
    description:
      '开放可解释多智能体推荐框架，支持知识图谱增强、PPO强化学习优化、多种推荐策略融合。',
    url: process.env.COZE_PROJECT_DOMAIN_DEFAULT || 'https://abc123.dev.coze.site',
    siteName: 'OpenXRec',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
