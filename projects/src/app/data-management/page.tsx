'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Download, Upload, Trash2, Database, RefreshCw, AlertCircle } from 'lucide-react';

interface ServiceStats {
  total: number;
  byType?: Record<string, number>;
  currentSessions?: number;
  totalUsers?: number;
  totalFeedbacks?: number;
  nodeCount?: number;
  edgeCount?: number;
  avgDegree?: number;
  avgFeedbacksPerUser?: number;
}

interface AllStats {
  vectorStore: ServiceStats;
  knowledge: ServiceStats;
  memory: ServiceStats;
  graph: ServiceStats;
}

export default function DataManagementPage() {
  const [stats, setStats] = useState<AllStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState<string>('vector');
  const [exportData, setExportData] = useState<any>(null);
  const [importData, setImportData] = useState<string>('');
  const [importResult, setImportResult] = useState<any>(null);
  const [options, setOptions] = useState({
    includeEmbeddings: true,
    skipExisting: true,
    updateExisting: false,
    limit: 100
  });

  // 加载统计信息
  const loadStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/data-management?action=stats');
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // 导出数据
  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/data-management?action=export&service=${selectedService}&options=${encodeURIComponent(JSON.stringify(options))}`
      );
      const result = await response.json();
      if (result.success) {
        setExportData(result.data);

        // 触发下载
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedService}-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 导入数据
  const handleImport = async () => {
    if (!importData.trim()) {
      alert('请输入要导入的 JSON 数据');
      return;
    }

    setLoading(true);
    try {
      const data = JSON.parse(importData);
      const response = await fetch('/api/data-management?action=import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService,
          data,
          options
        })
      });
      const result = await response.json();
      if (result.success) {
        setImportResult(result.data);
        alert(`导入完成: 成功 ${result.data.success}, 失败 ${result.data.failed}`);
        loadStats();
      } else {
        alert(`导入失败: ${result.error}`);
      }
    } catch (error: any) {
      alert(`导入失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 清空数据
  const handleClear = async () => {
    const confirmed = confirm(`确定要清空 ${selectedService} 的所有数据吗？此操作不可恢复！`);
    if (!confirmed) return;

    setLoading(true);
    try {
      const response = await fetch('/api/data-management?action=clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: selectedService,
          options: { confirm: true }
        })
      });
      const result = await response.json();
      if (result.success) {
        alert(`清空完成: ${JSON.stringify(result.data)}`);
        loadStats();
      } else {
        alert(`清空失败: ${result.error}`);
      }
    } catch (error: any) {
      alert(`清空失败: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">数据管理</h1>
          <p className="text-muted-foreground">导出、导入和管理系统数据</p>
        </div>
        <Button onClick={loadStats} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          刷新统计
        </Button>
      </div>

      {/* 统计信息 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">向量存储</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.vectorStore.total}</div>
              <p className="text-xs text-muted-foreground">个向量嵌入</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">知识库</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.knowledge.total}</div>
              <p className="text-xs text-muted-foreground">个知识条目</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">记忆系统</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.memory.totalUsers}</div>
              <p className="text-xs text-muted-foreground">个用户 / {stats.memory.totalFeedbacks} 反馈</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">知识图谱</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.graph.nodeCount}</div>
              <p className="text-xs text-muted-foreground">个节点 / {stats.graph.edgeCount} 条边</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 数据管理操作 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据操作
          </CardTitle>
          <CardDescription>选择服务并执行导出、导入或清空操作</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedService} onValueChange={setSelectedService}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="vector">向量存储</TabsTrigger>
              <TabsTrigger value="knowledge">知识库</TabsTrigger>
              <TabsTrigger value="memory">记忆系统</TabsTrigger>
              <TabsTrigger value="graph">知识图谱</TabsTrigger>
            </TabsList>

            <TabsContent value="vector" className="mt-4">
              <VectorManagementPanel
                onExport={handleExport}
                onImport={handleImport}
                onClear={handleClear}
                options={options}
                setOptions={setOptions}
                importData={importData}
                setImportData={setImportData}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="knowledge" className="mt-4">
              <KnowledgeManagementPanel
                onExport={handleExport}
                onImport={handleImport}
                onClear={handleClear}
                options={options}
                setOptions={setOptions}
                importData={importData}
                setImportData={setImportData}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="memory" className="mt-4">
              <MemoryManagementPanel
                onExport={handleExport}
                onImport={handleImport}
                onClear={handleClear}
                options={options}
                setOptions={setOptions}
                importData={importData}
                setImportData={setImportData}
                loading={loading}
              />
            </TabsContent>

            <TabsContent value="graph" className="mt-4">
              <GraphManagementPanel
                onExport={handleExport}
                onImport={handleImport}
                onClear={handleClear}
                options={options}
                setOptions={setOptions}
                importData={importData}
                setImportData={setImportData}
                loading={loading}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

// 向量存储管理面板
function VectorManagementPanel({
  onExport,
  onImport,
  onClear,
  options,
  setOptions,
  importData,
  setImportData,
  loading
}: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导出数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>包含向量嵌入</Label>
              <Switch
                checked={options.includeEmbeddings}
                onCheckedChange={(checked) => setOptions({ ...options, includeEmbeddings: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>导出数量: {options.limit}</Label>
              <Slider
                value={[options.limit]}
                onValueChange={([value]) => setOptions({ ...options, limit: value })}
                max={10000}
                step={100}
              />
            </div>
            <Button onClick={onExport} className="w-full" disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导入数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>JSON 数据</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="粘贴导出的 JSON 数据..."
                rows={6}
              />
            </div>
            <Button onClick={onImport} className="w-full" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              导入
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">危险操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                清空操作将删除所有向量数据，此操作不可恢复！
              </p>
            </div>
            <Button onClick={onClear} variant="destructive" className="w-full" disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空所有数据
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 知识库管理面板
function KnowledgeManagementPanel({ onExport, onImport, onClear, options, setOptions, importData, setImportData, loading }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导出数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>导出数量: {options.limit}</Label>
              <Slider
                value={[options.limit]}
                onValueChange={([value]) => setOptions({ ...options, limit: value })}
                max={10000}
                step={100}
              />
            </div>
            <Button onClick={onExport} className="w-full" disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导入数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>JSON 数据</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="粘贴导出的 JSON 数据..."
                rows={6}
              />
            </div>
            <Button onClick={onImport} className="w-full" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              导入
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">危险操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                清空操作将删除所有知识库数据，此操作不可恢复！
              </p>
            </div>
            <Button onClick={onClear} variant="destructive" className="w-full" disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空所有数据
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 记忆系统管理面板
function MemoryManagementPanel({ onExport, onImport, onClear, options, setOptions, importData, setImportData, loading }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导出数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>包含会话</Label>
              <Switch
                checked={options.includeSessions}
                onCheckedChange={(checked) => setOptions({ ...options, includeSessions: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>导出数量: {options.limit}</Label>
              <Slider
                value={[options.limit]}
                onValueChange={([value]) => setOptions({ ...options, limit: value })}
                max={10000}
                step={100}
              />
            </div>
            <Button onClick={onExport} className="w-full" disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导入数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>JSON 数据</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="粘贴导出的 JSON 数据..."
                rows={6}
              />
            </div>
            <Button onClick={onImport} className="w-full" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              导入
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">危险操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                清空操作将删除所有用户记忆数据，此操作不可恢复！
              </p>
            </div>
            <Button onClick={onClear} variant="destructive" className="w-full" disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空所有数据
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// 知识图谱管理面板
function GraphManagementPanel({ onExport, onImport, onClear, options, setOptions, importData, setImportData, loading }: any) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导出数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>包含边</Label>
              <Switch
                checked={options.includeEdges}
                onCheckedChange={(checked) => setOptions({ ...options, includeEdges: checked })}
              />
            </div>
            <div className="space-y-2">
              <Label>导出数量: {options.limit}</Label>
              <Slider
                value={[options.limit]}
                onValueChange={([value]) => setOptions({ ...options, limit: value })}
                max={10000}
                step={100}
              />
            </div>
            <Button onClick={onExport} className="w-full" disabled={loading}>
              <Download className="mr-2 h-4 w-4" />
              导出
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">导入数据</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>JSON 数据</Label>
              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="粘贴导出的 JSON 数据..."
                rows={6}
              />
            </div>
            <Button onClick={onImport} className="w-full" disabled={loading}>
              <Upload className="mr-2 h-4 w-4" />
              导入
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">危险操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">
                清空操作将删除所有知识图谱数据，此操作不可恢复！
              </p>
            </div>
            <Button onClick={onClear} variant="destructive" className="w-full" disabled={loading}>
              <Trash2 className="mr-2 h-4 w-4" />
              清空所有数据
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
