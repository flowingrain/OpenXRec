'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FlaskConical,
  Plus,
  Trash2,
  Download,
  Search,
  Star,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  GitCompare,
  Target,
  TrendingUp,
  TrendingDown,
  Minus
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface SandboxEvidence {
  id: string;
  content: string;
  source: string;
  sourceUrl?: string;
  timestamp: string;
  hypothesisId: string;
  type: 'supporting' | 'refuting' | 'neutral';
  strength: number;
  relevance: number;
  userRating?: number;
  userNotes?: string;
  isVerified: boolean;
}

interface SandboxHypothesis {
  id: string;
  statement: string;
  initialConfidence: number;
  currentConfidence: number;
  status: 'active' | 'validated' | 'refuted' | 'inconclusive';
  supportingEvidence: SandboxEvidence[];
  refutingEvidence: SandboxEvidence[];
  neutralEvidence: SandboxEvidence[];
  weight: number;
  competesWith: string[];
  tags: string[];
  source: 'user' | 'system' | 'imported';
  createdAt: string;
  updatedAt: string;
}

interface SandboxState {
  id: string;
  name: string;
  description: string;
  hypotheses: SandboxHypothesis[];
  allEvidence: SandboxEvidence[];
  comparison: {
    leadingHypothesis: string | null;
    confidenceGap: number;
    consensusReached: boolean;
    recommendation: string;
  };
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'active' | 'completed';
}

// ============================================================================
// 主组件
// ============================================================================

