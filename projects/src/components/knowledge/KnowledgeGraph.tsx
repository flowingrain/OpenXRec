'use client';

import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  NodeTypes,
  EdgeTypes,
  MarkerType,
  Position,
  Handle,
  NodeProps,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  User, 
  MapPin, 
  Scroll, 
  Zap, 
  Layers, 
  Package, 
  Circle,
  Edit3,
  Trash2,
  Check,
  AlertCircle,
  Download,
  Image as ImageIcon,
  FileJson,
  Camera,
  History
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EvolutionHistoryPanel } from '@/components/evolution/EvolutionHistoryPanel';
import type { KGEntity, KGRelation, EntityType, RelationType } from '@/lib/knowledge-graph/types';
import { ENTITY_ORDER, REL_ORDER } from '@/lib/knowledge-graph/kg-type-normalize';

// 图标映射
const IconMap: Record<string, React.FC<any>> = {
  Building2,
  User,
  MapPin,
  Scroll,
  Zap,
  Layers,
  Package,
  Circle
};

interface KnowledgeGraphProps {
  entities: KGEntity[];
  relations: KGRelation[];
  onNodeClick?: (entity: KGEntity) => void;
  onEdgeClick?: (relation: KGRelation) => void;
  editable?: boolean;
  height?: number;
}

// 实体类型配置
const ENTITY_CONFIG: Record<EntityType, { color: string; icon: string }> = {
  '公司': { color: '#3b82f6', icon: 'Building2' },
  '人物': { color: '#8b5cf6', icon: 'User' },
  '地点': { color: '#10b981', icon: 'MapPin' },
  '政策': { color: '#f59e0b', icon: 'Scroll' },
  '事件': { color: '#ef4444', icon: 'Zap' },
  '行业': { color: '#06b6d4', icon: 'Layers' },
  '产品': { color: '#ec4899', icon: 'Package' },
  '其他': { color: '#6b7280', icon: 'Circle' }
};

// 关系类型配置
const RELATION_CONFIG: Record<RelationType, { color: string; label: string }> = {
  '投资': { color: '#22c55e', label: '投资' },
  '控股': { color: '#ef4444', label: '控股' },
  '合作': { color: '#3b82f6', label: '合作' },
  '竞争': { color: '#f97316', label: '竞争' },
  '供应链': { color: '#8b5cf6', label: '供应链' },
  '监管': { color: '#dc2626', label: '监管' },
  '影响': { color: '#f59e0b', label: '影响' },
  '关联': { color: '#6b7280', label: '关联' },
  '任职': { color: '#06b6d4', label: '任职' },
  '隶属': { color: '#7c3aed', label: '隶属' },
  '生产': { color: '#10b981', label: '生产' },
  '采购': { color: '#0ea5e9', label: '采购' },
  '销售': { color: '#14b8a6', label: '销售' },
  '其他': { color: '#9ca3af', label: '其他' }
};

function getEntityRawLabel(entity: KGEntity): string {
  const raw = entity.properties?.typeLabelRaw;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : entity.type;
}

function getRelationRawLabel(relation: KGRelation): string {
  const raw = relation.properties?.relationLabelRaw;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : relation.type;
}

/** 根据动态类型标签稳定生成颜色，确保不同类型自动区分 */
function colorFromLabel(label: string, mode: 'entity' | 'relation'): string {
  const s = (label || '').trim() || (mode === 'entity' ? '实体' : '关系');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  const sat = mode === 'entity' ? 68 : 62;
  const light = mode === 'entity' ? 46 : 40;
  return `hsl(${hue} ${sat}% ${light}%)`;
}

function markerIdFromRelationLabel(label: string): string {
  const token = label.trim().replace(/[^\w\u4e00-\u9fa5-]/g, '_').slice(0, 24) || 'relation';
  return `arrow-${token}`;
}

function isLikelyPersistedId(id: string): boolean {
  if (!id) return false;
  // 抽取接口返回的临时ID通常是 entity_/relation_ 前缀；数据库主键通常不是该前缀。
  if (id.startsWith('entity_') || id.startsWith('relation_')) return false;
  return true;
}

