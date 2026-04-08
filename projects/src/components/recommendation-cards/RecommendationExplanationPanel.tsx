/**
 * 推荐解释面板组件
 * 
 * 功能：
 * - 显示推荐项的详细解释
 * - 展示知识图谱中的推荐路径
 * - 显示特征匹配度分析
 * - 提供多维度推荐理由
 */

'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Target,
  GitBranch,
  BookOpen,
  TrendingUp,
  Award,
  Star,
  ChevronRight,
  Info,
  Layers,
  Network,
  BarChart3,
  AlertCircle
} from 'lucide-react';
import { RecommendationItem, RecommendationResult } from './RecommendationChatPanel';

/**
 * 特征匹配
 */
interface FeatureMatch {
  feature: string;
  value: string;
  matchScore: number;
  importance: number;
}

/**
 * 推荐路径节点
 */
interface RecommendationPathNode {
  id: string;
  type: 'user' | 'interest' | 'item' | 'feature' | 'knowledge';
  label: string;
  confidence: number;
}

/**
 * 推荐路径边
 */
interface RecommendationPathEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
}

/**
 * 推荐解释面板属性
 */
export interface RecommendationExplanationPanelProps {
  recommendation: RecommendationItem | null;
  allRecommendations?: RecommendationResult;
  userProfile?: {
    interests: string[];
    history: Array<{ itemId: string; feedback: string }>;
  };
  onShowKnowledgeGraph?: () => void;
  className?: string;
}

/**
 * 推荐解释面板组件
 */