export function HypothesisSandboxPanel() {
  const [sandbox, setSandbox] = useState<SandboxState | null>(null);
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 创建沙盒表单
  const [newSandboxName, setNewSandboxName] = useState('');
  const [newSandboxDesc, setNewSandboxDesc] = useState('');
  
  // 添加假设表单
  const [newHypothesis, setNewHypothesis] = useState('');
  const [newConfidence, setNewConfidence] = useState(50);
  
  // 添加证据表单
  const [newEvidence, setNewEvidence] = useState('');
  const [newEvidenceSource, setNewEvidenceSource] = useState('');
  const [newEvidenceUrl, setNewEvidenceUrl] = useState('');
  const [targetHypotheses, setTargetHypotheses] = useState<string[]>([]);
  
  // 搜索证据
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // 展开的假设
  const [expandedHypothesis, setExpandedHypothesis] = useState<string | null>(null);
  
  // ============================================================================
  // API 调用
  // ============================================================================
  
  const apiCall = async (action: string, data?: any, id?: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/sandbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, sandboxId: id || sandboxId, data })
      });
      
      const result = await response.json();
      
      if (result.success && result.data) {
        if (result.data.sandboxId) {
          setSandboxId(result.data.sandboxId);
        }
        if (result.data.state) {
          setSandbox(result.data.state);
        }
      }
      
      return result;
    } catch (error) {
      console.error('API Error:', error);
      return { error: '请求失败' };
    } finally {
      setLoading(false);
    }
  };
  
  // ============================================================================
  // 操作函数
  // ============================================================================
  
  const handleCreateSandbox = async () => {
    if (!newSandboxName.trim()) return;
    
    const result = await apiCall('create', {
      name: newSandboxName,
      description: newSandboxDesc
    });
    
    if (result.success) {
      setNewSandboxName('');
      setNewSandboxDesc('');
    }
  };
  
  const handleAddHypothesis = async () => {
    if (!newHypothesis.trim()) return;
    
    await apiCall('addHypothesis', {
      statement: newHypothesis,
      initialConfidence: newConfidence / 100
    });
    
    setNewHypothesis('');
    setNewConfidence(50);
  };
  
  const handleAddEvidence = async () => {
    if (!newEvidence.trim()) return;
    
    await apiCall('addEvidence', {
      content: newEvidence,
      source: newEvidenceSource || '用户输入',
      sourceUrl: newEvidenceUrl,
      targetHypothesisIds: targetHypotheses.length > 0 ? targetHypotheses : undefined
    });
    
    setNewEvidence('');
    setNewEvidenceSource('');
    setNewEvidenceUrl('');
    setTargetHypotheses([]);
  };
  
  const handleSearchEvidence = async () => {
    if (!searchQuery.trim()) return;
    
    const result = await apiCall('searchEvidence', { query: searchQuery });
    
    if (result.success && result.data) {
      setSearchResults(result.data);
    }
  };
  
  const handleRateEvidence = async (evidenceId: string, rating: number, notes?: string) => {
    await apiCall('rateEvidence', {
      evidenceId,
      rating,
      notes
    });
  };
  
  const handleSetCompetition = async (hypothesisId: string, competitorIds: string[]) => {
    await apiCall('setCompetition', {
      hypothesisId,
      competitorIds
    });
  };
  
  const handleExportReport = async () => {
    const result = await apiCall('exportReport');
    
    if (result.success && result.data?.report) {
      const blob = new Blob([result.data.report], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `假设验证报告_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };
  
  // ============================================================================
  // 渲染函数
  // ============================================================================
  
  const renderConfidenceBar = (confidence: number, initial: number) => {
    const diff = confidence - initial;
    const trend = diff > 0.05 ? 'up' : diff < -0.05 ? 'down' : 'stable';
    
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span>置信度</span>
          <div className="flex items-center gap-1">
            <span className="font-bold">{(confidence * 100).toFixed(0)}%</span>
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500" />}
            {trend === 'stable' && <Minus className="h-3 w-3 text-gray-400" />}
          </div>
        </div>
        <Progress value={confidence * 100} className="h-2" />
        <div className="text-xs text-muted-foreground">
          初始: {(initial * 100).toFixed(0)}%
        </div>
      </div>
    );
  };
  
  const renderStatusBadge = (status: string) => {
    const config: Record<string, { color: string; icon: any; label: string }> = {
      active: { color: 'bg-blue-500', icon: AlertCircle, label: '验证中' },
      validated: { color: 'bg-green-500', icon: CheckCircle2, label: '已验证' },
      refuted: { color: 'bg-red-500', icon: XCircle, label: '已否定' },
      inconclusive: { color: 'bg-yellow-500', icon: HelpCircle, label: '不确定' }
    };
    
    const { color, icon: Icon, label } = config[status] || config.active;
    
    return (
      <Badge variant="secondary" className={`${color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };
  
  const renderEvidenceItem = (evidence: SandboxEvidence) => {
    const typeConfig = {
      supporting: { color: 'text-green-500', label: '支持' },
      refuting: { color: 'text-red-500', label: '反驳' },
      neutral: { color: 'text-gray-500', label: '中性' }
    };
    
    const config = typeConfig[evidence.type];
    
    return (
      <div key={evidence.id} className="border rounded-lg p-3 text-sm">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={config.color}>
              {config.label}
            </Badge>
            <span className="text-xs text-muted-foreground">
              强度: {(evidence.strength * 100).toFixed(0)}%
            </span>
          </div>
          {evidence.isVerified && (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          )}
        </div>
        
        <p className="text-sm mb-2">{evidence.content}</p>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>{evidence.source}</span>
            {evidence.sourceUrl && (
              <a href={evidence.sourceUrl} target="_blank" rel="noopener noreferrer">
                <LinkIcon className="h-3 w-3" />
              </a>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map(star => (
                      <Star
                        key={star}
                        className={`h-3 w-3 cursor-pointer ${
                          (evidence.userRating || 0) >= star
                            ? 'text-yellow-500 fill-yellow-500'
                            : 'text-gray-300'
                        }`}
                        onClick={() => handleRateEvidence(evidence.id, star)}
                      />
                    ))}
                  </div>
                </TooltipTrigger>
                <TooltipContent>点击评分</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </div>
    );
  };
  
  const renderHypothesisCard = (hypothesis: SandboxHypothesis) => {
    const isExpanded = expandedHypothesis === hypothesis.id;
    const isLeading = sandbox?.comparison.leadingHypothesis === hypothesis.id;
    
    return (
      <Card 
        key={hypothesis.id}
        className={`relative ${isLeading ? 'ring-2 ring-green-500' : ''}`}
      >
        {isLeading && (
          <div className="absolute -top-2 -right-2">
            <Badge className="bg-green-500 text-white">
              <Target className="h-3 w-3 mr-1" />
              领先
            </Badge>
          </div>
        )}
        
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <CardTitle className="text-sm font-medium flex-1 pr-2">
              {hypothesis.statement}
            </CardTitle>
            {renderStatusBadge(hypothesis.status)}
          </div>
          <CardDescription className="text-xs">
            创建于 {new Date(hypothesis.createdAt).toLocaleString()}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-3">
          {renderConfidenceBar(hypothesis.currentConfidence, hypothesis.initialConfidence)}
          
          {/* 证据统计 */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-green-50 dark:bg-green-900/20 rounded p-1">
              <div className="font-bold text-green-600">
                {hypothesis.supportingEvidence.length}
              </div>
              <div className="text-muted-foreground">支持</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded p-1">
              <div className="font-bold text-red-600">
                {hypothesis.refutingEvidence.length}
              </div>
              <div className="text-muted-foreground">反驳</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded p-1">
              <div className="font-bold text-gray-600">
                {hypothesis.neutralEvidence.length}
              </div>
              <div className="text-muted-foreground">中性</div>
            </div>
          </div>
          
          {/* 展开按钮 */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpandedHypothesis(isExpanded ? null : hypothesis.id)}
          >
            {isExpanded ? (
              <><ChevronUp className="h-4 w-4 mr-1" /> 收起详情</>
            ) : (
              <><ChevronDown className="h-4 w-4 mr-1" /> 查看详情</>
            )}
          </Button>
          
          {/* 展开详情 */}
          {isExpanded && (
            <div className="space-y-3 pt-2 border-t">
              {/* 标签 */}
              {hypothesis.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {hypothesis.tags.map(tag => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              
              {/* 竞争假设 */}
              {hypothesis.competesWith.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">竞争假设:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {hypothesis.competesWith.map(id => {
                      const comp = sandbox?.hypotheses.find(h => h.id === id);
                      return comp ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {comp.statement.substring(0, 20)}...
                        </Badge>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              
              {/* 证据列表 */}
              <Tabs defaultValue="supporting">
                <TabsList className="w-full">
                  <TabsTrigger value="supporting" className="flex-1">
                    支持 ({hypothesis.supportingEvidence.length})
                  </TabsTrigger>
                  <TabsTrigger value="refuting" className="flex-1">
                    反驳 ({hypothesis.refutingEvidence.length})
                  </TabsTrigger>
                  <TabsTrigger value="neutral" className="flex-1">
                    中性 ({hypothesis.neutralEvidence.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="supporting" className="space-y-2 mt-2">
                  {hypothesis.supportingEvidence.length > 0 ? (
                    hypothesis.supportingEvidence.map(renderEvidenceItem)
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      暂无支持证据
                    </p>
                  )}
                </TabsContent>
                
                <TabsContent value="refuting" className="space-y-2 mt-2">
                  {hypothesis.refutingEvidence.length > 0 ? (
                    hypothesis.refutingEvidence.map(renderEvidenceItem)
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      暂无反驳证据
                    </p>
                  )}
                </TabsContent>
                
                <TabsContent value="neutral" className="space-y-2 mt-2">
                  {hypothesis.neutralEvidence.length > 0 ? (
                    hypothesis.neutralEvidence.map(renderEvidenceItem)
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      暂无中性证据
                    </p>
                  )}
                </TabsContent>
              </Tabs>
              
              {/* 设置竞争关系 */}
              <div className="pt-2 border-t">
                <div className="text-xs font-medium mb-2">设置竞争关系</div>
                <Select
                  value={hypothesis.competesWith.join(',')}
                  onValueChange={(value) => 
                    handleSetCompetition(
                      hypothesis.id, 
                      value ? value.split(',') : []
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择竞争假设" />
                  </SelectTrigger>
                  <SelectContent>
                    {sandbox?.hypotheses
                      .filter(h => h.id !== hypothesis.id)
                      .map(h => (
                        <SelectItem key={h.id} value={h.id}>
                          {h.statement.substring(0, 30)}...
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  const renderComparisonMatrix = () => {
    if (!sandbox || sandbox.hypotheses.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <GitCompare className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>添加假设后可查看对比矩阵</p>
        </div>
      );
    }
    
    // 按置信度排序
    const sortedHypotheses = [...sandbox.hypotheses].sort(
      (a, b) => b.currentConfidence - a.currentConfidence
    );
    
    return (
      <div className="space-y-4">
        {/* 对比图表 */}
        <div className="grid gap-4">
          {sortedHypotheses.map((h, index) => (
            <div key={h.id} className="flex items-center gap-4">
              <div className="w-8 text-center font-bold text-lg">
                #{index + 1}
              </div>
              <div className="flex-1">
                <div className="text-sm mb-1">{h.statement}</div>
                <div className="relative h-6 bg-gray-100 dark:bg-gray-800 rounded">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-green-500 to-green-400 rounded"
                    style={{ width: `${h.currentConfidence * 100}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                    {(h.currentConfidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
              {renderStatusBadge(h.status)}
            </div>
          ))}
        </div>
        
        {/* 结论 */}
        <Card className="bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Target className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium mb-1">分析结论</div>
                <p className="text-sm text-muted-foreground">
                  {sandbox.comparison.recommendation}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span>
                    置信度差距: {(sandbox.comparison.confidenceGap * 100).toFixed(0)}%
                  </span>
                  <Badge variant={sandbox.comparison.consensusReached ? 'default' : 'secondary'}>
                    {sandbox.comparison.consensusReached ? '已达成共识' : '尚无共识'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };
  
  // ============================================================================
  // 主渲染
  // ============================================================================
  
  // 未创建沙盒时显示创建表单
  if (!sandbox) {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            创建假设验证沙盒
          </CardTitle>
          <CardDescription>
            创建沙盒以开始多假设并行对比验证
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">沙盒名称 *</label>
            <Input
              value={newSandboxName}
              onChange={(e) => setNewSandboxName(e.target.value)}
              placeholder="输入沙盒名称"
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">描述</label>
            <Textarea
              value={newSandboxDesc}
              onChange={(e) => setNewSandboxDesc(e.target.value)}
              placeholder="描述验证目标"
              className="mt-1"
              rows={3}
            />
          </div>
          <Button 
            onClick={handleCreateSandbox}
            disabled={!newSandboxName.trim() || loading}
            className="w-full"
          >
            创建沙盒
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FlaskConical className="h-5 w-5" />
              {sandbox.name}
            </h2>
            <p className="text-sm text-muted-foreground">{sandbox.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportReport}
              disabled={loading}
            >
              <Download className="h-4 w-4 mr-1" />
              导出报告
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => apiCall('updateConfidence')}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              更新置信度
            </Button>
          </div>
        </div>
      </div>
      
      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：假设列表 */}
        <div className="w-1/2 border-r overflow-auto p-4">
          <div className="mb-4">
            <h3 className="font-medium mb-2">假设列表 ({sandbox.hypotheses.length})</h3>
            
            {/* 添加假设 */}
            <div className="flex gap-2 mb-4">
              <Input
                value={newHypothesis}
                onChange={(e) => setNewHypothesis(e.target.value)}
                placeholder="输入假设陈述..."
                className="flex-1"
              />
              <Input
                type="number"
                value={newConfidence}
                onChange={(e) => setNewConfidence(parseInt(e.target.value) || 50)}
                className="w-20"
                min={10}
                max={90}
              />
              <span className="text-sm text-muted-foreground self-center">%</span>
              <Button onClick={handleAddHypothesis} disabled={!newHypothesis.trim() || loading}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* 假设卡片 */}
          <div className="space-y-4">
            {sandbox.hypotheses.map(renderHypothesisCard)}
          </div>
        </div>
        
        {/* 右侧：对比和操作 */}
        <div className="w-1/2 overflow-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="w-full">
              <TabsTrigger value="overview" className="flex-1">
                对比概览
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex-1">
                添加证据
              </TabsTrigger>
              <TabsTrigger value="search" className="flex-1">
                搜索证据
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="p-4">
              {renderComparisonMatrix()}
            </TabsContent>
            
            <TabsContent value="evidence" className="p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">证据内容 *</label>
                <Textarea
                  value={newEvidence}
                  onChange={(e) => setNewEvidence(e.target.value)}
                  placeholder="输入证据内容..."
                  className="mt-1"
                  rows={4}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">来源</label>
                  <Input
                    value={newEvidenceSource}
                    onChange={(e) => setNewEvidenceSource(e.target.value)}
                    placeholder="证据来源"
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">链接</label>
                  <Input
                    value={newEvidenceUrl}
                    onChange={(e) => setNewEvidenceUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1"
                  />
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">关联假设（可选）</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {sandbox.hypotheses.map(h => (
                    <Badge
                      key={h.id}
                      variant={targetHypotheses.includes(h.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setTargetHypotheses(prev =>
                          prev.includes(h.id)
                            ? prev.filter(id => id !== h.id)
                            : [...prev, h.id]
                        );
                      }}
                    >
                      {h.statement.substring(0, 20)}...
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  不选择则自动评估对所有假设的影响
                </p>
              </div>
              
              <Button
                onClick={handleAddEvidence}
                disabled={!newEvidence.trim() || loading}
                className="w-full"
              >
                添加证据
              </Button>
            </TabsContent>
            
            <TabsContent value="search" className="p-4 space-y-4">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索相关证据..."
                  className="flex-1"
                />
                <Button onClick={handleSearchEvidence} disabled={!searchQuery.trim() || loading}>
                  <Search className="h-4 w-4 mr-1" />
                  搜索
                </Button>
              </div>
              
              {searchResults.length > 0 && (
                <div className="space-y-3">
                  {searchResults.map((result, index) => (
                    <Card key={index} className="cursor-pointer hover:bg-accent">
                      <CardContent className="p-3">
                        <p className="text-sm">{result.content}</p>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span>{result.source}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setNewEvidence(result.content);
                              setNewEvidenceSource(result.source);
                              setNewEvidenceUrl(result.sourceUrl);
                              setActiveTab('evidence');
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            使用
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