// 自定义实体节点
function EntityNode({ data, selected }: NodeProps) {
  const config = ENTITY_CONFIG[data.type as EntityType] || ENTITY_CONFIG['行业'];
  const rawTypeLabel =
    typeof data?.properties?.typeLabelRaw === 'string' && data.properties.typeLabelRaw.trim()
      ? data.properties.typeLabelRaw.trim()
      : data.type;
  const dynamicColor = colorFromLabel(rawTypeLabel, 'entity');
  const Icon = IconMap[config.icon] || Circle;
  
  // 已验证用实线边框，待验证用虚线边框 + 更淡的颜色
  const borderColor = data.verified ? dynamicColor : `${dynamicColor}80`;
  const borderStyle = data.verified ? 'solid' : 'dashed';
  const borderWidth = data.verified ? 2 : 2;
  const opacity = data.verified ? 1 : 0.7;
  
  return (
    <div
      className={`
        px-3 py-2 rounded-lg shadow-md transition-all cursor-pointer
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
      `}
      style={{
        backgroundColor: data.verified 
          ? `${dynamicColor}15` 
          : `${dynamicColor}08`,
        borderStyle,
        borderWidth,
        borderColor,
        minWidth: 80,
        maxWidth: 150,
        opacity,
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400" />
      
      <div className="flex items-center gap-2">
        <div 
          className="w-6 h-6 rounded-full flex items-center justify-center"
          style={{ 
            backgroundColor: data.verified ? dynamicColor : `${dynamicColor}80`,
            borderStyle: data.verified ? 'solid' : 'dashed',
            borderWidth: 1,
          }}
        >
          <Icon className="w-3 h-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate" title={data.name}>
            {data.name}
          </div>
          <div className="text-[10px] text-gray-500 flex items-center gap-1">
            <span title={(data.properties as { typeLabelRaw?: string } | undefined)?.typeLabelRaw}>
              {String(rawTypeLabel).slice(0, 12)}
            </span>
            {data.verified ? (
              <Check className="w-2.5 h-2.5 text-green-500" />
            ) : (
              <AlertCircle className="w-2.5 h-2.5 text-amber-500" />
            )}
          </div>
        </div>
      </div>
      
      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-400" />
    </div>
  );
}

// 自定义关系边
function RelationEdge({ id, sourceX, sourceY, targetX, targetY, data, selected }: any) {
  const config = RELATION_CONFIG[data.type as RelationType] || RELATION_CONFIG['关联'];
  const rawLabel =
    typeof data?.properties?.relationLabelRaw === 'string' && data.properties.relationLabelRaw.trim()
      ? data.properties.relationLabelRaw.trim()
      : config.label;
  const dynamicColor = colorFromLabel(rawLabel, 'relation');
  
  const edgePath = `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  const centerX = (sourceX + targetX) / 2;
  const centerY = (sourceY + targetY) / 2;
  
  // 已验证用实线，待验证用虚线 + 更细
  const strokeWidth = selected ? 3 : (data.verified ? 2.5 : 2);
  const strokeDasharray = data.verified ? '0' : '8,4';
  const opacity = data.verified ? 1 : 0.6;
  
  return (
    <>
      {/* 待验证时添加背景阴影效果 */}
      {!data.verified && (
        <path
          id={`${id}-shadow`}
          className="react-flow__edge-path"
          d={edgePath}
          stroke={config.color}
          stroke={dynamicColor}
          strokeWidth={strokeWidth + 2}
          strokeDasharray={strokeDasharray}
          fill="none"
          opacity={0.2}
        />
      )}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        stroke={config.color}
        stroke={dynamicColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        opacity={opacity}
        markerEnd={`url(#${markerIdFromRelationLabel(rawLabel)})`}
      />
      {/* 关系标签 */}
      <g transform={`translate(${centerX}, ${centerY})`}>
        <rect
          x={-20}
          y={-8}
          width={40}
          height={16}
          rx={4}
          fill="white"
          stroke={config.color}
          stroke={dynamicColor}
          strokeWidth={data.verified ? 1.5 : 1}
          strokeDasharray={data.verified ? '0' : '4,2'}
          opacity={opacity}
        />
        <text
          x={0}
          y={0}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={9}
          fill={config.color}
          fill={dynamicColor}
          fontWeight={data.verified ? 600 : 400}
          opacity={opacity}
        >
          {String(rawLabel).slice(0, 8)}
        </text>
        {/* 置信度指示 */}
        {data.confidence < 0.7 && (
          <circle cx={25} cy={0} r={4} fill="#f59e0b" />
        )}
        {/* 待验证标记 */}
        {!data.verified && (
          <circle cx={25} cy={0} r={4} fill="#f59e0b">
            <title>待验证</title>
          </circle>
        )}
      </g>
    </>
  );
}

// 节点类型注册
const nodeTypes: NodeTypes = {
  entity: EntityNode
};

// 边类型注册
const edgeTypes: EdgeTypes = {
  relation: RelationEdge
};

// 力导向布局算法
function layoutGraph(entities: KGEntity[], relations: KGRelation[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  console.log('[KnowledgeGraph] layoutGraph input:', { 
    entityCount: entities.length, 
    relationCount: relations.length,
    sampleEntity: entities[0],
    sampleRelation: relations[0]
  });
  
  if (entities.length === 0) {
    return { nodes, edges };
  }
  
  // 画布参数
  const width = 800;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;
  
  // 力导向布局参数
  const iterations = 300; // 迭代次数
  const idealEdgeLength = 150; // 理想边长
  const repulsionStrength = 5000; // 斥力强度
  const attractionStrength = 0.1; // 引力强度
  const damping = 0.9; // 阻尼系数
  const minDistance = 80; // 最小节点距离
  
  // 初始化节点位置
  const positions: Map<string, { x: number; y: number; vx: number; vy: number; importance: number }> = new Map();
  
  // 按重要度排序
  const sortedEntities = [...entities].sort((a, b) => b.importance - a.importance);
  
  // 初始化位置：核心实体居中，其他随机分布
  sortedEntities.forEach((entity, index) => {
    if (index === 0) {
      // 核心实体居中
      positions.set(entity.id, { 
        x: centerX, 
        y: centerY, 
        vx: 0, 
        vy: 0,
        importance: entity.importance 
      });
    } else {
      // 其他实体随机分布在圆周上，然后添加一些随机偏移
      const angle = (2 * Math.PI * index) / entities.length + Math.random() * 0.5;
      const radius = 150 + Math.random() * 100;
      positions.set(entity.id, {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle),
        vx: 0,
        vy: 0,
        importance: entity.importance
      });
    }
  });
  
  // 构建邻接表（用于快速查找邻居）
  const adjacency: Map<string, Set<string>> = new Map();
  entities.forEach(e => adjacency.set(e.id, new Set()));
  relations.forEach(r => {
    adjacency.get(r.source_entity_id)?.add(r.target_entity_id);
    adjacency.get(r.target_entity_id)?.add(r.source_entity_id);
  });
  
  // 力导向迭代
  for (let iter = 0; iter < iterations; iter++) {
    // 计算斥力（所有节点对之间）
    const entityIds = Array.from(positions.keys());
    for (let i = 0; i < entityIds.length; i++) {
      for (let j = i + 1; j < entityIds.length; j++) {
        const id1 = entityIds[i];
        const id2 = entityIds[j];
        const p1 = positions.get(id1)!;
        const p2 = positions.get(id2)!;
        
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // 防止距离过小导致力过大
        distance = Math.max(distance, minDistance);
        
        // 斥力大小与距离平方成反比
        const force = repulsionStrength / (distance * distance);
        
        // 力的方向
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        // 应用斥力（方向相反）
        p1.vx -= fx;
        p1.vy -= fy;
        p2.vx += fx;
        p2.vy += fy;
      }
    }
    
    // 计算引力（有关系的节点之间）
    relations.forEach(r => {
      const p1 = positions.get(r.source_entity_id);
      const p2 = positions.get(r.target_entity_id);
      
      if (p1 && p2) {
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let distance = Math.sqrt(dx * dx + dy * dy);
        
        // 防止距离为0
        distance = Math.max(distance, 1);
        
        // 引力：弹簧模型，距离越远引力越大
        const displacement = distance - idealEdgeLength;
        const force = displacement * attractionStrength;
        
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        
        // 应用引力
        p1.vx += fx;
        p1.vy += fy;
        p2.vx -= fx;
        p2.vy -= fy;
      }
    });
    
    // 更新位置并应用阻尼
    positions.forEach(p => {
      // 应用阻尼
      p.vx *= damping;
      p.vy *= damping;
      
      // 限制最大速度
      const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSpeed = 50;
      if (speed > maxSpeed) {
        p.vx = (p.vx / speed) * maxSpeed;
        p.vy = (p.vy / speed) * maxSpeed;
      }
      
      // 更新位置
      p.x += p.vx;
      p.y += p.vy;
      
      // 边界约束（保持在画布内，留出边距）
      const margin = 60;
      p.x = Math.max(margin, Math.min(width - margin, p.x));
      p.y = Math.max(margin, Math.min(height - margin, p.y));
    });
  }
  
  // 创建节点
  entities.forEach(entity => {
    const pos = positions.get(entity.id);
    if (pos) {
      nodes.push({
        id: entity.id,
        type: 'entity',
        position: { x: pos.x - 50, y: pos.y - 20 }, // 调整偏移使节点中心对齐
        data: entity
      });
    }
  });
  
  // 创建边
  relations.forEach(relation => {
    const rawLabel = getRelationRawLabel(relation);
    const dynamicColor = colorFromLabel(rawLabel, 'relation');
    
    edges.push({
      id: relation.id,
      source: relation.source_entity_id,
      target: relation.target_entity_id,
      type: 'relation',
      animated: !relation.verified,
      data: relation,
      style: { stroke: dynamicColor, strokeWidth: relation.verified ? 2 : 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: dynamicColor
      }
    });
  });
  
  return { nodes, edges };
}

export default function KnowledgeGraph({
  entities,
  relations,
  onNodeClick,
  onEdgeClick,
  editable = false,
  height = 600
}: KnowledgeGraphProps) {
  console.log('[KnowledgeGraph] Props received:', { 
    entitiesCount: entities?.length, 
    relationsCount: relations?.length 
  });
  
  const [selectedNode, setSelectedNode] = useState<KGEntity | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<KGRelation | null>(null);
  const [showEvolutionHistory, setShowEvolutionHistory] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const pushNotice = useCallback((type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    window.setTimeout(() => setNotice((prev) => (prev?.text === text ? null : prev)), 2200);
  }, []);

  /** 图例仅展示当前图中实际出现的规范类型（与节点/边颜色一致） */
  const legendEntityTypes = useMemo(() => {
    const present = new Set(entities.map((e) => e.type));
    return ENTITY_ORDER.filter((t) => present.has(t));
  }, [entities]);

  const legendRelationTypes = useMemo(() => {
    const present = new Set(relations.map((r) => r.type));
    return REL_ORDER.filter((t) => present.has(t));
  }, [relations]);

  /** 动态细粒度类型（来自抽取原始标签），做适度聚合避免过细 */
  const dynamicEntityLegend = useMemo(() => {
    const counter = new Map<string, { count: number; canonical: EntityType }>();
    for (const e of entities) {
      const label = getEntityRawLabel(e);
      const old = counter.get(label);
      if (old) {
        old.count += 1;
      } else {
        counter.set(label, { count: 1, canonical: e.type });
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);
  }, [entities]);

  const dynamicRelationLegend = useMemo(() => {
    const counter = new Map<string, { count: number; canonical: RelationType }>();
    for (const r of relations) {
      const label = getRelationRawLabel(r);
      const old = counter.get(label);
      if (old) {
        old.count += 1;
      } else {
        counter.set(label, { count: 1, canonical: r.type });
      }
    }
    return Array.from(counter.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 12);
  }, [relations]);

  // 布局计算
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => layoutGraph(entities, relations),
    [entities, relations]
  );
  
  console.log('[KnowledgeGraph] layout result:', { 
    nodesCount: layoutNodes.length, 
    edgesCount: layoutEdges.length,
    sampleNode: layoutNodes[0]
  });
  
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);
  const lastLayoutKeyRef = useRef<string>('');
  const graphLayoutKey = useMemo(() => {
    const entityIds = entities.map((e) => e.id).sort().join('|');
    const relationIds = relations.map((r) => r.id).sort().join('|');
    return `${entityIds}::${relationIds}`;
  }, [entities, relations]);
  
  // 仅在图谱结构变化时重排；避免拖拽后被每次渲染重置位置
  useEffect(() => {
    if (layoutNodes.length > 0 && lastLayoutKeyRef.current !== graphLayoutKey) {
      setNodes(layoutNodes);
      setEdges(layoutEdges);
      lastLayoutKeyRef.current = graphLayoutKey;
    }
  }, [layoutNodes, layoutEdges, graphLayoutKey, setNodes, setEdges]);
  
  // 节点点击
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    const entity = entities.find(e => e.id === node.id);
    if (entity) {
      setSelectedNode(entity);
      setSelectedEdge(null);
      onNodeClick?.(entity);
    }
  }, [entities, onNodeClick]);
  
  // 边点击
  const handleEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    const relation = relations.find(r => r.id === edge.id);
    if (relation) {
      setSelectedEdge(relation);
      setSelectedNode(null);
      onEdgeClick?.(relation);
    }
  }, [relations, onEdgeClick]);

  const handleConfirmSelected = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (selectedNode) {
        if (isLikelyPersistedId(selectedNode.id)) {
          const res = await fetch('/api/knowledge-graph/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-entity',
              payload: { id: selectedNode.id, data: { verified: true, source_type: 'manual' } },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || '确认实体失败');
          }
        } else {
          const res = await fetch('/api/knowledge-graph/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upsert-entity',
              payload: {
                id: selectedNode.id,
                name: selectedNode.name,
                type: selectedNode.type,
                description: selectedNode.description || '',
                aliases: selectedNode.aliases || [],
                importance: selectedNode.importance ?? 0.5,
                properties: selectedNode.properties || {},
                verified: true,
                source_type: 'manual',
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || '确认实体失败');
          }
          const upsertResult = await res.json().catch(() => ({})) as { data?: { id?: string } };
          const persistedId = upsertResult?.data?.id;
          const oldTempId = selectedNode.id;
          if (persistedId && persistedId !== oldTempId) {
            setNodes((prev) =>
              prev.map((n) =>
                n.id === oldTempId
                  ? { ...n, id: persistedId, data: { ...n.data, verified: true, source_type: 'manual' } }
                  : n
              )
            );
            // 实体 ID 替换后，所有关联边端点同步替换，避免后续编辑/确认找不到实体。
            setEdges((prev) =>
              prev.map((e) => ({
                ...e,
                source: e.source === oldTempId ? persistedId : e.source,
                target: e.target === oldTempId ? persistedId : e.target,
                data: {
                  ...(e.data || {}),
                  source_entity_id: e.source === oldTempId ? persistedId : (e.data as any)?.source_entity_id,
                  target_entity_id: e.target === oldTempId ? persistedId : (e.data as any)?.target_entity_id,
                },
              }))
            );
            setSelectedNode({ ...selectedNode, id: persistedId, verified: true });
            pushNotice('success', '实体已确认并固化');
            return;
          }
        }
        setSelectedNode({ ...selectedNode, verified: true });
        setNodes((prev) =>
          prev.map((n) =>
            n.id === selectedNode.id
              ? { ...n, data: { ...n.data, verified: true, source_type: 'manual' } }
              : n
          )
        );
        pushNotice('success', '实体已确认');
      } else if (selectedEdge) {
        if (isLikelyPersistedId(selectedEdge.id)) {
          const res = await fetch('/api/knowledge-graph/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'update-relation',
              payload: { id: selectedEdge.id, data: { verified: true, source_type: 'manual' } },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || '确认关系失败');
          }
        } else {
          const sourceEntity = entities.find((e) => e.id === selectedEdge.source_entity_id);
          const targetEntity = entities.find((e) => e.id === selectedEdge.target_entity_id);
          const res = await fetch('/api/knowledge-graph/entities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'upsert-relation',
              payload: {
                id: selectedEdge.id,
                source_entity_id: selectedEdge.source_entity_id,
                target_entity_id: selectedEdge.target_entity_id,
                source_name: sourceEntity?.name,
                target_name: targetEntity?.name,
                source_type_hint: sourceEntity?.type,
                target_type_hint: targetEntity?.type,
                type: selectedEdge.type,
                confidence: selectedEdge.confidence ?? 0.8,
                evidence: selectedEdge.evidence || '',
                properties: selectedEdge.properties || {},
                verified: true,
                source_type: 'manual',
              },
            }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || '确认关系失败');
          }
          const upsertResult = await res.json().catch(() => ({})) as {
            data?: { id?: string; source_entity_id?: string; target_entity_id?: string };
          };
          const persistedRelId = upsertResult?.data?.id;
          const persistedSourceId = upsertResult?.data?.source_entity_id || selectedEdge.source_entity_id;
          const persistedTargetId = upsertResult?.data?.target_entity_id || selectedEdge.target_entity_id;
          const oldTempRelId = selectedEdge.id;
          if (persistedRelId && persistedRelId !== oldTempRelId) {
            setEdges((prev) =>
              prev.map((e) =>
                e.id === oldTempRelId
                  ? {
                      ...e,
                      id: persistedRelId,
                      source: persistedSourceId,
                      target: persistedTargetId,
                      animated: false,
                      style: { ...(e.style || {}), strokeWidth: 2.5 },
                      data: {
                        ...e.data,
                        source_entity_id: persistedSourceId,
                        target_entity_id: persistedTargetId,
                        verified: true,
                        source_type: 'manual',
                      },
                    }
                  : e
              )
            );
            setSelectedEdge({
              ...selectedEdge,
              id: persistedRelId,
              source_entity_id: persistedSourceId,
              target_entity_id: persistedTargetId,
              verified: true,
            });
            pushNotice('success', '关系已确认并固化');
            return;
          }
        }
        setSelectedEdge({ ...selectedEdge, verified: true });
        setEdges((prev) =>
          prev.map((e) =>
            e.id === selectedEdge.id
              ? {
                  ...e,
                  animated: false,
                  style: { ...(e.style || {}), strokeWidth: 2.5 },
                  data: { ...e.data, verified: true, source_type: 'manual' },
                }
              : e
          )
        );
        pushNotice('success', '关系已确认');
      }
    } catch (e) {
      console.error('[KnowledgeGraph] confirm failed', e);
      pushNotice('error', '确认失败，请稍后重试');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, selectedNode, selectedEdge, pushNotice, entities]);

  const handleQuickEditSelected = useCallback(async () => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      if (selectedNode) {
        const nextDesc = window.prompt('编辑实体描述', selectedNode.description || '');
        if (nextDesc == null) return;
        const res = await fetch('/api/knowledge-graph/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-entity',
            payload: { id: selectedNode.id, data: { description: nextDesc } },
          }),
        });
        if (!res.ok) throw new Error('编辑实体失败');
        setSelectedNode({ ...selectedNode, description: nextDesc });
        pushNotice('success', '实体已更新');
      } else if (selectedEdge) {
        const nextEvidence = window.prompt('编辑关系证据', selectedEdge.evidence || '');
        if (nextEvidence == null) return;
        const res = await fetch('/api/knowledge-graph/entities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update-relation',
            payload: { id: selectedEdge.id, data: { evidence: nextEvidence } },
          }),
        });
        if (!res.ok) throw new Error('编辑关系失败');
        setSelectedEdge({ ...selectedEdge, evidence: nextEvidence });
        pushNotice('success', '关系已更新');
      }
    } catch (e) {
      console.error('[KnowledgeGraph] quick edit failed', e);
      pushNotice('error', '编辑失败，请稍后重试');
    } finally {
      setActionBusy(false);
    }
  }, [actionBusy, selectedNode, selectedEdge, pushNotice]);
  
  if (entities.length === 0) {
    return (
      <div 
        className="flex flex-col items-center justify-center border rounded-lg bg-muted/20"
        style={{ height }}
      >
        <Layers className="w-16 h-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">暂无知识图谱数据</p>
        <p className="text-xs text-muted-foreground/60 mt-1">分析后将自动构建知识图谱</p>
      </div>
    );
  }
  
  return (
    <div className="relative border rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50" style={{ height }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        zoomOnPinch={true}
        zoomOnDoubleClick={true}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.65, maxZoom: 1.2 }}
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls className="!bg-white !shadow-lg !border !rounded-lg" />
        <MiniMap
          className="!bg-white !border !rounded-lg"
          nodeColor={(node) => {
            const rawType =
              typeof node.data?.properties?.typeLabelRaw === 'string' && node.data.properties.typeLabelRaw.trim()
                ? node.data.properties.typeLabelRaw.trim()
                : String(node.data?.type || '实体');
            return colorFromLabel(rawType, 'entity');
          }}
        />
        
        {/* 定义箭头标记 */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            {dynamicRelationLegend.map(([label]) => (
              <marker
                key={label}
                id={markerIdFromRelationLabel(label)}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={colorFromLabel(label, 'relation')} />
              </marker>
            ))}
          </defs>
        </svg>
      </ReactFlow>
      
      {/* 图例：仅展示动态发现类型 */}
      <div className="pointer-events-none absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs max-w-[320px]">
        <div className="font-medium mb-2">实体类型（动态发现）</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {dynamicEntityLegend.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            dynamicEntityLegend.map(([label, meta]) => {
              const color = colorFromLabel(label, 'entity');
              return (
                <div key={label} className="flex items-center gap-1" title={`映射为：${meta.canonical} · ${meta.count}个节点`}>
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="font-medium mb-2">关系类型（动态发现）</div>
        <div className="flex flex-wrap gap-2 mb-3">
          {dynamicRelationLegend.length === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            dynamicRelationLegend.map(([label, meta]) => {
              const color = colorFromLabel(label, 'relation');
              return (
                <div key={label} className="flex items-center gap-1" title={`映射为：${meta.canonical} · ${meta.count}条关系`}>
                  <div className="w-6 h-0.5" style={{ backgroundColor: color }} />
                  <span>{label}</span>
                </div>
              );
            })
          )}
        </div>
      </div>
      
      {/* 非阻断提示 */}
      {notice && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div
            className={
              notice.type === 'success'
                ? 'bg-emerald-600 text-white text-xs px-3 py-1.5 rounded shadow'
                : 'bg-rose-600 text-white text-xs px-3 py-1.5 rounded shadow'
            }
          >
            {notice.text}
          </div>
        </div>
      )}

      {/* 状态说明 */}
      <div className="pointer-events-none absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {/* 已验证：实线 */}
            <svg width="20" height="8" className="align-middle">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#6b7280" strokeWidth="2" />
            </svg>
            <span className="text-gray-700">已验证</span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* 待验证：虚线 */}
            <svg width="20" height="8" className="align-middle">
              <line x1="0" y1="4" x2="20" y2="4" stroke="#6b7280" strokeWidth="2" strokeDasharray="4,3" />
            </svg>
            <span className="text-gray-700">待验证</span>
          </div>
        </div>
      </div>
      
      {/* 统计信息和导出按钮 */}
      <div className="pointer-events-none absolute bottom-4 right-4 flex items-center gap-2">
        <div className="bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-muted-foreground">实体：</span>
              <span className="font-medium">{entities.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">关系：</span>
              <span className="font-medium">{relations.length}</span>
            </div>
          </div>
        </div>
        
        {/* 导出和保存按钮 */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* 演化历史按钮 */}
          <Button 
            variant="outline" 
            size="sm" 
            className="bg-white/95 backdrop-blur shadow-lg"
            onClick={() => setShowEvolutionHistory(true)}
          >
            <History className="w-4 h-4 mr-1" />
            演化历史
          </Button>
          
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="bg-white/95 backdrop-blur shadow-lg">
              <Download className="w-4 h-4 mr-1" />
              导出
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => exportToJSON(entities, relations)}>
              <FileJson className="w-4 h-4 mr-2" />
              导出 JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => exportToImage()}>
              <ImageIcon className="w-4 h-4 mr-2" />
              导出图片
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => saveSnapshot(entities, relations)}>
              <Camera className="w-4 h-4 mr-2" />
              保存快照
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
      
      {/* 演化历史面板 */}
      <EvolutionHistoryPanel
        isOpen={showEvolutionHistory}
        onClose={() => setShowEvolutionHistory(false)}
        entityId={selectedNode?.id}
        relationId={selectedEdge?.id}
      />

      {/* 选中详情与快捷操作（恢复节点/边点击后的可见反馈） */}
      {(selectedNode || selectedEdge) && (
        <Card className="absolute bottom-4 left-4 w-[340px] bg-white/95 backdrop-blur shadow-lg border z-20 pointer-events-auto">
          <CardContent className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium">
                {selectedNode ? '已选中实体' : '已选中关系'}
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  setSelectedNode(null);
                  setSelectedEdge(null);
                }}
              >
                关闭
              </Button>
            </div>
            {selectedNode ? (
              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">名称：</span>{selectedNode.name}</div>
                <div><span className="text-muted-foreground">类型：</span>{getEntityRawLabel(selectedNode)}</div>
                {selectedNode.description ? (
                  <div className="line-clamp-2"><span className="text-muted-foreground">描述：</span>{selectedNode.description}</div>
                ) : null}
              </div>
            ) : selectedEdge ? (
              <div className="text-xs space-y-1">
                <div><span className="text-muted-foreground">关系：</span>{getRelationRawLabel(selectedEdge)}</div>
                <div className="line-clamp-2">
                  <span className="text-muted-foreground">证据：</span>{selectedEdge.evidence || '无'}
                </div>
              </div>
            ) : null}
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleQuickEditSelected} disabled={actionBusy}>
                <Edit3 className="w-3.5 h-3.5 mr-1" />
                编辑
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={handleConfirmSelected} disabled={actionBusy}>
                <Check className="w-3.5 h-3.5 mr-1" />
                确认
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * 保存知识图谱快照
 */
