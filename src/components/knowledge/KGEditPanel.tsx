'use client';

import React, { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Check, 
  AlertCircle,
  Building2,
  User,
  MapPin,
  Scroll,
  Zap,
  Layers,
  Package,
  Circle
} from 'lucide-react';
import type { KGEntity, KGRelation, EntityType, RelationType } from '@/lib/knowledge-graph/types';

interface KGEditPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedEntity?: KGEntity | null;
  selectedRelation?: KGRelation | null;
  entities: KGEntity[];
  onUpdateEntity?: (entityId: string, updates: Partial<KGEntity>, reason?: string) => Promise<void>;
  onUpdateRelation?: (relationId: string, updates: Partial<KGRelation>, reason?: string) => Promise<void>;
  onDeleteRelation?: (relationId: string, reason?: string) => Promise<void>;
  onAddEntity?: (entity: Partial<KGEntity>) => Promise<void>;
  onAddRelation?: (relation: Partial<KGRelation>) => Promise<void>;
}

// 实体类型选项
const ENTITY_TYPES: EntityType[] = ['公司', '人物', '地点', '政策', '事件', '行业', '产品', '其他'];

// 关系类型选项
const RELATION_TYPES: RelationType[] = [
  '投资', '控股', '合作', '竞争', '供应链',
  '监管', '影响', '关联', '任职', '隶属',
  '生产', '采购', '销售', '其他'
];

// 置信度描述
function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: '高置信度', color: 'text-green-600' };
  if (confidence >= 0.6) return { label: '中等置信度', color: 'text-yellow-600' };
  return { label: '低置信度', color: 'text-red-600' };
}

