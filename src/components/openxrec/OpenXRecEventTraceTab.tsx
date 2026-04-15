'use client';

import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GitBranch, Activity, Clock } from 'lucide-react';
import type { KGEntity, KGRelation } from '@/lib/knowledge-graph/types';
import type { Message } from '@/components/openxrec/types';

const EventGraph = dynamic(() => import('@/components/graph/EventGraph'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] flex items-center justify-center bg-muted/30 rounded-lg">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

type OpenXRecEventTraceTabProps = {
  topic: string;
  isLoading: boolean;
  lastRecMessage?: Message;
  kgEntities: KGEntity[];
  kgRelations: KGRelation[];
  liveTrace?: {
    currentPhase?: string | null;
    phases: string[];
    phaseTimings: Record<string, number>;
  };
};

function buildSimpleEventGraphData(entities: KGEntity[], relations: KGRelation[]) {
  if (!entities.length) return null;
  const spacingX = 220;
  const spacingY = 120;
  const columns = 4;

  const nodes = entities.slice(0, 20).map((entity, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: entity.id,
      type: 'entity',
      position: { x: 80 + col * spacingX, y: 80 + row * spacingY },
      data: {
        label: entity.name,
        title: entity.name,
        type: entity.type,
        description: entity.description || '',
      },
    };
  });

  const entityIdSet = new Set(nodes.map((n) => n.id));
  const edges = relations
    .filter((r) => entityIdSet.has(r.source_entity_id) && entityIdSet.has(r.target_entity_id))
    .slice(0, 40)
    .map((relation) => ({
      id: relation.id,
      source: relation.source_entity_id,
      target: relation.target_entity_id,
      label: relation.type,
      data: {
        confidence: relation.confidence,
        evidence: relation.evidence,
      },
    }));

  return { nodes, edges };
}

export function OpenXRecEventTraceTab({
  topic,
  isLoading,
  lastRecMessage,
  kgEntities,
  kgRelations,
  liveTrace,
}: OpenXRecEventTraceTabProps) {
  const meta = (lastRecMessage?.responseMeta || {}) as {
    agentsUsed?: string[];
    phaseTimings?: Record<string, number>;
  };
  const historicalPhases = Object.keys(meta.phaseTimings || {});
  const livePhases = liveTrace?.phases || [];
  const agentsUsed = livePhases.length > 0 ? livePhases : historicalPhases;
  const phaseTimings = liveTrace?.phaseTimings || meta.phaseTimings || {};
  const currentPhase = liveTrace?.currentPhase || null;
  const graphData = buildSimpleEventGraphData(kgEntities, kgRelations);

  return (
    <div className="flex-1 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-4 min-h-0">
      <Card className="flex flex-col min-h-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            智能体调用链路
          </CardTitle>
          <CardDescription>展示最近一次推荐的智能体执行顺序与状态</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto space-y-3">
          {isLoading && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              智能体正在工作中...
            </div>
          )}

          {agentsUsed.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground">暂无调用链路数据，请先执行一次推荐任务。</p>
          )}

          {agentsUsed.map((agentId, index) => {
            const timingMs = phaseTimings[agentId] || null;
            const isActive = Boolean(isLoading && currentPhase && currentPhase === agentId);
            return (
              <div key={`${agentId}-${index}`} className="rounded-md border p-3 bg-white">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      #{index + 1}
                    </Badge>
                    <p className="text-sm font-medium truncate">{agentId}</p>
                  </div>
                  <Badge className={isActive ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                    {isActive ? 'running' : 'completed'}
                  </Badge>
                </div>
                {timingMs ? (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timingMs} ms
                  </p>
                ) : null}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="flex flex-col min-h-0">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-purple-600" />
            事件图谱
          </CardTitle>
          <CardDescription>展示实体关系与事件连接（基于当前会话结果）</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 min-h-[620px]">
          {graphData ? (
            <EventGraph
              topic={topic || '推荐任务事件图谱'}
              analysisData={{}}
              graphData={graphData}
            />
          ) : (
            <div className="h-[600px] border rounded-lg bg-muted/20 flex items-center justify-center text-sm text-muted-foreground">
              暂无图谱数据，请先执行推荐任务。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
