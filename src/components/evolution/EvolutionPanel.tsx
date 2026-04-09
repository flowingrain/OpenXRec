'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RotateCcw,
  Database,
  Brain,
  FlaskConical,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Star,
  Search,
  Play,
  Square,
  BarChart3,
  Lightbulb,
  History
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface AnalysisCase {
  id: string;
  query: string;
  domain: string;
  quality_score: number | null;
  feedback_count: number;
  created_at: string;
}

interface ABExperiment {
  id: string;
  name: string;
  experiment_type: string;
  status: string;
  sample_size: number;
  statistical_significance: number | null;
  created_at: string;
}

interface KnowledgePattern {
  id: string;
  pattern_type: string;
  name: string;
  description: string;
  occurrence_count: number;
  is_verified: boolean;
}

interface Optimization {
  id: string;
  optimization_type: string;
  description: string;
  validation_status: string;
  is_applied: boolean;
  created_at: string;
}

// ============================================================================
// 主组件
// ============================================================================

export function EvolutionPanel() {
  const [cases, setCases] = useState<AnalysisCase[]>([]);
  const [experiments, setExperiments] = useState<ABExperiment[]>([]);
  const [patterns, setPatterns] = useState<KnowledgePattern[]>([]);
  const [optimizations, setOptimizations] = useState<Optimization[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  // 搜索和过滤
  const [searchQuery, setSearchQuery] = useState('');
  const [domainFilter, setDomainFilter] = useState('all');
  
  // A/B测试创建
  const [showCreateExperiment, setShowCreateExperiment] = useState(false);
  const [newExperiment, setNewExperiment] = useState({
    name: '',
    description: '',
    experimentType: 'prompt_improvement',
    controlConfig: '{}',
    treatmentConfig: '{}'
  });
  
  // 反馈提交
  const [selectedCase, setSelectedCase] = useState<AnalysisCase | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState({
    type: 'positive',
    rating: 5,
    comment: ''
  });
  
  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 加载案例
      const casesRes = await fetch('/api/evolution?limit=20');
      const casesData = await casesRes.json();
      if (casesData.success) setCases(casesData.data || []);
      
      // 加载优化记录
      const optRes = await fetch('/api/evolution?action=pendingOptimizations');
      const optData = await optRes.json();
      if (optData.success) setOptimizations(optData.data || []);
      
      // 加载实验和模式（简化处理）
      setExperiments([]);
      setPatterns([]);
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    loadData();
  }, [loadData]);
  
  // 提交反馈
  const submitFeedback = async () => {
    if (!selectedCase) return;
    
    try {
      await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitFeedback',
          data: {
            caseId: selectedCase.id,
            feedbackType: feedback.type,
            options: {
              rating: feedback.rating,
              comment: feedback.comment
            }
          }
        })
      });
      
      setShowFeedback(false);
      setFeedback({ type: 'positive', rating: 5, comment: '' });
      loadData();
    } catch (error) {
      console.error('Submit feedback error:', error);
    }
  };
  
  // 创建实验
  const createExperiment = async () => {
    try {
      await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createExperiment',
          data: {
            name: newExperiment.name,
            description: newExperiment.description,
            experimentType: newExperiment.experimentType,
            controlConfig: JSON.parse(newExperiment.controlConfig),
            treatmentConfig: JSON.parse(newExperiment.treatmentConfig)
          }
        })
      });
      
      setShowCreateExperiment(false);
      setNewExperiment({
        name: '',
        description: '',
        experimentType: 'prompt_improvement',
        controlConfig: '{}',
        treatmentConfig: '{}'
      });
      loadData();
    } catch (error) {
      console.error('Create experiment error:', error);
    }
  };
  
  // 提取知识模式
  const extractPatterns = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/evolution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'extractPatterns', data: {} })
      });
      
      const data = await res.json();
      if (data.success) {
        setPatterns(data.data || []);
        alert(`成功提取 ${data.data?.length || 0} 个知识模式`);
      }
    } catch (error) {
      console.error('Extract patterns error:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // 格式化日期
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // 渲染案例卡片
  const renderCaseCard = (caseItem: AnalysisCase) => (
    <Card key={caseItem.id} className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-sm font-medium line-clamp-2 flex-1">
            {caseItem.query}
          </CardTitle>
          <Badge variant="outline" className="ml-2">
            {caseItem.domain}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span>{formatDate(caseItem.created_at)}</span>
          <span>{caseItem.feedback_count} 条反馈</span>
        </div>
        
        {caseItem.quality_score !== null && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span>质量评分</span>
              <span className="font-bold">{(caseItem.quality_score * 100).toFixed(0)}%</span>
            </div>
            <Progress value={caseItem.quality_score * 100} className="h-2" />
          </div>
        )}
        
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => {
              setSelectedCase(caseItem);
              setShowFeedback(true);
            }}
          >
            <Star className="h-3 w-3 mr-1" />
            提交反馈
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  // 渲染优化记录
  const renderOptimization = (opt: Optimization) => (
    <Card key={opt.id}>
      <CardContent className="pt-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="font-medium text-sm">{opt.description}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {opt.optimization_type} · {formatDate(opt.created_at)}
            </div>
          </div>
          <Badge variant={opt.is_applied ? 'default' : 'secondary'}>
            {opt.is_applied ? '已应用' : opt.validation_status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
  
  return (
    <div className="h-full flex flex-col">
      {/* 头部 */}
      <div className="border-b p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              复盘进化系统
            </h2>
            <p className="text-sm text-muted-foreground">
              持久化存储 · 智能检索 · A/B测试
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={extractPatterns} disabled={loading}>
              <Lightbulb className="h-4 w-4 mr-1" />
              提取模式
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCreateExperiment(true)}>
              <FlaskConical className="h-4 w-4 mr-1" />
              创建实验
            </Button>
          </div>
        </div>
      </div>
      
      {/* 主体 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="w-full px-4 pt-2">
          <TabsTrigger value="overview" className="flex-1">
            <Database className="h-4 w-4 mr-1" />
            案例库
          </TabsTrigger>
          <TabsTrigger value="experiments" className="flex-1">
            <FlaskConical className="h-4 w-4 mr-1" />
            A/B测试
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex-1">
            <Brain className="h-4 w-4 mr-1" />
            知识模式
          </TabsTrigger>
          <TabsTrigger value="optimizations" className="flex-1">
            <TrendingUp className="h-4 w-4 mr-1" />
            优化记录
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="flex-1 overflow-auto p-4">
          {/* 搜索 */}
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索案例..."
                className="pl-8"
              />
            </div>
            <Select value={domainFilter} onValueChange={setDomainFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="领域" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部领域</SelectItem>
                <SelectItem value="finance">金融</SelectItem>
                <SelectItem value="geopolitics">地缘政治</SelectItem>
                <SelectItem value="energy">能源</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {/* 案例列表 */}
          <div className="grid gap-3 md:grid-cols-2">
            {cases.length > 0 ? (
              cases.map(renderCaseCard)
            ) : (
              <div className="col-span-2 text-center py-12 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>暂无分析案例</p>
                <p className="text-xs mt-1">开始分析后，案例将自动保存</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="experiments" className="flex-1 overflow-auto p-4">
          {experiments.length > 0 ? (
            <div className="space-y-3">
              {experiments.map(exp => (
                <Card key={exp.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{exp.name}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {exp.experiment_type} · {exp.sample_size} 样本
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={exp.status === 'running' ? 'default' : 'secondary'}>
                          {exp.status}
                        </Badge>
                        {exp.status === 'running' && (
                          <Button variant="outline" size="sm">
                            <Square className="h-3 w-3 mr-1" />
                            停止
                          </Button>
                        )}
                      </div>
                    </div>
                    {exp.statistical_significance !== null && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">
                          统计显著性: {(exp.statistical_significance * 100).toFixed(1)}%
                        </div>
                        <Progress value={exp.statistical_significance * 100} className="h-1" />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无A/B测试实验</p>
              <p className="text-xs mt-1">点击"创建实验"开始第一个实验</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="patterns" className="flex-1 overflow-auto p-4">
          {patterns.length > 0 ? (
            <div className="space-y-3">
              {patterns.map(pattern => (
                <Card key={pattern.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="font-medium">{pattern.name}</div>
                      <div className="flex items-center gap-2">
                        {pattern.is_verified && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        <Badge variant="outline">{pattern.pattern_type}</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{pattern.description}</p>
                    <div className="text-xs text-muted-foreground mt-2">
                      出现 {pattern.occurrence_count} 次
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无知识模式</p>
              <p className="text-xs mt-1">点击"提取模式"从历史案例中提取知识</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="optimizations" className="flex-1 overflow-auto p-4">
          {optimizations.length > 0 ? (
            <div className="space-y-3">
              {optimizations.map(renderOptimization)}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>暂无优化记录</p>
              <p className="text-xs mt-1">用户反馈将自动生成优化建议</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* 反馈对话框 */}
      <Dialog open={showFeedback} onOpenChange={setShowFeedback}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交反馈</DialogTitle>
            <DialogDescription>
              为此分析案例提供反馈，帮助系统持续优化
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">反馈类型</label>
              <Select
                value={feedback.type}
                onValueChange={(v) => setFeedback({ ...feedback, type: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="positive">正面反馈</SelectItem>
                  <SelectItem value="negative">负面反馈</SelectItem>
                  <SelectItem value="neutral">中性反馈</SelectItem>
                  <SelectItem value="correction">修正建议</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">评分 (1-5)</label>
              <Input
                type="number"
                min={1}
                max={5}
                value={feedback.rating}
                onChange={(e) => setFeedback({ ...feedback, rating: parseInt(e.target.value) })}
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">详细说明</label>
              <Textarea
                value={feedback.comment}
                onChange={(e) => setFeedback({ ...feedback, comment: e.target.value })}
                placeholder="请输入您的反馈..."
                className="mt-1"
                rows={4}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeedback(false)}>
              取消
            </Button>
            <Button onClick={submitFeedback}>
              提交反馈
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 创建实验对话框 */}
      <Dialog open={showCreateExperiment} onOpenChange={setShowCreateExperiment}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>创建A/B测试实验</DialogTitle>
            <DialogDescription>
              创建实验以对比不同配置的效果
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">实验名称 *</label>
              <Input
                value={newExperiment.name}
                onChange={(e) => setNewExperiment({ ...newExperiment, name: e.target.value })}
                placeholder="输入实验名称"
                className="mt-1"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">实验类型</label>
              <Select
                value={newExperiment.experimentType}
                onValueChange={(v) => setNewExperiment({ ...newExperiment, experimentType: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prompt_improvement">提示词优化</SelectItem>
                  <SelectItem value="agent_tuning">智能体调优</SelectItem>
                  <SelectItem value="model_comparison">模型对比</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium">对照组配置 (JSON)</label>
              <Textarea
                value={newExperiment.controlConfig}
                onChange={(e) => setNewExperiment({ ...newExperiment, controlConfig: e.target.value })}
                placeholder='{"key": "value"}'
                className="mt-1 font-mono text-xs"
                rows={3}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">实验组配置 (JSON)</label>
              <Textarea
                value={newExperiment.treatmentConfig}
                onChange={(e) => setNewExperiment({ ...newExperiment, treatmentConfig: e.target.value })}
                placeholder='{"key": "value"}'
                className="mt-1 font-mono text-xs"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateExperiment(false)}>
              取消
            </Button>
            <Button onClick={createExperiment} disabled={!newExperiment.name}>
              创建实验
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
