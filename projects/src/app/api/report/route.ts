import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// 报告模板配置
// ============================================================================

interface ReportSection {
  title: string;
  icon?: string;
  fields: {
    key: string;
    label: string;
    type: 'text' | 'list' | 'table' | 'markdown' | 'confidence' | 'timeline' | 'factors';
  }[];
}

const REPORT_SECTIONS: ReportSection[] = [
  {
    title: '📋 分析概览',
    fields: [
      { key: 'query', label: '分析主题', type: 'text' },
      { key: 'analyzedAt', label: '分析时间', type: 'text' },
      { key: 'confidence', label: '综合置信度', type: 'confidence' }
    ]
  },
  {
    title: '📊 核心结论',
    fields: [
      { key: 'conclusion.summary', label: '总结', type: 'markdown' },
      { key: 'conclusion.recommendation', label: '建议', type: 'text' },
      { key: 'conclusion.riskLevel', label: '风险等级', type: 'text' }
    ]
  },
  {
    title: '⏱️ 时间线',
    fields: [
      { key: 'timeline', label: '关键事件', type: 'timeline' }
    ]
  },
  {
    title: '🎯 关键因素',
    fields: [
      { key: 'key_factors', label: '影响因素', type: 'factors' }
    ]
  },
  {
    title: '🔮 场景推演',
    fields: [
      { key: 'scenarios', label: '可能场景', type: 'list' }
    ]
  },
  {
    title: '🌐 相关地区',
    fields: [
      { key: 'geoLocations', label: '地理分布', type: 'list' }
    ]
  }
];

// ============================================================================
// 报告生成函数
// ============================================================================

