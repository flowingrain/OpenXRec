/**
 * 关系浏览器组件
 * 
 * 功能：
 * 1. 分页列表查看所有关系
 * 2. 支持类型筛选
 * 3. 支持实体筛选
 * 4. 支持排序
 */

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowRight,
  RefreshCw,
  Download,
  AlertTriangle,
  Eye,
  Edit2,
  Trash2,
  Link,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 关系类型中文名
const RELATION_TYPE_NAMES: Record<string, string> = {
  associated: '关联',
  influenced: '影响',
  employed: '任职',
  belonged: '隶属',
  regulated: '监管',
  published: '发布',
  produced: '生产',
  invested: '投资',
  competed: '竞争',
  collaborated: '合作',
  located: '位于',
  other: '其他',
};

// 关系类型颜色
const RELATION_TYPE_COLORS: Record<string, string> = {
  associated: 'bg-gray-100 text-gray-700',
  influenced: 'bg-red-100 text-red-700',
  employed: 'bg-blue-100 text-blue-700',
  belonged: 'bg-purple-100 text-purple-700',
  regulated: 'bg-orange-100 text-orange-700',
  published: 'bg-green-100 text-green-700',
  produced: 'bg-pink-100 text-pink-700',
  invested: 'bg-yellow-100 text-yellow-700',
  competed: 'bg-cyan-100 text-cyan-700',
  collaborated: 'bg-indigo-100 text-indigo-700',
  located: 'bg-teal-100 text-teal-700',
  other: 'bg-gray-100 text-gray-700',
};

// 关系数据类型
export interface Relation {
  id: string;
  source_entity_id: string;
  source_entity_name?: string;
  source_entity_type?: string;
  target_entity_id: string;
  target_entity_name?: string;
  target_entity_type?: string;
  type: string;
  description?: string;
  confidence?: number;
  source?: string;
  properties?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
}

// 分页信息
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface RelationBrowserProps {
  // 数据源
  relations?: Relation[];
  // API端点
  apiEndpoint?: string;
  // 是否显示操作按钮
  showActions?: boolean;
  // 是否支持选择
  selectable?: boolean;
  // 已选择的关系ID
  selectedIds?: string[];
  // 选择回调
  onSelectionChange?: (ids: string[]) => void;
  // 查看详情回调
  onViewDetail?: (relation: Relation) => void;
  // 编辑回调
  onEdit?: (relation: Relation) => void;
  // 删除回调
  onDelete?: (relation: Relation) => void;
  // 刷新回调
  onRefresh?: () => void;
  // 预筛选的实体ID
  filterEntityId?: string;
}

