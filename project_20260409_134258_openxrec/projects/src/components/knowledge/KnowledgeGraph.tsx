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
import type { KGEntity, KGRelation, EntityType, RelationType, ENTITY_TYPE_CONFIG, RELATION_TYPE_CONFIG } from '@/lib/knowledge-graph/types';

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
  '学术会议': { color: '#6366f1', icon: 'Calendar' },
  '学术技术': { color: '#a855f7', icon: 'Cpu' },
  '学术机构': { color: '#0d9488', icon: 'GraduationCap' },
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
  '引用': { color: '#f43f5e', label: '引用' },
  '发表': { color: '#ec4899', label: '发表' },
  '属于': { color: '#84cc16', label: '属于' },
  '研究': { color: '#14b8a6', label: '研究' },
  '其他': { color: '#9ca3af', label: '其他' }
};

// 自定义实体节点
function EntityNode({ data, selected }: NodeProps) {
  const config = ENTITY_CONFIG[data.type as EntityType] || ENTITY_CONFIG['其他'];
  const Icon = IconMap[config.icon] || Circle;
  
  // 已验证用实线边框，待验证用虚线边框 + 更淡的颜色
  const borderColor = data.verified ? config.color : `${config.color}80`;
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
          ? `${config.color}15` 
          : `${config.color}08`,
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
            backgroundColor: data.verified ? config.color : `${config.color}80`,
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
            <span>{data.type}</span>
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
  const config = RELATION_CONFIG[data.type as RelationType] || RELATION_CONFIG['其他'];
  
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
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
        opacity={opacity}
        markerEnd={`url(#arrow-${config.color.replace('#', '')})`}
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
          fontWeight={data.verified ? 600 : 400}
          opacity={opacity}
        >
          {config.label}
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
    const config = RELATION_CONFIG[relation.type as RelationType] || RELATION_CONFIG['其他'];
    
    edges.push({
      id: relation.id,
      source: relation.source_entity_id,
      target: relation.target_entity_id,
      type: 'relation',
      animated: !relation.verified,
      data: relation,
      style: { stroke: config.color, strokeWidth: relation.verified ? 2 : 1 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: config.color
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
  
  // 当布局变化时更新节点和边
  useEffect(() => {
    if (layoutNodes.length > 0) {
      setNodes(layoutNodes);
      setEdges(layoutEdges);
    }
  }, [layoutNodes, layoutEdges, setNodes, setEdges]);
  
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
        fitView
        attributionPosition="bottom-left"
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls className="!bg-white !shadow-lg !border !rounded-lg" />
        <MiniMap
          className="!bg-white !border !rounded-lg"
          nodeColor={(node) => {
            const config = ENTITY_CONFIG[node.data?.type as EntityType];
            return config?.color || '#6b7280';
          }}
        />
        
        {/* 定义箭头标记 */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            {Object.entries(RELATION_CONFIG).map(([key, config]) => (
              <marker
                key={key}
                id={`arrow-${config.color.replace('#', '')}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={config.color} />
              </marker>
            ))}
          </defs>
        </svg>
      </ReactFlow>
      
      {/* 动态图例 - 只显示实际使用的关系和实体类型 */}
      {(() => {
        // 从实际数据中提取使用的关系类型和实体类型
        const usedRelationTypes = [...new Set(relations.map(r => r.type))];
        const usedEntityTypes = [...new Set(entities.map(e => e.type))];
        
        // 按使用频率排序，优先显示高频类型
        const relationTypeCounts = relations.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const entityTypeCounts = entities.reduce((acc, e) => {
          acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        // 按频率排序
        const sortedRelationTypes = usedRelationTypes.sort(
          (a, b) => (relationTypeCounts[b] || 0) - (relationTypeCounts[a] || 0)
        );
        const sortedEntityTypes = usedEntityTypes.sort(
          (a, b) => (entityTypeCounts[b] || 0) - (entityTypeCounts[a] || 0)
        );
        
        return (
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs max-h-[300px] overflow-y-auto">
            {sortedEntityTypes.length > 0 && (
              <>
                <div className="font-medium mb-2">实体类型 (实际使用)</div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {sortedEntityTypes.map(type => {
                    const config = ENTITY_CONFIG[type as EntityType] || ENTITY_CONFIG['其他'];
                    const Icon = IconMap[config.icon];
                    const count = entityTypeCounts[type] || 0;
                    return (
                      <div key={type} className="flex items-center gap-1" title={`${count}个实体`}>
                        <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }} />
                        <span>{type}</span>
                        <span className="text-muted-foreground">({count})</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {sortedRelationTypes.length > 0 && (
              <>
                <div className="font-medium mb-2">关系类型 (实际使用)</div>
                <div className="flex flex-wrap gap-2 max-w-[280px]">
                  {sortedRelationTypes.map(type => {
                    const config = RELATION_CONFIG[type as RelationType] || RELATION_CONFIG['其他'];
                    const count = relationTypeCounts[type] || 0;
                    return (
                      <div key={type} className="flex items-center gap-1" title={`${count}条关系`}>
                        <div className="w-6 h-0.5" style={{ backgroundColor: config.color }} />
                        <span>{type}</span>
                        <span className="text-muted-foreground">({count})</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            
            {sortedRelationTypes.length === 0 && sortedEntityTypes.length === 0 && (
              <div className="text-muted-foreground">暂无数据</div>
            )}
          </div>
        );
      })()}
      
      {/* 状态说明 */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border text-xs">
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
      <div className="absolute bottom-4 right-4 flex items-center gap-2">
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
        <div className="flex items-center gap-2">
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
      alert('快照保存成功！');
    } else {
      console.error('Save snapshot failed:', result.error);
      alert('快照保存失败：' + result.error);
    }
  } catch (error) {
    console.error('Save snapshot error:', error);
    alert('快照保存失败');
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