function generateMarkdownReport(data: any): string {
  let report = `# 宏观态势感知分析报告\n\n`;
  report += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  // 分析概览
  report += `## 📋 分析概览\n\n`;
  report += `| 项目 | 内容 |\n`;
  report += `|------|------|\n`;
  report += `| 分析主题 | ${data.query || data.topic || '未知'} |\n`;
  report += `| 分析时间 | ${data.analyzedAt || new Date().toLocaleString('zh-CN')} |\n`;
  report += `| 综合置信度 | ${data.confidence ? `${(data.confidence * 100).toFixed(0)}%` : '待评估'} |\n`;
  report += `\n`;
  
  // 核心结论
  if (data.conclusion || data.final_report) {
    report += `## 📊 核心结论\n\n`;
    
    const conclusion = data.conclusion || {};
    if (conclusion.summary || data.final_report) {
      report += `### 总结\n\n`;
      report += `${conclusion.summary || data.final_report || '暂无'}\n\n`;
    }
    
    if (conclusion.recommendation) {
      report += `### 建议\n\n`;
      report += `${conclusion.recommendation}\n\n`;
    }
    
    if (conclusion.riskLevel) {
      report += `### 风险等级\n\n`;
      const riskEmoji = { '高': '🔴', '中': '🟡', '低': '🟢' };
      report += `${riskEmoji[conclusion.riskLevel as keyof typeof riskEmoji] || '⚪'} ${conclusion.riskLevel}\n\n`;
    }
  }
  
  // 时间线
  const timeline = data.timeline || data.timeLine || [];
  if (timeline.length > 0) {
    report += `## ⏱️ 时间线\n\n`;
    timeline.slice(0, 10).forEach((event: any, i: number) => {
      const time = event.time || event.date || `事件 ${i + 1}`;
      const desc = event.event || event.description || event.title || '';
      report += `- **${time}**: ${desc}\n`;
    });
    report += `\n`;
  }
  
  // 关键因素
  const factors = data.key_factors || data.keyFactors || [];
  if (factors.length > 0) {
    report += `## 🎯 关键因素\n\n`;
    report += `| 因素 | 影响方向 | 影响程度 |\n`;
    report += `|------|---------|--------|\n`;
    factors.forEach((factor: any) => {
      const name = factor.name || factor.factor || '';
      const direction = factor.direction || factor.impact_direction || '中性';
      const level = factor.level || factor.impact_level || '中';
      report += `| ${name} | ${direction} | ${level} |\n`;
    });
    report += `\n`;
  }
  
  // 场景推演
  const scenarios = data.scenarios || [];
  if (scenarios.length > 0) {
    report += `## 🔮 场景推演\n\n`;
    scenarios.forEach((scenario: any, i: number) => {
      const name = scenario.name || `场景 ${i + 1}`;
      const prob = scenario.probability || '未知';
      const impact = scenario.impact || scenario.description || '';
      report += `### ${name}\n\n`;
      report += `- **概率**: ${prob}\n`;
      report += `- **影响**: ${impact}\n\n`;
    });
  }
  
  // 因果链
  const causalChains = data.causal_chains || data.causalChain || [];
  if (causalChains.length > 0) {
    report += `## 🔗 因果链分析\n\n`;
    causalChains.forEach((chain: any, i: number) => {
      const cause = chain.cause || '';
      const effect = chain.effect || '';
      const conf = chain.confidence || 0;
      report += `${i + 1}. **${cause}** → **${effect}** (置信度: ${(conf * 100).toFixed(0)}%)\n`;
    });
    report += `\n`;
  }
  
  // 相关地区
  const geoLocations = data.geoLocations || data.geo_locations || [];
  if (geoLocations.length > 0) {
    report += `## 🌐 相关地区\n\n`;
    geoLocations.forEach((loc: any) => {
      const name = loc.name || '';
      const type = loc.type || '';
      const significance = loc.significance || '';
      report += `- **${name}** (${type}): ${significance}\n`;
    });
    report += `\n`;
  }
  
  // 搜索来源
  const searchResults = data.searchResults || data.search_results || [];
  if (searchResults.length > 0) {
    report += `## 📚 参考来源\n\n`;
    searchResults.slice(0, 10).forEach((result: any, i: number) => {
      const title = result.title || result.source || `来源 ${i + 1}`;
      const url = result.url || result.link || '';
      const summary = result.summary || result.snippet || '';
      report += `${i + 1}. [${title}](${url})\n`;
      if (summary) {
        report += `   ${summary.substring(0, 100)}${summary.length > 100 ? '...' : ''}\n`;
      }
    });
    report += `\n`;
  }
  
  // 页脚
  report += `---\n\n`;
  report += `*本报告由智弈全域风险态势感知平台自动生成*\n`;
  
  return report;
}