export function RelationBrowser({
  relations: propRelations,
  apiEndpoint = '/api/knowledge-graph',
  showActions = true,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onViewDetail,
  onEdit,
  onDelete,
  onRefresh,
  filterEntityId,
}: RelationBrowserProps) {
  // 状态
  const [relations, setRelations] = useState<Relation[]>(propRelations || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [entityFilter, setEntityFilter] = useState<string>(filterEntityId || '');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 获取所有关系类型
  const relationTypes = useMemo(() => {
    const types = new Set(relations.map(r => r.type));
    return Array.from(types).sort();
  }, [relations]);

  // 获取所有实体（用于筛选）
  const entities = useMemo(() => {
    const entityMap = new Map<string, { id: string; name: string }>();
    relations.forEach(r => {
      if (r.source_entity_id && r.source_entity_name) {
        entityMap.set(r.source_entity_id, { id: r.source_entity_id, name: r.source_entity_name });
      }
      if (r.target_entity_id && r.target_entity_name) {
        entityMap.set(r.target_entity_id, { id: r.target_entity_id, name: r.target_entity_name });
      }
    });
    return Array.from(entityMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [relations]);

  // 筛选后的关系
  const filteredRelations = useMemo(() => {
    let result = [...relations];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.source_entity_name?.toLowerCase().includes(query) ||
        r.target_entity_name?.toLowerCase().includes(query) ||
        r.description?.toLowerCase().includes(query)
      );
    }

    // 类型过滤
    if (typeFilter !== 'all') {
      result = result.filter(r => r.type === typeFilter);
    }

    // 实体过滤
    if (entityFilter) {
      result = result.filter(r =>
        r.source_entity_id === entityFilter || r.target_entity_id === entityFilter
      );
    }

    // 排序
    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortBy) {
        case 'source':
          aVal = a.source_entity_name || '';
          bVal = b.source_entity_name || '';
          break;
        case 'target':
          aVal = a.target_entity_name || '';
          bVal = b.target_entity_name || '';
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'confidence':
          aVal = a.confidence || 0;
          bVal = b.confidence || 0;
          break;
        case 'createdAt':
          aVal = a.createdAt || '';
          bVal = b.createdAt || '';
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }
      return sortOrder === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [relations, searchQuery, typeFilter, entityFilter, sortBy, sortOrder]);

  // 分页后的关系
  const paginatedRelations = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredRelations.slice(start, end);
  }, [filteredRelations, pagination.page, pagination.pageSize]);

  // 更新分页信息
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: filteredRelations.length,
      totalPages: Math.ceil(filteredRelations.length / prev.pageSize),
    }));
  }, [filteredRelations]);

  // 从API获取数据
  const fetchRelations = useCallback(async () => {
    if (propRelations) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'relations',
        limit: '1000',
      });

      const response = await fetch(`${apiEndpoint}?${params}`);
      const data = await response.json();

      if (data.success) {
        setRelations(data.relations || []);
      }
    } catch (error) {
      console.error('获取关系失败:', error);
    } finally {
      setLoading(false);
    }
  }, [propRelations, apiEndpoint]);

  // 初始化
  useEffect(() => {
    if (propRelations) {
      setRelations(propRelations);
    } else {
      fetchRelations();
    }
  }, [propRelations, fetchRelations]);

  // 切换排序
  const toggleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.length === paginatedRelations.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(paginatedRelations.map(r => r.id));
    }
  };

  // 切换选择
  const toggleSelect = (id: string) => {
    const newSelected = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    onSelectionChange?.(newSelected);
  };

  // 导出数据
  const handleExport = () => {
    const data = filteredRelations.map(r => ({
      源实体: r.source_entity_name || '',
      关系类型: RELATION_TYPE_NAMES[r.type] || r.type,
      目标实体: r.target_entity_name || '',
      描述: r.description || '',
      置信度: r.confidence ? `${(r.confidence * 100).toFixed(0)}%` : '',
      来源: r.source || '',
    }));

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relations_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link className="h-5 w-5" />
              关系浏览器
            </CardTitle>
            <CardDescription>
              共 {filteredRelations.length} 条关系
              {typeFilter !== 'all' && ` (${RELATION_TYPE_NAMES[typeFilter] || typeFilter})`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh || fetchRelations}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索实体名称、描述..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagination(prev => ({ ...prev, page: 1 }));
              }}
            />
          </div>

          <Select value={typeFilter} onValueChange={(v) => {
            setTypeFilter(v);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="类型筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部类型</SelectItem>
              {relationTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {RELATION_TYPE_NAMES[type] || type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={entityFilter} onValueChange={(v) => {
            setEntityFilter(v);
            setPagination(prev => ({ ...prev, page: 1 }));
          }}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="实体筛选" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部实体</SelectItem>
              {entities.slice(0, 50).map(entity => (
                <SelectItem key={entity.id} value={entity.id}>
                  {entity.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(v) => {
            const [field, order] = v.split('-');
            setSortBy(field);
            setSortOrder(order as 'asc' | 'desc');
          }}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="排序方式" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="source-asc">源实体 A-Z</SelectItem>
              <SelectItem value="target-asc">目标实体 A-Z</SelectItem>
              <SelectItem value="type-asc">类型 A-Z</SelectItem>
              <SelectItem value="confidence-desc">置信度 高-低</SelectItem>
              <SelectItem value="createdAt-desc">最新添加</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 类型统计 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(
            relations.reduce((acc, r) => {
              acc[r.type] = (acc[r.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          )
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <Badge
                key={type}
                variant={typeFilter === type ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer',
                  typeFilter === type ? '' : RELATION_TYPE_COLORS[type]
                )}
                onClick={() => {
                  setTypeFilter(typeFilter === type ? 'all' : type);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                <ArrowRight className="h-3 w-3 mr-1" />
                <span>{RELATION_TYPE_NAMES[type] || type}</span>
                <span className="ml-1 text-xs opacity-70">{count}</span>
              </Badge>
            ))}
        </div>

        {/* 关系列表 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedRelations.length && paginatedRelations.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                )}
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('source')}
                  >
                    源实体
                    {sortBy === 'source' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-32">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('type')}
                  >
                    关系类型
                    {sortBy === 'type' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('target')}
                  >
                    目标实体
                    {sortBy === 'target' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-24">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('confidence')}
                  >
                    置信度
                    {sortBy === 'confidence' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                {showActions && <TableHead className="w-24">操作</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7 + (selectable ? 1 : 0)} className="text-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">加载中...</p>
                  </TableCell>
                </TableRow>
              ) : paginatedRelations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7 + (selectable ? 1 : 0)} className="text-center py-8">
                    <AlertTriangle className="h-6 w-6 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">
                      {searchQuery || typeFilter !== 'all' || entityFilter ? '没有找到匹配的关系' : '暂无关系数据'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRelations.map((relation, index) => (
                  <TableRow
                    key={relation.id}
                    className={cn(
                      'hover:bg-gray-50',
                      selectedIds.includes(relation.id) && 'bg-blue-50'
                    )}
                  >
                    {selectable && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(relation.id)}
                          onChange={() => toggleSelect(relation.id)}
                          className="rounded"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-gray-400">
                      {(pagination.page - 1) * pagination.pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{relation.source_entity_name || relation.source_entity_id}</div>
                      {relation.source_entity_type && (
                        <div className="text-xs text-gray-400">{relation.source_entity_type}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={RELATION_TYPE_COLORS[relation.type] || RELATION_TYPE_COLORS.other}>
                        <ArrowRight className="h-3 w-3 mr-1" />
                        {RELATION_TYPE_NAMES[relation.type] || relation.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{relation.target_entity_name || relation.target_entity_id}</div>
                      {relation.target_entity_type && (
                        <div className="text-xs text-gray-400">{relation.target_entity_type}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-500">
                      {relation.description || '-'}
                    </TableCell>
                    <TableCell>
                      {relation.confidence !== undefined ? (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                relation.confidence >= 0.8 ? 'bg-green-500' :
                                relation.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                              )}
                              style={{ width: `${relation.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {(relation.confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      ) : '-'}
                    </TableCell>
                    {showActions && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {onViewDetail && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onViewDetail(relation)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(relation)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => onDelete(relation)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 分页 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              显示 {(pagination.page - 1) * pagination.pageSize + 1} - {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条，共 {pagination.total} 条
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: 1 }))}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === 1}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm px-3">
                {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination(prev => ({ ...prev, page: prev.totalPages }))}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RelationBrowser;