export function KGEditPanel({
  open,
  onOpenChange,
  selectedEntity,
  selectedRelation,
  entities,
  onUpdateEntity,
  onUpdateRelation,
  onDeleteRelation,
  onAddEntity,
  onAddRelation
}: KGEditPanelProps) {
  const [mode, setMode] = useState<'view' | 'edit' | 'add-entity' | 'add-relation'>('view');
  const [isSaving, setIsSaving] = useState(false);
  
  // 编辑状态
  const [editEntity, setEditEntity] = useState<Partial<KGEntity>>({});
  const [editRelation, setEditRelation] = useState<Partial<KGRelation>>({});
  const [editReason, setEditReason] = useState('');
  
  // 添加实体
  const [newEntity, setNewEntity] = useState<Partial<KGEntity>>({
    name: '',
    type: '公司',
    importance: 0.5,
    description: ''
  });
  
  // 添加关系
  const [newRelation, setNewRelation] = useState<Partial<KGRelation>>({
    source_entity_id: '',
    target_entity_id: '',
    type: '关联',
    confidence: 0.5,
    evidence: ''
  });
  
  // 重置状态
  const resetState = () => {
    setMode('view');
    setEditEntity({});
    setEditRelation({});
    setEditReason('');
    setNewEntity({ name: '', type: '公司', importance: 0.5, description: '' });
    setNewRelation({ source_entity_id: '', target_entity_id: '', type: '关联', confidence: 0.5, evidence: '' });
  };
  
  // 保存实体修改
  const handleSaveEntity = async () => {
    if (!selectedEntity || !onUpdateEntity) return;
    setIsSaving(true);
    try {
      await onUpdateEntity(selectedEntity.id, editEntity, editReason);
      resetState();
    } catch (error) {
      console.error('Save entity error:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 保存关系修改
  const handleSaveRelation = async () => {
    if (!selectedRelation || !onUpdateRelation) return;
    setIsSaving(true);
    try {
      await onUpdateRelation(selectedRelation.id, editRelation, editReason);
      resetState();
    } catch (error) {
      console.error('Save relation error:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 删除关系
  const handleDeleteRelation = async () => {
    if (!selectedRelation || !onDeleteRelation) return;
    setIsSaving(true);
    try {
      await onDeleteRelation(selectedRelation.id, editReason);
      resetState();
      onOpenChange(false);
    } catch (error) {
      console.error('Delete relation error:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 添加实体
  const handleAddEntity = async () => {
    if (!newEntity.name || !onAddEntity) return;
    setIsSaving(true);
    try {
      await onAddEntity({
        ...newEntity,
        source_type: 'manual',
        verified: true
      });
      resetState();
    } catch (error) {
      console.error('Add entity error:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  // 添加关系
  const handleAddRelation = async () => {
    if (!newRelation.source_entity_id || !newRelation.target_entity_id || !onAddRelation) return;
    setIsSaving(true);
    try {
      await onAddRelation({
        ...newRelation,
        source_type: 'manual',
        verified: true
      });
      resetState();
    } catch (error) {
      console.error('Add relation error:', error);
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) resetState(); onOpenChange(v); }}>
      <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {mode === 'add-entity' && '添加实体'}
            {mode === 'add-relation' && '添加关系'}
            {mode === 'edit' && '编辑知识图谱'}
            {mode === 'view' && '知识图谱详情'}
          </SheetTitle>
          <SheetDescription>
            {mode === 'view' && '查看选中的实体或关系详情'}
            {mode === 'edit' && '修改后将同步更新知识库'}
            {mode === 'add-entity' && '手动添加新的实体到知识图谱'}
            {mode === 'add-relation' && '手动添加新的关系到知识图谱'}
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* 操作按钮 */}
          <div className="flex gap-2">
            {mode === 'view' && (
              <>
                {selectedEntity && (
                  <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
                    <Edit3 className="w-4 h-4 mr-1" />
                    编辑实体
                  </Button>
                )}
                {selectedRelation && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setMode('edit')}>
                      <Edit3 className="w-4 h-4 mr-1" />
                      编辑关系
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4 mr-1" />
                          删除
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除关系？</AlertDialogTitle>
                          <AlertDialogDescription>
                            删除后将从知识库中移除此关系，但历史记录会保留。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteRelation}>确认删除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
                <Button variant="outline" size="sm" onClick={() => setMode('add-entity')}>
                  + 添加实体
                </Button>
                <Button variant="outline" size="sm" onClick={() => setMode('add-relation')}>
                  + 添加关系
                </Button>
              </>
            )}
            {mode !== 'view' && (
              <Button variant="ghost" size="sm" onClick={resetState}>
                <X className="w-4 h-4 mr-1" />
                取消
              </Button>
            )}
          </div>
          
          {/* 查看实体 */}
          {mode === 'view' && selectedEntity && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{selectedEntity.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedEntity.type}</p>
                </div>
                {selectedEntity.verified && (
                  <Badge className="bg-green-100 text-green-700">
                    <Check className="w-3 h-3 mr-1" />
                    已验证
                  </Badge>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">重要度：</span>
                  <span>{(selectedEntity.importance * 100).toFixed(0)}%</span>
                </div>
                <div>
                  <span className="text-muted-foreground">来源：</span>
                  <span>{selectedEntity.source_type === 'llm' ? 'AI抽取' : selectedEntity.source_type === 'merged' ? '合并' : selectedEntity.source_type === 'manual' ? '手动添加' : 'AI抽取'}</span>
                </div>
              </div>
              
              {selectedEntity.description && (
                <div>
                  <span className="text-sm text-muted-foreground">描述：</span>
                  <p className="text-sm mt-1">{selectedEntity.description}</p>
                </div>
              )}
              
              {selectedEntity.aliases && selectedEntity.aliases.length > 0 && (
                <div>
                  <span className="text-sm text-muted-foreground">别名：</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedEntity.aliases.map((alias, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{alias}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* 查看关系 */}
          {mode === 'view' && selectedRelation && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {selectedRelation.source_name || selectedRelation.source_entity_id}
                </Badge>
                <span className="text-lg font-medium text-muted-foreground">→</span>
                <Badge className="text-base px-3 py-1">
                  {selectedRelation.type}
                </Badge>
                <span className="text-lg font-medium text-muted-foreground">→</span>
                <Badge variant="secondary" className="text-base px-3 py-1">
                  {selectedRelation.target_name || selectedRelation.target_entity_id}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">置信度：</span>
                  <span className={getConfidenceLabel(selectedRelation.confidence).color}>
                    {(selectedRelation.confidence * 100).toFixed(0)}%
                    {' '}({getConfidenceLabel(selectedRelation.confidence).label})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">来源：</span>
                  <span>{selectedRelation.source_type === 'llm' ? 'AI抽取' : selectedRelation.source_type === 'merged' ? '合并' : selectedRelation.source_type === 'manual' ? '手动添加' : 'AI抽取'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">验证状态：</span>
                  <span>
                    {selectedRelation.verified ? (
                      <Badge className="bg-green-100 text-green-700 text-xs">已验证</Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-700 text-xs">待验证</Badge>
                    )}
                  </span>
                </div>
              </div>
              
              {selectedRelation.evidence && (
                <div>
                  <span className="text-sm text-muted-foreground">证据来源：</span>
                  <p className="text-sm mt-1 p-2 bg-muted rounded">{selectedRelation.evidence}</p>
                </div>
              )}
            </div>
          )}
          
          {/* 编辑实体 */}
          {mode === 'edit' && selectedEntity && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="entity-name">实体名称</Label>
                <Input
                  id="entity-name"
                  value={editEntity.name || selectedEntity.name}
                  onChange={(e) => setEditEntity({ ...editEntity, name: e.target.value })}
                />
              </div>
              
              <div>
                <Label htmlFor="entity-type">实体类型</Label>
                <Select
                  value={editEntity.type || selectedEntity.type}
                  onValueChange={(v) => setEditEntity({ ...editEntity, type: v as EntityType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>重要度: {((editEntity.importance || selectedEntity.importance) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[(editEntity.importance || selectedEntity.importance) * 100]}
                  onValueChange={(v) => setEditEntity({ ...editEntity, importance: v[0] / 100 })}
                  max={100}
                  step={5}
                />
              </div>
              
              <div>
                <Label htmlFor="entity-desc">描述</Label>
                <Textarea
                  id="entity-desc"
                  value={editEntity.description || selectedEntity.description || ''}
                  onChange={(e) => setEditEntity({ ...editEntity, description: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-reason">修改原因（可选）</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="记录修改原因，便于审计追溯"
                  rows={2}
                />
              </div>
              
              <Button onClick={handleSaveEntity} disabled={isSaving} className="w-full">
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? '保存中...' : '保存修改'}
              </Button>
            </div>
          )}
          
          {/* 编辑关系 */}
          {mode === 'edit' && selectedRelation && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-medium">{selectedRelation.source_name}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-medium">{selectedRelation.target_name}</span>
              </div>
              
              <div>
                <Label htmlFor="relation-type">关系类型</Label>
                <Select
                  value={editRelation.type || selectedRelation.type}
                  onValueChange={(v) => setEditRelation({ ...editRelation, type: v as RelationType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>置信度: {((editRelation.confidence || selectedRelation.confidence) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[(editRelation.confidence || selectedRelation.confidence) * 100]}
                  onValueChange={(v) => setEditRelation({ ...editRelation, confidence: v[0] / 100 })}
                  max={100}
                  step={5}
                />
              </div>
              
              <div>
                <Label htmlFor="relation-evidence">证据来源</Label>
                <Textarea
                  id="relation-evidence"
                  value={editRelation.evidence || selectedRelation.evidence || ''}
                  onChange={(e) => setEditRelation({ ...editRelation, evidence: e.target.value })}
                  placeholder="提供关系的证据来源"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="edit-reason">修改原因（可选）</Label>
                <Textarea
                  id="edit-reason"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="记录修改原因，便于审计追溯"
                  rows={2}
                />
              </div>
              
              <Button onClick={handleSaveRelation} disabled={isSaving} className="w-full">
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? '保存中...' : '保存修改'}
              </Button>
            </div>
          )}
          
          {/* 添加实体 */}
          {mode === 'add-entity' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-entity-name">实体名称 *</Label>
                <Input
                  id="new-entity-name"
                  value={newEntity.name}
                  onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                  placeholder="输入实体名称"
                />
              </div>
              
              <div>
                <Label htmlFor="new-entity-type">实体类型</Label>
                <Select
                  value={newEntity.type}
                  onValueChange={(v) => setNewEntity({ ...newEntity, type: v as EntityType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTITY_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>重要度: {(newEntity.importance! * 100).toFixed(0)}%</Label>
                <Slider
                  value={[newEntity.importance! * 100]}
                  onValueChange={(v) => setNewEntity({ ...newEntity, importance: v[0] / 100 })}
                  max={100}
                  step={5}
                />
              </div>
              
              <div>
                <Label htmlFor="new-entity-desc">描述</Label>
                <Textarea
                  id="new-entity-desc"
                  value={newEntity.description}
                  onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                  placeholder="输入实体描述"
                  rows={2}
                />
              </div>
              
              <Button onClick={handleAddEntity} disabled={isSaving || !newEntity.name} className="w-full">
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? '添加中...' : '添加实体'}
              </Button>
            </div>
          )}
          
          {/* 添加关系 */}
          {mode === 'add-relation' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="new-relation-source">源实体</Label>
                <Select
                  value={newRelation.source_entity_id}
                  onValueChange={(v) => setNewRelation({ ...newRelation, source_entity_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择源实体" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="new-relation-type">关系类型</Label>
                <Select
                  value={newRelation.type}
                  onValueChange={(v) => setNewRelation({ ...newRelation, type: v as RelationType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATION_TYPES.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="new-relation-target">目标实体</Label>
                <Select
                  value={newRelation.target_entity_id}
                  onValueChange={(v) => setNewRelation({ ...newRelation, target_entity_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择目标实体" />
                  </SelectTrigger>
                  <SelectContent>
                    {entities.filter(e => e.id !== newRelation.source_entity_id).map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name} ({e.type})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>置信度: {(newRelation.confidence! * 100).toFixed(0)}%</Label>
                <Slider
                  value={[newRelation.confidence! * 100]}
                  onValueChange={(v) => setNewRelation({ ...newRelation, confidence: v[0] / 100 })}
                  max={100}
                  step={5}
                />
              </div>
              
              <div>
                <Label htmlFor="new-relation-evidence">证据来源</Label>
                <Textarea
                  id="new-relation-evidence"
                  value={newRelation.evidence}
                  onChange={(e) => setNewRelation({ ...newRelation, evidence: e.target.value })}
                  placeholder="提供关系的证据来源"
                  rows={2}
                />
              </div>
              
              <Button 
                onClick={handleAddRelation} 
                disabled={isSaving || !newRelation.source_entity_id || !newRelation.target_entity_id} 
                className="w-full"
              >
                <Save className="w-4 h-4 mr-1" />
                {isSaving ? '添加中...' : '添加关系'}
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