export function RecommendationExplanationPanel({
  recommendation,
  allRecommendations,
  userProfile,
  onShowKnowledgeGraph,
  className
}: RecommendationExplanationPanelProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // 生成特征匹配数据
  const featureMatches = useMemo((): FeatureMatch[] => {
    if (!recommendation || !userProfile) return [];

    const matches: FeatureMatch[] = [];

    // 兴趣匹配
    if (userProfile.interests && recommendation.features?.category) {
      userProfile.interests.forEach((interest, index) => {
        const score = 1 - (index * 0.1); // 越靠前的兴趣权重越高
        matches.push({
          feature: '兴趣匹配',
          value: interest,
          matchScore: Math.max(score, 0.5),
          importance: 0.9
        });
      });
    }

    // 类别匹配
    if (recommendation.features?.category) {
      matches.push({
        feature: '类别',
        value: recommendation.features.category,
        matchScore: 0.85,
        importance: 0.8
      });
    }

    // 标签匹配
    if (recommendation.features?.tags && userProfile?.interests) {
      const matchingTags = recommendation.features.tags.filter((tag: string) =>
        userProfile.interests.some(interest => 
          interest.toLowerCase().includes(tag.toLowerCase()) ||
          tag.toLowerCase().includes(interest.toLowerCase())
        )
      );

      matchingTags.forEach(tag => {
        matches.push({
          feature: '标签匹配',
          value: tag,
          matchScore: 0.75,
          importance: 0.6
        });
      });
    }

    return matches.slice(0, 6);
  }, [recommendation, userProfile]);

  // 生成推荐路径
  const recommendationPath = useMemo(() => {
    if (!recommendation || !userProfile) return { nodes: [], edges: [] };

    const nodes: RecommendationPathNode[] = [
      { id: 'user', type: 'user', label: '用户', confidence: 1.0 }
    ];

    const edges: RecommendationPathEdge[] = [];

    // 添加兴趣节点
    if (userProfile.interests) {
      userProfile.interests.slice(0, 3).forEach((interest, index) => {
        const interestId = `interest_${index}`;
        nodes.push({
          id: interestId,
          type: 'interest',
          label: interest,
          confidence: 0.8
        });
        edges.push({
          source: 'user',
          target: interestId,
          type: 'interested_in',
          weight: 0.9
        });
      });
    }

    // 添加物品节点
    const itemId = `item_${recommendation.id}`;
    nodes.push({
      id: itemId,
      type: 'item',
      label: recommendation.title,
      confidence: recommendation.confidence
    });

    // 添加特征节点
    if (recommendation.features) {
      Object.entries(recommendation.features.attributes || {}).forEach(([key, value], index) => {
        const featureId = `feature_${index}`;
        nodes.push({
          id: featureId,
          type: 'feature',
          label: `${key}: ${value}`,
          confidence: 0.7
        });
        edges.push({
          source: itemId,
          target: featureId,
          type: 'has_feature',
          weight: 0.6
        });
      });
    }

    // 添加知识来源节点
    if (recommendation.knowledgeSources && recommendation.knowledgeSources.length > 0) {
      recommendation.knowledgeSources.slice(0, 2).forEach((source, index) => {
        const knowledgeId = `knowledge_${index}`;
        nodes.push({
          id: knowledgeId,
          type: 'knowledge',
          label: source.title,
          confidence: source.relevance
        });
        edges.push({
          source: itemId,
          target: knowledgeId,
          type: 'supported_by',
          weight: source.relevance
        });
      });
    }

    // 连接兴趣到物品
    const interestIds = nodes.filter(n => n.type === 'interest').map(n => n.id);
    interestIds.forEach(interestId => {
      edges.push({
        source: interestId,
        target: itemId,
        type: 'matches',
        weight: recommendation.confidence
      });
    });

    return { nodes, edges };
  }, [recommendation, userProfile]);

  // 计算推荐指标
  const metrics = useMemo(() => {
    if (!allRecommendations || !recommendation) return null;

    const metadata = allRecommendations.metadata;
    const items = allRecommendations.items;
    const itemIndex = items.findIndex(i => i.id === recommendation.id);

    return {
      diversity: (metadata.diversityScore * 100).toFixed(0),
      novelty: (metadata.noveltyScore * 100).toFixed(0),
      confidence: (recommendation.confidence * 100).toFixed(0),
      rank: itemIndex >= 0 ? itemIndex + 1 : '-',
      totalCandidates: metadata.totalCandidates,
      selected: metadata.selectedCount
    };
  }, [allRecommendations, recommendation]);

  if (!recommendation) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            推荐解释
          </CardTitle>
          <CardDescription>
            选择一个推荐项查看详细解释
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Info className="h-12 w-12 mb-2 opacity-50" />
            <p className="text-sm">点击推荐卡片查看详细解释</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Brain className="h-5 w-5 text-primary" />
              推荐解释
            </CardTitle>
            <CardDescription className="mt-1">
              {recommendation.title}
            </CardDescription>
          </div>
          <Badge variant="secondary">
            置信度 {(recommendation.confidence * 100).toFixed(0)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              概览
            </TabsTrigger>
            <TabsTrigger value="features" className="text-xs">
              <BarChart3 className="h-3 w-3 mr-1" />
              特征
            </TabsTrigger>
            <TabsTrigger value="path" className="text-xs">
              <GitBranch className="h-3 w-3 mr-1" />
              路径
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              知识
            </TabsTrigger>
          </TabsList>

          {/* 概览标签页 */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  推荐理由
                </h4>
                <p className="text-sm text-muted-foreground">
                  {recommendation.explanation}
                </p>
              </div>

              <Separator />

              {metrics && (
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    推荐指标
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <MetricCard
                      label="置信度"
                      value={`${metrics.confidence}%`}
                      icon={<Award className="h-4 w-4" />}
                      color="blue"
                    />
                    <MetricCard
                      label="排名"
                      value={`#${metrics.rank}`}
                      icon={<Star className="h-4 w-4" />}
                      color="yellow"
                    />
                    <MetricCard
                      label="多样性"
                      value={`${metrics.diversity}%`}
                      icon={<Layers className="h-4 w-4" />}
                      color="purple"
                    />
                    <MetricCard
                      label="新颖性"
                      value={`${metrics.novelty}%`}
                      icon={<Sparkles className="h-4 w-4" />}
                      color="green"
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-500" />
                  基本信息
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">类型</span>
                    <span>{recommendation.type}</span>
                  </div>
                  {recommendation.features?.category && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">类别</span>
                      <span>{recommendation.features.category}</span>
                    </div>
                  )}
                  {recommendation.features?.tags && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-muted-foreground">标签:</span>
                      {recommendation.features.tags.map((tag: string) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* 特征标签页 */}
          <TabsContent value="features" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                  特征匹配度分析
                </h4>
                
                {featureMatches.length > 0 ? (
                  featureMatches.map((match, index) => (
                    <FeatureMatchCard key={index} match={match} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无特征匹配数据</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* 路径标签页 */}
          <TabsContent value="path" className="mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-green-500" />
                  推荐路径
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onShowKnowledgeGraph}
                  className="text-xs"
                >
                  <Network className="h-3 w-3 mr-1" />
                  查看完整图谱
                </Button>
              </div>

              <ScrollArea className="h-[350px]">
                <div className="space-y-2">
                  {recommendationPath.nodes.map((node, index) => (
                    <PathNodeCard
                      key={node.id}
                      node={node}
                      edge={
                        recommendationPath.edges.find(e => e.target === node.id)
                      }
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>

          {/* 知识标签页 */}
          <TabsContent value="knowledge" className="mt-4">
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  知识来源
                </h4>

                {recommendation.knowledgeSources && recommendation.knowledgeSources.length > 0 ? (
                  <div className="space-y-3">
                    {recommendation.knowledgeSources.map((source, index) => (
                      <Card key={index} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h5 className="text-sm font-medium mb-1">
                              {source.title}
                            </h5>
                            <Badge variant="secondary" className="text-xs">
                              相关度 {(source.relevance * 100).toFixed(0)}%
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm" className="h-7 px-2">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mb-2 opacity-50" />
                    <p className="text-sm">暂无知识来源数据</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

/**
 * 指标卡片组件
 */
interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'purple' | 'green';
}

function MetricCard({ label, value, icon, color }: MetricCardProps) {
  const colorClasses = {
    blue: 'text-blue-500 bg-blue-50 border-blue-200',
    yellow: 'text-yellow-500 bg-yellow-50 border-yellow-200',
    purple: 'text-purple-500 bg-purple-50 border-purple-200',
    green: 'text-green-500 bg-green-50 border-green-200'
  };

  return (
    <Card className={`p-3 border ${colorClasses[color].split(' ').slice(1).join(' ')}`}>
      <div className="flex items-center gap-2">
        <div className={colorClasses[color].split(' ')[0]}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * 特征匹配卡片组件
 */
function FeatureMatchCard({ match }: { match: FeatureMatch }) {
  return (
    <Card className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{match.feature}</span>
            <Badge variant="outline" className="text-xs h-5">
              {(match.importance * 100).toFixed(0)}%
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{match.value}</p>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold text-primary">
            {(match.matchScore * 100).toFixed(0)}%
          </div>
          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${match.matchScore * 100}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * 路径节点卡片组件
 */
function PathNodeCard({
  node,
  edge
}: {
  node: RecommendationPathNode;
  edge?: RecommendationPathEdge;
}) {
  const typeIcons = {
    user: <Target className="h-4 w-4 text-blue-500" />,
    interest: <Star className="h-4 w-4 text-yellow-500" />,
    item: <Award className="h-4 w-4 text-green-500" />,
    feature: <Layers className="h-4 w-4 text-purple-500" />,
    knowledge: <BookOpen className="h-4 w-4 text-blue-500" />
  };

  return (
    <Card className="p-3">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {typeIcons[node.type]}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{node.label}</span>
            <Badge variant="secondary" className="text-xs">
              {(node.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
          {edge && (
            <div className="text-xs text-muted-foreground mt-1">
              ← {edge.type} ({(edge.weight * 100).toFixed(0)}%)
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// 导入 Sparkles 图标
import { Sparkles } from 'lucide-react';
