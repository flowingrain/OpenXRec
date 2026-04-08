/**
 * 协同过滤网络可视化演示页面
 */

'use client';

import { useState } from 'react';
import CollaborativeFilteringNetwork from '@/components/graph/CollaborativeFilteringNetwork';
import type { NodeClickEvent, EdgeClickEvent } from '@/lib/recommendation/network-types';

export default function NetworkVisualizationPage() {
  const [selectedNode, setSelectedNode] = useState<NodeClickEvent | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<EdgeClickEvent | null>(null);
  
  const [config, setConfig] = useState({
    userId: 'user_001',
    depth: 2,
    maxNodes: 100,
    maxEdges: 500,
    minSimilarity: 0.3,
    includeSimilarities: true,
    includeRecommendations: true,
  });
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* 标题 */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            协同过滤推荐网络可视化
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            展示用户-物品关系、相似度连接和推荐路径
          </p>
        </div>
        
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* 左侧配置面板 */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-4 shadow">
              <h2 className="mb-4 text-lg font-medium">配置参数</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    用户 ID
                  </label>
                  <input
                    type="text"
                    value={config.userId}
                    onChange={(e) => setConfig({ ...config, userId: e.target.value })}
                    className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    关系深度: {config.depth}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={3}
                    value={config.depth}
                    onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })}
                    className="mt-1 block w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    最大节点数: {config.maxNodes}
                  </label>
                  <input
                    type="range"
                    min={20}
                    max={200}
                    step={10}
                    value={config.maxNodes}
                    onChange={(e) => setConfig({ ...config, maxNodes: Number(e.target.value) })}
                    className="mt-1 block w-full"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    最小相似度: {config.minSimilarity.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={config.minSimilarity}
                    onChange={(e) => setConfig({ ...config, minSimilarity: Number(e.target.value) })}
                    className="mt-1 block w-full"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.includeSimilarities}
                      onChange={(e) => setConfig({ ...config, includeSimilarities: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">显示相似度边</span>
                  </label>
                  
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.includeRecommendations}
                      onChange={(e) => setConfig({ ...config, includeRecommendations: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm text-gray-700">显示推荐边</span>
                  </label>
                </div>
              </div>
            </div>
            
            {/* 选中节点/边信息 */}
            {(selectedNode || selectedEdge) && (
              <div className="mt-4 rounded-lg bg-white p-4 shadow">
                <h2 className="mb-4 text-lg font-medium">选中信息</h2>
                
                {selectedNode && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">节点 ID:</span>{' '}
                      {selectedNode.node.id}
                    </div>
                    <div>
                      <span className="font-medium">标签:</span>{' '}
                      {selectedNode.node.label}
                    </div>
                    <div>
                      <span className="font-medium">类型:</span>{' '}
                      {selectedNode.node.type}
                    </div>
                    <div>
                      <span className="font-medium">连接节点数:</span>{' '}
                      {selectedNode.connectedNodes.length}
                    </div>
                    <div>
                      <span className="font-medium">连接边数:</span>{' '}
                      {selectedNode.connectedEdges.length}
                    </div>
                    {selectedNode.node.metadata && (
                      <div className="mt-2 rounded bg-gray-50 p-2">
                        <div className="font-medium">元数据:</div>
                        <pre className="mt-1 text-xs">
                          {JSON.stringify(selectedNode.node.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                
                {selectedEdge && (
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium">边 ID:</span>{' '}
                      {selectedEdge.edge.id}
                    </div>
                    <div>
                      <span className="font-medium">类型:</span>{' '}
                      {selectedEdge.edge.type}
                    </div>
                    <div>
                      <span className="font-medium">起点:</span>{' '}
                      {selectedEdge.fromNode.label}
                    </div>
                    <div>
                      <span className="font-medium">终点:</span>{' '}
                      {selectedEdge.toNode.label}
                    </div>
                    {selectedEdge.edge.metadata && (
                      <div className="mt-2 rounded bg-gray-50 p-2">
                        <div className="font-medium">元数据:</div>
                        <pre className="mt-1 text-xs">
                          {JSON.stringify(selectedEdge.edge.metadata, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* 右侧网络图 */}
          <div className="lg:col-span-3">
            <div className="rounded-lg bg-white p-4 shadow">
              <CollaborativeFilteringNetwork
                userId={config.userId}
                depth={config.depth}
                maxNodes={config.maxNodes}
                maxEdges={config.maxEdges}
                minSimilarity={config.minSimilarity}
                includeSimilarities={config.includeSimilarities}
                includeRecommendations={config.includeRecommendations}
                height="600px"
                onNodeClick={(event) => {
                  setSelectedNode(event);
                  setSelectedEdge(null);
                }}
                onEdgeClick={(event) => {
                  setSelectedEdge(event);
                  setSelectedNode(null);
                }}
                showControls
                showLegend
                showStats
              />
            </div>
            
            {/* 说明 */}
            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <h3 className="mb-2 font-medium text-blue-900">使用说明</h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>• <strong>蓝色圆形</strong>: 用户节点</li>
                <li>• <strong>绿色方形</strong>: 物品节点</li>
                <li>• <strong>灰色实线</strong>: 用户-物品交互</li>
                <li>• <strong>灰色虚线</strong>: 相似度关系</li>
                <li>• <strong>橙色粗线</strong>: 推荐关系（带箭头）</li>
                <li>• 点击节点或边查看详细信息</li>
                <li>• 使用右侧按钮控制缩放和布局</li>
                <li>• 拖拽节点调整位置</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