async function saveSnapshot(entities: KGEntity[], relations: KGRelation[]) {
  try {
    const name = `知识图谱快照 - ${new Date().toLocaleString('zh-CN')}`;
    
    const response = await fetch('/api/knowledge-graph/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        description: '自动保存的知识图谱快照',
        entities,
        relations,
        metadata: {
          savedAt: new Date().toISOString(),
          entityCount: entities.length,
          relationCount: relations.length
        }
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      // 使用非阻断提示，避免打断图谱操作
      console.info('[KnowledgeGraph] 快照保存成功');
    } else {
      console.error('Save snapshot failed:', result.error);
      console.warn('[KnowledgeGraph] 快照保存失败：' + result.error);
    }
  } catch (error) {
    console.error('Save snapshot error:', error);
    console.warn('[KnowledgeGraph] 快照保存失败');
  }
}

/**
 * 导出知识图谱为 JSON
 */
function exportToJSON(entities: KGEntity[], relations: KGRelation[]) {
  const data = {
    exportTime: new Date().toISOString(),
    entities: entities.map(e => ({
      id: e.id,
      name: e.name,
      type: e.type,
      importance: e.importance,
      description: e.description,
      verified: e.verified
    })),
    relations: relations.map(r => ({
      id: r.id,
      source: r.source_entity_id,
      target: r.target_entity_id,
      type: r.type,
      confidence: r.confidence,
      evidence: r.evidence,
      verified: r.verified
    }))
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `knowledge-graph-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导出知识图谱为图片
 */
function exportToImage() {
  // 找到 ReactFlow 容器
  const flowContainer = document.querySelector('.react-flow') as HTMLElement;
  if (!flowContainer) return;
  
  // 使用 html2canvas 或简单的截图方法
  // 由于 html2canvas 可能未安装，我们使用简单的 SVG 转图片方法
  
  // 获取 SVG 元素
  const svgElement = flowContainer.querySelector('svg');
  if (!svgElement) return;
  
  // 克隆 SVG
  const clonedSvg = svgElement.cloneNode(true) as SVGElement;
  
  // 设置背景
  clonedSvg.style.backgroundColor = '#f8fafc';
  
  // 获取边界
  const { width, height } = flowContainer.getBoundingClientRect();
  clonedSvg.setAttribute('width', String(width));
  clonedSvg.setAttribute('height', String(height));
  
  // 序列化 SVG
  const svgData = new XMLSerializer().serializeToString(clonedSvg);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);
  
  // 创建图片
  const img = new Image();
  img.onload = () => {
    // 创建 canvas
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;  // 2x 分辨率
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.scale(2, 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0);
      
      // 导出图片
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `knowledge-graph-${Date.now()}.png`;
          a.click();
          URL.revokeObjectURL(url);
        }
      }, 'image/png');
    }
    
    URL.revokeObjectURL(svgUrl);
  };
  
  img.src = svgUrl;
}