function generateHTMLReport(data: any): string {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>宏观态势感知分析报告</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1a1a1a;
      border-bottom: 2px solid #3b82f6;
      padding-bottom: 10px;
    }
    h2 {
      color: #374151;
      margin-top: 30px;
      border-left: 4px solid #3b82f6;
      padding-left: 12px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 10px;
      text-align: left;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
    }
    .confidence-bar {
      background: #e5e7eb;
      border-radius: 4px;
      height: 20px;
      overflow: hidden;
    }
    .confidence-fill {
      background: linear-gradient(90deg, #22c55e, #3b82f6);
      height: 100%;
    }
    .scenario-card {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      margin: 12px 0;
    }
    .risk-high { color: #dc2626; }
    .risk-medium { color: #f59e0b; }
    .risk-low { color: #22c55e; }
    .footer {
      text-align: center;
      color: #9ca3af;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌍 宏观态势感知分析报告</h1>
    <p><em>生成时间: ${new Date().toLocaleString('zh-CN')}</em></p>
    
    <h2>📋 分析概览</h2>
    <table>
      <tr><th>分析主题</th><td>${data.query || data.topic || '未知'}</td></tr>
      <tr><th>分析时间</th><td>${data.analyzedAt || new Date().toLocaleString('zh-CN')}</td></tr>
      <tr><th>综合置信度</th><td>${data.confidence ? `${(data.confidence * 100).toFixed(0)}%` : '待评估'}</td></tr>
    </table>
    
    ${(data.conclusion?.summary || data.final_report) ? `
    <h2>📊 核心结论</h2>
    <p>${data.conclusion?.summary || data.final_report}</p>
    ${data.conclusion?.recommendation ? `<p><strong>建议:</strong> ${data.conclusion.recommendation}</p>` : ''}
    ` : ''}
    
    ${(data.timeline || data.timeLine || []).length > 0 ? `
    <h2>⏱️ 时间线</h2>
    <table>
      <tr><th>时间</th><th>事件</th></tr>
      ${(data.timeline || data.timeLine || []).slice(0, 10).map((e: any) => 
        `<tr><td>${e.time || e.date || '-'}</td><td>${e.event || e.description || e.title || '-'}</td></tr>`
      ).join('')}
    </table>
    ` : ''}
    
    ${(data.key_factors || data.keyFactors || []).length > 0 ? `
    <h2>🎯 关键因素</h2>
    <table>
      <tr><th>因素</th><th>影响方向</th><th>影响程度</th></tr>
      ${(data.key_factors || data.keyFactors || []).map((f: any) => 
        `<tr><td>${f.name || f.factor}</td><td>${f.direction || f.impact_direction || '中性'}</td><td>${f.level || f.impact_level || '中'}</td></tr>`
      ).join('')}
    </table>
    ` : ''}
    
    ${(data.scenarios || []).length > 0 ? `
    <h2>🔮 场景推演</h2>
    ${(data.scenarios || []).map((s: any) => `
      <div class="scenario-card">
        <h4>${s.name}</h4>
        <p><strong>概率:</strong> ${s.probability}</p>
        <p><strong>影响:</strong> ${s.impact || s.description}</p>
      </div>
    `).join('')}
    ` : ''}
    
    <div class="footer">
      <p>本报告由智弈全域风险态势感知平台自动生成</p>
    </div>
  </div>
</body>
</html>
`;
}

function generateJSONReport(data: any): string {
  const report = {
    metadata: {
      generatedAt: new Date().toISOString(),
      platform: '智弈全域风险态势感知平台',
      version: '1.1'
    },
    analysis: {
      query: data.query || data.topic,
      analyzedAt: data.analyzedAt,
      confidence: data.confidence
    },
    conclusion: data.conclusion || { summary: data.final_report },
    timeline: data.timeline || data.timeLine || [],
    keyFactors: data.key_factors || data.keyFactors || [],
    scenarios: data.scenarios || [],
    causalChains: data.causal_chains || data.causalChain || [],
    geoLocations: data.geoLocations || data.geo_locations || [],
    searchResults: (data.searchResults || data.search_results || []).slice(0, 20)
  };
  
  return JSON.stringify(report, null, 2);
}

// ============================================================================
// API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data, format = 'markdown' } = body;
    
    if (!data) {
      return NextResponse.json(
        { error: 'Analysis data is required' },
        { status: 400 }
      );
    }
    
    let content: string;
    let contentType: string;
    let extension: string;
    
    switch (format) {
      case 'html':
        content = generateHTMLReport(data);
        contentType = 'text/html';
        extension = 'html';
        break;
      case 'json':
        content = generateJSONReport(data);
        contentType = 'application/json';
        extension = 'json';
        break;
      case 'markdown':
      default:
        content = generateMarkdownReport(data);
        contentType = 'text/markdown';
        extension = 'md';
    }
    
    // 生成文件名
    const timestamp = new Date().toISOString().split('T')[0];
    const topic = (data.query || data.topic || '分析报告').substring(0, 20).replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_');
    const filename = `${topic}_${timestamp}.${extension}`;
    
    return NextResponse.json({
      success: true,
      data: {
        content,
        contentType,
        filename,
        format
      }
    });
  } catch (error) {
    console.error('[Report API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
