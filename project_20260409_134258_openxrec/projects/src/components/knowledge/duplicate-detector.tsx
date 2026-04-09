/**
 * 重复检测组件
 * 
 * 功能：
 * 1. 显示检测到的重复实体对
 * 2. 支持合并、忽略操作
 * 3. 显示详细的相似度分析
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle,
  Search,
  RefreshCw,
  Merge,
  XCircle,
  CheckCircle,
  ChevronRight,
  ArrowRight,
  Info,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  duplicateDetector, 
  type DuplicatePair, 
  type DuplicateType,
  type SimilarityMethod 
} from '@/lib/knowledge/duplicate-detector';
import type { Entity } from './entity-browser';

// 重复类型中文名
const DUPLICATE_TYPE_NAMES: Record<DuplicateType, string> = {
  exact: '完全相同',
  alias: '别名/缩写',
  typo: '拼写错误',
  translation: '翻译差异',
  abbreviation: '简写',
  similar: '相似',
};

// 重复类型颜色
const DUPLICATE_TYPE_COLORS: Record<DuplicateType, string> = {
  exact: 'bg-red-100 text-red-700',
  alias: 'bg-orange-100 text-orange-700',
  typo: 'bg-yellow-100 text-yellow-700',
  translation: 'bg-blue-100 text-blue-700',
  abbreviation: 'bg-purple-100 text-purple-700',
  similar: 'bg-gray-100 text-gray-700',
};

// 建议中文名
const SUGGESTION_NAMES: Record<string, string> = {
  merge: '建议合并',
  review: '需要审核',
  keep_separate: '保持分离',
};

// 建议颜色
const SUGGESTION_COLORS: Record<string, string> = {
  merge: 'bg-green-100 text-green-700',
  review: 'bg-yellow-100 text-yellow-700',
  keep_separate: 'bg-gray-100 text-gray-700',
};

// 检测方法中文名
const METHOD_NAMES: Record<SimilarityMethod, string> = {
  levenshtein: '编辑距离',
  jaccard: 'Jaccard',
  soundex: '语音相似',
  embedding: '向量相似',
};

interface DuplicateDetectorProps {
  // 实体数据
  entities?: Entity[];
  // API端点
  apiEndpoint?: string;
  // 合并回调
  onMerge?: (pair: DuplicatePair) => Promise<void>;
  // 忽略回调
  onIgnore?: (pair: DuplicatePair) => void;
  // 检测完成回调
  onDetectComplete?: (pairs: DuplicatePair[]) => void;
}

export function DuplicateDetectorComponent({
  entities: propEntities,
  apiEndpoint = '/api/knowledge-graph',
  onMerge,
  onIgnore,
  onDetectComplete,
}: DuplicateDetectorProps) {
  // 状态
  const [entities, setEntities] = useState<Entity[]>(propEntities || []);
  const [duplicates, setDuplicates] = useState<DuplicatePair[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPair, setSelectedPair] = useState<DuplicatePair | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [merging, setMerging] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'merge' | 'review'>('all');
  
  // 获取实体
  const fetchEntities = useCallback(async () => {
    if (propEntities) return;
    
    try {
      const response = await fetch(`${apiEndpoint}?action=entities&limit=1000`);
      const data = await response.json();
      if (data.success) {
        setEntities(data.entities || []);
      }
    } catch (error) {
      console.error('获取实体失败:', error);
    }
  }, [propEntities, apiEndpoint]);
  
  // 执行检测
  const runDetection = useCallback(async () => {
    if (entities.length === 0) {
      await fetchEntities();
      return;
    }
    
    setLoading(true);
    
    try {
      // 转换实体格式
      const entityData = entities.map(e => ({
        id: e.id,
        name: e.name,
        type: e.type,
        aliases: e.aliases,
        description: e.description,
      }));
      
      const results = await duplicateDetector.detect(entityData);
      setDuplicates(results);
      onDetectComplete?.(results);
    } catch (error) {
      console.error('检测失败:', error);
    } finally {
      setLoading(false);
    }
  }, [entities, fetchEntities, onDetectComplete]);
  
  // 初始化
  useEffect(() => {
    if (propEntities) {
      setEntities(propEntities);
    } else {
      fetchEntities();
    }
  }, [propEntities, fetchEntities]);
  
  // 自动检测
  useEffect(() => {
    if (entities.length > 0 && duplicates.length === 0) {
      runDetection();
    }
  }, [entities.length]);
  
  // 筛选后的重复对
  const filteredDuplicates = duplicates.filter(pair => {
    if (activeTab === 'all') return true;
    if (activeTab === 'merge') return pair.suggestion === 'merge';
    if (activeTab === 'review') return pair.suggestion === 'review';
    return true;
  });
  
  // 统计
  const stats = {
    total: duplicates.length,
    merge: duplicates.filter(p => p.suggestion === 'merge').length,
    review: duplicates.filter(p => p.suggestion === 'review').length,
    autoMergeable: duplicates.filter(p => p.autoMergeable).length,
  };
  
  // 处理合并
  const handleMerge = async () => {
    if (!selectedPair || !onMerge) return;
    
    setMerging(true);
    try {
      await onMerge(selectedPair);
      
      // 从列表中移除
      setDuplicates(prev => prev.filter(p => p.id !== selectedPair.id));
      setShowMergeDialog(false);
      setSelectedPair(null);
    } catch (error) {
      console.error('合并失败:', error);
    } finally {
      setMerging(false);
    }
  };
  
  // 处理忽略
  const handleIgnore = (pair: DuplicatePair) => {
    onIgnore?.(pair);
    setDuplicates(prev => prev.filter(p => p.id !== pair.id));
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              重复实体检测
            </CardTitle>
            <CardDescription>
              自动检测相似实体，发现潜在的重复数据
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runDetection}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* 统计概览 */}
        {duplicates.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-gray-700">{stats.total}</div>
              <div className="text-xs text-gray-500">总计发现</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{stats.merge}</div>
              <div className="text-xs text-gray-500">建议合并</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-yellow-600">{stats.review}</div>
              <div className="text-xs text-gray-500">需要审核</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.autoMergeable}</div>
              <div className="text-xs text-gray-500">可自动处理</div>
            </div>
          </div>
        )}
        
        {/* Tab筛选 */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">全部 ({stats.total})</TabsTrigger>
            <TabsTrigger value="merge">建议合并 ({stats.merge})</TabsTrigger>
            <TabsTrigger value="review">需要审核 ({stats.review})</TabsTrigger>
          </TabsList>
        </Tabs>
        
        {/* 检测中 */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-gray-500">正在检测重复实体...</p>
            <p className="text-sm text-gray-400">已分析 {entities.length} 个实体</p>
          </div>
        )}
        
        {/* 无结果 */}
        {!loading && duplicates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-gray-700 font-medium">未发现重复实体</p>
            <p className="text-sm text-gray-400">所有实体都是唯一的</p>
          </div>
        )}
        
        {/* 重复列表 */}
        {!loading && filteredDuplicates.length > 0 && (
          <div className="space-y-3">
            {filteredDuplicates.map((pair) => (
              <div
                key={pair.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  {/* 实体信息 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {/* 实体1 */}
                      <div className="flex-1">
                        <div className="font-medium">{pair.entity1.name}</div>
                        <div className="text-xs text-gray-400">{pair.entity1.type}</div>
                      </div>
                      
                      {/* 关系 */}
                      <div className="flex flex-col items-center px-3">
                        <Badge className={DUPLICATE_TYPE_COLORS[pair.duplicateType]}>
                          {DUPLICATE_TYPE_NAMES[pair.duplicateType]}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-gray-400 my-1" />
                        <div className="text-xs text-gray-500">
                          {METHOD_NAMES[pair.method]}
                        </div>
                      </div>
                      
                      {/* 实体2 */}
                      <div className="flex-1">
                        <div className="font-medium">{pair.entity2.name}</div>
                        <div className="text-xs text-gray-400">{pair.entity2.type}</div>
                      </div>
                    </div>
                    
                    {/* 相似度和建议 */}
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">相似度:</span>
                        <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              pair.similarity >= 0.9 ? 'bg-red-500' :
                              pair.similarity >= 0.8 ? 'bg-orange-500' : 'bg-yellow-500'
                            )}
                            style={{ width: `${pair.similarity * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium">
                          {(pair.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                      
                      <Badge className={SUGGESTION_COLORS[pair.suggestion]}>
                        {SUGGESTION_NAMES[pair.suggestion]}
                      </Badge>
                      
                      {pair.autoMergeable && (
                        <Badge variant="outline" className="text-blue-600">
                          <Zap className="h-3 w-3 mr-1" />
                          可自动合并
                        </Badge>
                      )}
                    </div>
                    
                    {/* 原因 */}
                    <p className="text-xs text-gray-500 mt-2">{pair.reason}</p>
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedPair(pair);
                        setShowMergeDialog(true);
                      }}
                    >
                      <Merge className="h-4 w-4 mr-1" />
                      合并
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-gray-500"
                      onClick={() => handleIgnore(pair)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      忽略
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      
      {/* 合并确认对话框 */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认合并实体</DialogTitle>
            <DialogDescription>
              将两个实体合并为一个，保留主要实体的属性
            </DialogDescription>
          </DialogHeader>
          
          {selectedPair && (
            <div className="space-y-4">
              {/* 合并预览 */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 text-center">
                    <div className="font-medium text-gray-400">合并</div>
                    <div className="font-bold">{selectedPair.entity2.name}</div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-gray-400" />
                  <div className="flex-1 text-center">
                    <div className="font-medium text-green-600">保留</div>
                    <div className="font-bold">{selectedPair.entity1.name}</div>
                  </div>
                </div>
              </div>
              
              {/* 提示信息 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-700">
                    <p className="font-medium">合并后:</p>
                    <ul className="list-disc list-inside mt-1 text-xs">
                      <li>被合并实体的所有关系将转移到主实体</li>
                      <li>被合并实体的名称将添加为主实体的别名</li>
                      <li>被合并实体将被标记为已合并状态</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              取消
            </Button>
            <Button onClick={handleMerge} disabled={merging}>
              {merging ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  合并中...
                </>
              ) : (
                <>
                  <Merge className="h-4 w-4 mr-2" />
                  确认合并
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default DuplicateDetectorComponent;
