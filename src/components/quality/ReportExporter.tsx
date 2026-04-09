'use client';

import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Download, 
  FileText, 
  Code,
  Copy,
  Check,
  Loader2
} from 'lucide-react';

interface ReportExporterProps {
  analysisData: {
    topic: string;
    [key: string]: any;
  };
  onClose: () => void;
}

export function ReportExporter({ analysisData, onClose }: ReportExporterProps) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'markdown' | 'html' | 'json'>('markdown');
  
  const generateMarkdown = () => {
    const { topic, conclusion, timeline, key_factors, scenarios, causal_chains, searchResults } = analysisData;
    
    let md = `# ${topic}\n\n`;
    md += `> 生成时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    
    if (conclusion) {
      md += `## 核心结论\n\n${conclusion}\n\n`;
    }
    
    if (timeline && timeline.length > 0) {
      md += `## 时间线\n\n`;
      timeline.slice(0, 10).forEach((event: any) => {
        md += `- **${event.time || '未知时间'}**: ${event.event}\n`;
      });
      md += '\n';
    }
    
    if (key_factors && key_factors.length > 0) {
      md += `## 关键因素\n\n`;
      key_factors.forEach((factor: any) => {
        md += `### ${factor.name || factor.factor}\n\n`;
        md += `${factor.impact || ''}\n\n`;
        if (factor.confidence) {
          md += `> 置信度：${Math.round(factor.confidence * 100)}%\n\n`;
        }
      });
    }
    
    if (scenarios && scenarios.length > 0) {
      md += `## 场景推演\n\n`;
      scenarios.forEach((scenario: any) => {
        md += `### ${scenario.name}\n\n`;
        md += `- **概率**: ${scenario.probability}\n`;
        md += `- **影响**: ${scenario.impact || scenario.description}\n`;
        if (scenario.timeframe) {
          md += `- **时间框架**: ${scenario.timeframe}\n`;
        }
        md += '\n';
      });
    }
    
    if (causal_chains && causal_chains.length > 0) {
      md += `## 因果链分析\n\n`;
      causal_chains.forEach((chain: any) => {
        md += `- ${chain.cause} → ${chain.effect}\n`;
        if (chain.confidence) {
          md += `  > 置信度：${Math.round(chain.confidence * 100)}%\n`;
        }
      });
      md += '\n';
    }
    
    if (searchResults && searchResults.length > 0) {
      md += `## 参考来源\n\n`;
      searchResults.slice(0, 10).forEach((source: any, i: number) => {
        md += `${i + 1}. [${source.title || source.source}](${source.url || '#'})\n`;
      });
    }
    
    return md;
  };
  
  const generateHtml = () => {
    const md = generateMarkdown();
    
    // 简单的 Markdown 到 HTML 转换
    let html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${analysisData.topic}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
      line-height: 1.6;
      color: #333;
    }
    h1 { border-bottom: 2px solid #007bff; padding-bottom: 0.5rem; }
    h2 { margin-top: 2rem; border-bottom: 1px solid #eee; padding-bottom: 0.3rem; }
    h3 { margin-top: 1.5rem; }
    blockquote { border-left: 4px solid #007bff; padding-left: 1rem; color: #666; }
    code { background: #f4f4f4; padding: 0.2rem 0.4rem; border-radius: 3px; }
    a { color: #007bff; }
    .header { background: #f8f9fa; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
  </style>
</head>
<body>
  <div class="header">
    <small>生成时间：${new Date().toLocaleString('zh-CN')}</small>
  </div>
`;
    
    // 转换 Markdown
    html += md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/^\- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[hupobl])/gm, '<p>')
      .replace(/([^>])$/gm, '$1</p>');
    
    html += `
</body>
</html>`;
    
    return html;
  };
  
  const generateJson = () => {
    return JSON.stringify({
      topic: analysisData.topic,
      generatedAt: new Date().toISOString(),
      conclusion: analysisData.conclusion,
      timeline: analysisData.timeline,
      keyFactors: analysisData.key_factors,
      scenarios: analysisData.scenarios,
      causalChains: analysisData.causal_chains,
      searchResults: analysisData.searchResults?.slice(0, 20)
    }, null, 2);
  };
  
  const getExportContent = () => {
    switch (activeTab) {
      case 'markdown':
        return generateMarkdown();
      case 'html':
        return generateHtml();
      case 'json':
        return generateJson();
    }
  };
  
  const handleCopy = async () => {
    const content = getExportContent();
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleDownload = () => {
    const content = getExportContent();
    const ext = activeTab === 'markdown' ? 'md' : activeTab === 'html' ? 'html' : 'json';
    const mimeType = activeTab === 'html' ? 'text/html' : 'text/plain';
    
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${analysisData.topic.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleSaveToCloud = async () => {
    setExporting(true);
    try {
      const content = getExportContent();
      const format = activeTab === 'markdown' ? 'markdown' : activeTab === 'html' ? 'html' : 'markdown';
      
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: analysisData.caseId || `case_${Date.now()}`,
          topic: analysisData.topic,
          content,
          format,
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        alert(`报告已保存到云存储！\n\n文件: ${result.data.filename}`);
      } else {
        throw new Error(result.error || '保存失败');
      }
    } catch (error: any) {
      console.error('Save to cloud error:', error);
      alert(`保存失败: ${error.message}`);
    } finally {
      setExporting(false);
    }
  };
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            导出报告
          </DialogTitle>
          <DialogDescription>
            选择格式后下载或复制内容
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 格式选择 */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid grid-cols-3 h-9">
              <TabsTrigger value="markdown" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Markdown
              </TabsTrigger>
              <TabsTrigger value="html" className="text-xs">
                <Code className="h-3 w-3 mr-1" />
                HTML
              </TabsTrigger>
              <TabsTrigger value="json" className="text-xs">
                <Code className="h-3 w-3 mr-1" />
                JSON
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* 预览 */}
          <ScrollArea className="h-[300px] border rounded-lg">
            <pre className="p-4 text-sm whitespace-pre-wrap font-mono">
              {getExportContent()}
            </pre>
          </ScrollArea>
          
          {/* 操作按钮 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  已复制
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  复制
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleSaveToCloud} disabled={exporting}>
              {exporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  保存到云端
                </>
              )}
            </Button>
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              下载文件
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
