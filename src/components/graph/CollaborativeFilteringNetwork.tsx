'use client';

/**
 * 协同过滤网络可视化组件
 *
 * 使用 ReactFlow 渲染用户-物品关系图
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Position,
  useReactFlow,
  Handle,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type {
  NetworkData,
  NetworkNode,
  NetworkEdge,
  NodeClickEvent,
  EdgeClickEvent,
} from '@/lib/recommendation/network-types';
import {
  DEFAULT_NODE_STYLE,
  DEFAULT_EDGE_STYLE,
} from '@/lib/recommendation/network-types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// ============================================================================
// 自定义节点组件
// ============================================================================

interface CustomNodeData {
  label: string;
  type: string;
  highlighted: boolean;
  color?: string;
}

const CustomNode: React.FC<{ data: CustomNodeData }> = ({ data }) => {
  const style = DEFAULT_NODE_STYLE[data.type as keyof typeof DEFAULT_NODE_STYLE] || DEFAULT_NODE_STYLE.user;
  const backgroundColor = data.color || style.color;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: '6px',
        backgroundColor,
        border: `${data.highlighted ? '3' : style.borderWidth}px solid ${style.borderColor}`,
        boxShadow: data.highlighted ? '0 4px 12px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
        minWidth: '80px',
        textAlign: 'center',
        color: '#fff',
        fontSize: '12px',
        fontWeight: data.highlighted ? 'bold' : 'normal',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#555' }} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: '#555' }} />
    </div>
  );
};

// 注册节点类型
const nodeTypes = {
  customNode: CustomNode,
};

// ============================================================================
// 组件属性
// ============================================================================

interface CollaborativeFilteringNetworkProps {
  // 网络数据
  data?: NetworkData;

  // 或通过 API 获取
  userId?: string;
  scenario?: string;

  // 配置
  width?: string | number;
  height?: string | number;
  depth?: number;
  maxNodes?: number;
  maxEdges?: number;
  minSimilarity?: number;
  includeSimilarities?: boolean;
  includeRecommendations?: boolean;

  // 事件回调
  onNodeClick?: (event: NodeClickEvent) => void;
  onEdgeClick?: (event: EdgeClickEvent) => void;
  onNetworkReady?: (network: any) => void;

  // 样式
  className?: string;
  showControls?: boolean;
  showLegend?: boolean;
  showStats?: boolean;
}

// ============================================================================
// 主组件
// ============================================================================

function FlowContent({
  networkData,
  onNodeClick,
  onEdgeClick,
  showControls,
  showLegend,
  showStats,
}: {
  networkData: NetworkData;
  onNodeClick?: (event: NodeClickEvent) => void;
  onEdgeClick?: (event: EdgeClickEvent) => void;
  showControls: boolean;
  showLegend: boolean;
  showStats: boolean;
}) {
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  // 转换节点数据
  const initialNodes: Node[] = useMemo(() => {
    return networkData.nodes.map((node, index) => {
      const style = DEFAULT_NODE_STYLE[node.type as keyof typeof DEFAULT_NODE_STYLE] || DEFAULT_NODE_STYLE.user;
      return {
        id: node.id,
        type: 'customNode',
        position: {
          x: Math.random() * 800,
          y: Math.random() * 600,
        },
        data: {
          label: node.label,
          type: node.type,
          highlighted: node.highlighted,
          color: node.color || style.color,
        },
        style: {
          width: node.size ? node.size * 3 : style.size * 3,
        },
      };
    });
  }, [networkData.nodes]);

  // 转换边数据
  const initialEdges: Edge[] = useMemo(() => {
    return networkData.edges.map((edge) => {
      const edgeType = edge.type as keyof typeof DEFAULT_EDGE_STYLE;
      const style = DEFAULT_EDGE_STYLE[edgeType] || DEFAULT_EDGE_STYLE.interaction;

      return {
        id: edge.id,
        source: edge.from,
        target: edge.to,
        label: edge.label,
        animated: edge.type === 'recommendation',
        style: {
          stroke: edge.color || style.color,
          strokeWidth: edge.width || (edge.value ? 1 + edge.value * 2 : 1),
          strokeDasharray: edge.dashes ? '5,5' : undefined,
        },
        markerEnd: edge.type === 'recommendation' ? {
          type: MarkerType.ArrowClosed,
          color: edge.color || style.color,
        } : undefined,
        data: edge,
      };
    });
  }, [networkData.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 应用力导向布局
  useEffect(() => {
    if (nodes.length > 0 && edges.length > 0) {
      // 简单的力导向布局实现
      const nodePositions = new Map<string, { x: number; y: number }>();

      // 初始化位置（随机）
      nodes.forEach((node) => {
        nodePositions.set(node.id, {
          x: Math.random() * 800,
          y: Math.random() * 600,
        });
      });

      // 简单的力导向迭代
      const iterations = 50;
      const repulsion = 5000;
      const attraction = 0.01;

      for (let i = 0; i < iterations; i++) {
        // 计算排斥力
        nodes.forEach((nodeA) => {
          const posA = nodePositions.get(nodeA.id)!;
          let dx = 0;
          let dy = 0;

          nodes.forEach((nodeB) => {
            if (nodeA.id !== nodeB.id) {
              const posB = nodePositions.get(nodeB.id)!;
              const dist = Math.sqrt(
                Math.pow(posA.x - posB.x, 2) + Math.pow(posA.y - posB.y, 2)
              );
              if (dist > 0) {
                dx += ((posA.x - posB.x) / dist) * (repulsion / dist);
                dy += ((posA.y - posB.y) / dist) * (repulsion / dist);
              }
            }
          });

          posA.x += dx * 0.01;
          posA.y += dy * 0.01;
        });

        // 计算吸引力
        edges.forEach((edge) => {
          const posSource = nodePositions.get(edge.source)!;
          const posTarget = nodePositions.get(edge.target)!;

          const dx = posTarget.x - posSource.x;
          const dy = posTarget.y - posSource.y;

          posSource.x += dx * attraction;
          posSource.y += dy * attraction;
          posTarget.x -= dx * attraction;
          posTarget.y -= dy * attraction;
        });
      }

      // 应用新位置
      setNodes((nds) =>
        nds.map((node) => ({
          ...node,
          position: nodePositions.get(node.id)!,
        }))
      );
    }
  }, [networkData.nodes, networkData.edges, setNodes]);

  // 节点点击事件
  const onNodeClickHandler = useCallback((event: React.MouseEvent, node: Node) => {
    if (onNodeClick) {
      const originalNode = networkData.nodes.find((n) => n.id === node.id);
      if (originalNode) {
        onNodeClick({
          node: originalNode,
          position: { x: event.clientX, y: event.clientY },
          connectedNodes: edges
            .filter((e) => e.source === node.id || e.target === node.id)
            .map((e) => (e.source === node.id ? e.target : e.source)),
          connectedEdges: edges
            .filter((e) => e.source === node.id || e.target === node.id)
            .map((e) => e.id),
        });
      }
    }
  }, [onNodeClick, networkData.nodes, edges]);

  // 边点击事件
  const onEdgeClickHandler = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (onEdgeClick) {
      const originalEdge = networkData.edges.find((e) => e.id === edge.id);
      if (originalEdge) {
        const fromNode = networkData.nodes.find((n) => n.id === edge.source);
        const toNode = networkData.nodes.find((n) => n.id === edge.target);
        if (fromNode && toNode) {
          onEdgeClick({
            edge: originalEdge,
            position: { x: event.clientX, y: event.clientY },
            fromNode,
            toNode,
          });
        }
      }
    }
  }, [onEdgeClick, networkData.edges, networkData.nodes]);

  // 控制方法
  const handleFit = useCallback(() => {
    fitView({ duration: 500 });
  }, [fitView]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClickHandler}
        onEdgeClick={onEdgeClickHandler}
        nodeTypes={nodeTypes}
        fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <Background color="#aaa" gap={16} />
        {showControls && <Controls />}
        {showControls && <MiniMap />}
      </ReactFlow>

      {/* 自定义控制按钮 */}
      {showControls && (
        <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomIn}
            title="放大"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleZoomOut}
            title="缩小"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFit}
            title="适应窗口"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </Button>
        </div>
      )}

      {/* 图例 */}
      {showLegend && (
        <Card className="absolute bottom-4 left-4 z-10 p-3">
          <h4 className="mb-2 text-sm font-medium">图例</h4>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded-full bg-blue-500" />
              <span>用户节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-green-500" />
              <span>物品节点</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 bg-gray-400" />
              <span>交互边</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-8 border-t-2 border-dashed border-gray-400" />
              <span>相似度边</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1 w-8 bg-orange-500" />
              <span>推荐边</span>
            </div>
          </div>
        </Card>
      )}

      {/* 统计信息 */}
      {showStats && networkData.stats && (
        <Card className="absolute bottom-4 right-4 z-10 p-3">
          <h4 className="mb-2 text-sm font-medium">网络统计</h4>
          <div className="space-y-1 text-xs text-gray-600">
            <div className="flex justify-between gap-4">
              <span>节点数:</span>
              <span className="font-medium">{networkData.stats.nodeCount}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>边数:</span>
              <span className="font-medium">{networkData.stats.edgeCount}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>平均度:</span>
              <span className="font-medium">{networkData.stats.avgDegree.toFixed(2)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>密度:</span>
              <span className="font-medium">{(networkData.stats.avgDegree / Math.max(networkData.stats.nodeCount, 1) * 100).toFixed(2)}%</span>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function CollaborativeFilteringNetwork({
  data: propData,
  userId = 'default_user',
  scenario,
  width = '100%',
  height = '500px',
  depth = 2,
  maxNodes = 100,
  maxEdges = 500,
  minSimilarity = 0.3,
  includeSimilarities = true,
  includeRecommendations = true,
  onNodeClick,
  onEdgeClick,
  onNetworkReady,
  className = '',
  showControls = true,
  showLegend = true,
  showStats = true,
}: CollaborativeFilteringNetworkProps) {
  // 状态
  const [networkData, setNetworkData] = useState<NetworkData | null>(propData || null);
  const [loading, setLoading] = useState(!propData);
  const [error, setError] = useState<string | null>(null);

  // 数据加载
  useEffect(() => {
    if (propData) {
      setNetworkData(propData);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          userId,
          depth: String(depth),
          maxNodes: String(maxNodes),
          maxEdges: String(maxEdges),
          minSimilarity: String(minSimilarity),
          includeSimilarities: String(includeSimilarities),
          includeRecommendations: String(includeRecommendations),
        });

        if (scenario) {
          params.append('scenario', scenario);
        }

        const response = await fetch(`/api/recommendation/network?${params}`);
        const result = await response.json();

        if (result.success) {
          setNetworkData(result.data);
          if (onNetworkReady) {
            onNetworkReady(result.data);
          }
        } else {
          setError(result.error?.message || '获取网络数据失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '网络请求失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    propData,
    userId,
    scenario,
    depth,
    maxNodes,
    maxEdges,
    minSimilarity,
    includeSimilarities,
    includeRecommendations,
    onNetworkReady,
  ]);

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* 加载状态 */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <span className="text-sm text-gray-600">加载网络数据...</span>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <Card className="bg-red-50 p-4 text-red-600">
            <p className="font-medium">加载失败</p>
            <p className="text-sm">{error}</p>
          </Card>
        </div>
      )}

      {/* 网络内容 */}
      {!loading && !error && networkData && (
        <FlowContent
          networkData={networkData}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          showControls={showControls}
          showLegend={showLegend}
          showStats={showStats}
        />
      )}
    </div>
  );
}
