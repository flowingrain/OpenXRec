/**
 * 知识图谱类型定义
 */

// 实体类型
export type EntityType = 
  | '公司' | '人物' | '地点' | '政策' | '事件' | '行业' | '产品' 
  | '学术会议' | '学术技术' | '学术机构' | '其他';

// 关系类型
export type RelationType = 
  | '投资' | '控股' | '合作' | '竞争' | '供应链' 
  | '监管' | '影响' | '关联' | '任职' | '隶属'
  | '生产' | '采购' | '销售' 
  | '引用' | '发表' | '属于' | '研究'  // 学术相关
  | '其他';

// 实体节点
export interface KGEntity {
  id: string;
  name: string;
  type: EntityType;
  aliases: string[];
  description?: string;
  importance: number;
  properties?: Record<string, any>;
  source_type: 'llm' | 'manual' | 'merged';
  verified: boolean;
  created_at: string;
  updated_at: string;
}

// 关系边
export interface KGRelation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  source_name?: string;  // 用于显示
  target_name?: string;  // 用于显示
  type: RelationType;
  confidence: number;
  evidence?: string;
  properties?: Record<string, any>;
  source_type: 'llm' | 'manual' | 'merged';
  verified: boolean;
  valid_from?: string;
  valid_to?: string;
  created_at: string;
  updated_at: string;
}

// 知识图谱数据
export interface KnowledgeGraph {
  entities: KGEntity[];
  relations: KGRelation[];
}

// 修正记录
export interface KGCorrection {
  id: string;
  entity_id?: string;
  relation_id?: string;
  change_type: 'entity_add' | 'entity_update' | 'entity_delete' | 'relation_add' | 'relation_update' | 'relation_delete';
  old_value?: Record<string, any>;
  new_value?: Record<string, any>;
  reason?: string;
  corrected_by?: string;
  corrected_at: string;
}

// LLM抽取结果
export interface LLMExtractionResult {
  entities: Array<{
    name: string;
    type: EntityType;
    importance?: number;
    description?: string;
  }>;
  relations: Array<{
    source: string;
    target: string;
    type: RelationType;
    confidence?: number;
    evidence?: string;
  }>;
}

// 图谱变更操作
export interface GraphChange {
  type: 'entity_add' | 'entity_update' | 'relation_add' | 'relation_update' | 'relation_delete';
  data: any;
  userId?: string;
  reason?: string;
}

// 实体类型配置
export const ENTITY_TYPE_CONFIG: Record<EntityType, { color: string; icon: string }> = {
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
export const RELATION_TYPE_CONFIG: Record<RelationType, { color: string; label: string }> = {
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
