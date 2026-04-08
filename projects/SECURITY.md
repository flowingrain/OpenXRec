# 安全策略

## 📋 支持的版本

| 版本 | 支持状态 |
|------|----------|
| v2.x | ✅ 支持 |
| v1.x | ⚠️ 仅修复关键安全漏洞 |

## 🔒 报告安全漏洞

### 如何报告

如果您发现安全漏洞，**请不要公开 Issue**，而是通过以下方式报告：

- **邮箱**：security@your-domain.com
- **邮件主题**：[安全漏洞] 漏洞描述

### 报告内容

请提供以下信息：

- 漏洞描述（详细说明）
- 受影响的版本
- 复现步骤
- 潜在影响
- 建议修复方案（可选）

### 响应流程

1. **48 小时内**：确认收到报告
2. **7 天内**：评估漏洞并制定修复计划
3. **30 天内**：修复漏洞并发布补丁
4. **30-90 天**：公开漏洞详情（如果已修复）

### 奖励

对于发现重大安全漏洞的贡献者，我们会：
- 在安全公告中致谢
- 提供项目周边礼品（可选）

---

## 🛡️ 安全最佳实践

### 开发者

1. **不要提交敏感信息**
   - 密钥、密码、Token
   - API 密钥
   - 数据库凭证

2. **使用环境变量**
   ```typescript
   // ✅ 正确
   const apiKey = process.env.API_KEY;

   // ❌ 错误
   const apiKey = 'hardcoded-key';
   ```

3. **验证用户输入**
   - 所有用户输入必须验证和清理
   - 使用 TypeScript 类型检查
   - 使用 Supabase 的 RLS 策略

4. **依赖管理**
   - 定期更新依赖：`pnpm update`
   - 使用 `npm audit` 检查安全漏洞
   - 及时修复高危漏洞

5. **使用 HTTPS**
   - 生产环境必须使用 HTTPS
   - 配置安全头部

### 部署

1. **环境变量保护**
   - 不要将 `.env.local` 提交到代码仓库
   - 使用 `.env.example` 作为示例
   - 定期轮换密钥

2. **数据库安全**
   - 使用强密码
   - 启用连接加密
   - 配置防火墙规则

3. **CORS 配置**
   - 仅允许可信域名
   - 避免使用 `*` 通配符

---

## 🔐 安全头部

### 推荐配置

```typescript
// next.config.js
const headers = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
  }
]

module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers
      }
    ]
  }
}
```

---

## 📊 已知安全漏洞

### 漏洞公告

我们会在以下渠道发布安全公告：
- GitHub Releases
- 项目主页
- 安全邮件列表

### 漏洞记录

| 日期 | CVE 编号 | 漏洞描述 | 严重程度 | 状态 |
|------|----------|----------|----------|------|
| - | - | - | - | - |

---

## 🤝 协作

### 安全团队

- **安全联系人**：security@your-domain.com
- **安全负责人**：[待指定]
- **安全顾问**：[待指定]

### 第三方审计

我们不定期进行安全审计：
- 内部代码审查
- 第三方安全扫描
- 渗透测试（可选）

---

## 📚 相关资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js 安全指南](https://nextjs.org/docs/security/security-headers)
- [Supabase 安全文档](https://supabase.com/docs/guides/security)
- [Node.js 安全最佳实践](https://github.com/nodejs/security-wg)

---

## ⚠️ 免责声明

本软件按"原样"提供，不提供任何明示或暗示的担保。使用本软件的风险由用户自行承担。

---

**有任何安全问题？请联系：security@your-domain.com**
