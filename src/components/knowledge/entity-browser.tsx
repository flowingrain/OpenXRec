/**
 * 实体浏览器组件
 * 
 * 功能：
 * 1. 分页列表查看所有实体
 * 2. 支持关键词搜索
 * 3. 支持类型筛选
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
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  Building,
  User,
  MapPin,
  FileText,
  Package,
  Landmark,
  Calendar,
  Tag,
  Hash,
  MoreHorizontal,
  Eye,
  Edit2,
  Trash2,
  RefreshCw,
  Download,
  AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// 实体类型图标映射
const ENTITY_TYPE_ICONS: Record<string, React.ReactNode> = {
  company: <Building className="h-4 w-4" />,
  person: <User className="h-4 w-4" />,
  location: <MapPin className="h-4 w-4" />,
  policy: <FileText className="h-4 w-4" />,
  product: <Package className="h-4 w-4" />,
  organization: <Landmark className="h-4 w-4" />,
  event: <Calendar className="h-4 w-4" />,
  industry: <Tag className="h-4 w-4" />,
  indicator: <Hash className="h-4 w-4" />,
  other: <MoreHorizontal className="h-4 w-4" />,
};

// 实体类型中文名
const ENTITY_TYPE_NAMES: Record<string, string> = {
  company: '公司',
  person: '人物',
  location: '地点',
  policy: '政策',
  product: '产品',
  organization: '机构',
  event: '事件',
  industry: '行业',
  indicator: '指标',
  other: '其他',
};

// 实体类型颜色
const ENTITY_TYPE_COLORS: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700',
  person: 'bg-purple-100 text-purple-700',
  location: 'bg-green-100 text-green-700',
  policy: 'bg-orange-100 text-orange-700',
  product: 'bg-pink-100 text-pink-700',
  organization: 'bg-indigo-100 text-indigo-700',
  event: 'bg-yellow-100 text-yellow-700',
  industry: 'bg-cyan-100 text-cyan-700',
  indicator: 'bg-rose-100 text-rose-700',
  other: 'bg-gray-100 text-gray-700',
};

// 实体数据类型
export interface Entity {
  id: string;
  name: string;
  type: string;
  aliases?: string[];
  description?: string;
  source?: string;
  confidence?: number;
  properties?: Record<string, any>;
  relationCount?: number;
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

interface EntityBrowserProps {
  // 数据源（可以从API获取或直接传入）
  entities?: Entity[];
  // API端点（如果使用API获取）
  apiEndpoint?: string;
  // 是否显示操作按钮
  showActions?: boolean;
  // 是否支持选择
  selectable?: boolean;
  // 已选择的实体ID
  selectedIds?: string[];
  // 选择回调
  onSelectionChange?: (ids: string[]) => void;
  // 查看详情回调
  onViewDetail?: (entity: Entity) => void;
  // 编辑回调
  onEdit?: (entity: Entity) => void;
  // 删除回调
  onDelete?: (entity: Entity) => void;
  // 刷新回调
  onRefresh?: () => void;
}

export function EntityBrowser({
  entities: propEntities,
  apiEndpoint = '/api/knowledge-graph',
  showActions = true,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  onViewDetail,
  onEdit,
  onDelete,
  onRefresh,
}: EntityBrowserProps) {
  // 状态
  const [entities, setEntities] = useState<Entity[]>(propEntities || []);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });

  // 获取所有实体类型
  const entityTypes = useMemo(() => {
    const types = new Set(entities.map(e => e.type));
    return Array.from(types).sort();
  }, [entities]);

  // 筛选后的实体
  const filteredEntities = useMemo(() => {
    let result = [...entities];

    // 搜索过滤
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.name.toLowerCase().includes(query) ||
        e.aliases?.some(a => a.toLowerCase().includes(query)) ||
        e.description?.toLowerCase().includes(query)
      );
    }

    // 类型过滤
    if (typeFilter !== 'all') {
      result = result.filter(e => e.type === typeFilter);
    }

    // 排序
    result.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';

      switch (sortBy) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'relationCount':
          aVal = a.relationCount || 0;
          bVal = b.relationCount || 0;
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
  }, [entities, searchQuery, typeFilter, sortBy, sortOrder]);

  // 分页后的实体
  const paginatedEntities = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredEntities.slice(start, end);
  }, [filteredEntities, pagination.page, pagination.pageSize]);

  // 更新分页信息
  useEffect(() => {
    setPagination(prev => ({
      ...prev,
      total: filteredEntities.length,
      totalPages: Math.ceil(filteredEntities.length / prev.pageSize),
    }));
  }, [filteredEntities]);

  // 从API获取数据
  const fetchEntities = useCallback(async () => {
    if (propEntities) return; // 如果直接传入了数据，不获取

    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'entities',
        limit: '1000',
      });
      
      const response = await fetch(`${apiEndpoint}?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setEntities(data.entities || []);
      }
    } catch (error) {
      console.error('获取实体失败:', error);
    } finally {
      setLoading(false);
    }
  }, [propEntities, apiEndpoint]);

  // 初始化
  useEffect(() => {
    if (propEntities) {
      setEntities(propEntities);
    } else {
      fetchEntities();
    }
  }, [propEntities, fetchEntities]);

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
    if (selectedIds.length === paginatedEntities.length) {
      onSelectionChange?.([]);
    } else {
      onSelectionChange?.(paginatedEntities.map(e => e.id));
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
    const data = filteredEntities.map(e => ({
      名称: e.name,
      类型: ENTITY_TYPE_NAMES[e.type] || e.type,
      别名: e.aliases?.join(', ') || '',
      描述: e.description || '',
      置信度: e.confidence ? `${(e.confidence * 100).toFixed(0)}%` : '',
      关联数: e.relationCount || 0,
    }));

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map(row => Object.values(row).map(v => `"${v}"`).join(',')),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `entities_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              实体浏览器
            </CardTitle>
            <CardDescription>
              共 {filteredEntities.length} 个实体
              {typeFilter !== 'all' && ` (${ENTITY_TYPE_NAMES[typeFilter] || typeFilter})`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onRefresh || fetchEntities}>
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
              placeholder="搜索实体名称、别名..."
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
              {entityTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {ENTITY_TYPE_NAMES[type] || type}
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
              <SelectItem value="name-asc">名称 A-Z</SelectItem>
              <SelectItem value="name-desc">名称 Z-A</SelectItem>
              <SelectItem value="type-asc">类型 A-Z</SelectItem>
              <SelectItem value="relationCount-desc">关联数 多-少</SelectItem>
              <SelectItem value="relationCount-asc">关联数 少-多</SelectItem>
              <SelectItem value="confidence-desc">置信度 高-低</SelectItem>
              <SelectItem value="createdAt-desc">最新添加</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 类型统计 */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(
            entities.reduce((acc, e) => {
              acc[e.type] = (acc[e.type] || 0) + 1;
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
                  typeFilter === type ? '' : ENTITY_TYPE_COLORS[type]
                )}
                onClick={() => {
                  setTypeFilter(typeFilter === type ? 'all' : type);
                  setPagination(prev => ({ ...prev, page: 1 }));
                }}
              >
                {ENTITY_TYPE_ICONS[type]}
                <span className="ml-1">{ENTITY_TYPE_NAMES[type] || type}</span>
                <span className="ml-1 text-xs opacity-70">{count}</span>
              </Badge>
            ))}
        </div>

        {/* 实体列表 */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                {selectable && (
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === paginatedEntities.length && paginatedEntities.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </TableHead>
                )}
                <TableHead className="w-12">#</TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('name')}
                  >
                    名称
                    {sortBy === 'name' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead>
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('type')}
                  >
                    类型
                    {sortBy === 'type' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead>描述</TableHead>
                <TableHead className="w-20">
                  <button
                    className="flex items-center gap-1 hover:text-primary"
                    onClick={() => toggleSort('relationCount')}
                  >
                    关联
                    {sortBy === 'relationCount' && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </button>
                </TableHead>
                <TableHead className="w-20">
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
              ) : paginatedEntities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7 + (selectable ? 1 : 0)} className="text-center py-8">
                    <AlertTriangle className="h-6 w-6 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500 mt-2">
                      {searchQuery || typeFilter !== 'all' ? '没有找到匹配的实体' : '暂无实体数据'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedEntities.map((entity, index) => (
                  <TableRow
                    key={entity.id}
                    className={cn(
                      'hover:bg-gray-50',
                      selectedIds.includes(entity.id) && 'bg-blue-50'
                    )}
                  >
                    {selectable && (
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(entity.id)}
                          onChange={() => toggleSelect(entity.id)}
                          className="rounded"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-gray-400">
                      {(pagination.page - 1) * pagination.pageSize + index + 1}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{entity.name}</span>
                        {entity.aliases && entity.aliases.length > 0 && (
                          <span className="text-xs text-gray-400">
                            ({entity.aliases.slice(0, 2).join(', ')}
                            {entity.aliases.length > 2 && '...'})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={ENTITY_TYPE_COLORS[entity.type] || ENTITY_TYPE_COLORS.other}>
                        {ENTITY_TYPE_ICONS[entity.type] || ENTITY_TYPE_ICONS.other}
                        <span className="ml-1">{ENTITY_TYPE_NAMES[entity.type] || entity.type}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-gray-500">
                      {entity.description || '-'}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{entity.relationCount || 0}</Badge>
                    </TableCell>
                    <TableCell>
                      {entity.confidence !== undefined ? (
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full',
                                entity.confidence >= 0.8 ? 'bg-green-500' :
                                entity.confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                              )}
                              style={{ width: `${entity.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {(entity.confidence * 100).toFixed(0)}%
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
                              onClick={() => onViewDetail(entity)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEdit(entity)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => onDelete(entity)}
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

export default EntityBrowser;
