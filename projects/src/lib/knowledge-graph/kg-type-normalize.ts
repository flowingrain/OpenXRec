/**
 * 将 LLM 动态发现的实体/关系类型标签映射到系统规范枚举，并在 properties 中保留原始标签。
 */
import type { EntityType, RelationType } from './types';

/** 图例与归一化共用顺序（稳定展示） */
export const ENTITY_ORDER: EntityType[] = [
  '公司',
  '人物',
  '地点',
  '政策',
  '事件',
  '行业',
  '产品',
];

export const REL_ORDER: RelationType[] = [
  '投资',
  '控股',
  '合作',
  '竞争',
  '供应链',
  '监管',
  '影响',
  '关联',
  '任职',
  '隶属',
  '生产',
  '采购',
  '销售',
];

export function normalizeEntityType(raw: string): EntityType {
  const s = (raw || '').trim();
  if (!s) return '行业';
  if (ENTITY_ORDER.includes(s as EntityType)) return s as EntityType;
  if (/^(公司|企业|集团|机构|组织|银行|券商|基金|上市公司|子公司)$/.test(s)) return '公司';
  if (/^(协会|学会|联盟|院校|高校|研究所|机关|部门)$/.test(s)) return '公司';
  if (
    /^(人|人物|高管|官员|专家|用户|董事长|CEO|总裁)$/.test(s) ||
    s.endsWith('主席') ||
    s.endsWith('总裁') ||
    s.endsWith('部长') ||
    s.endsWith('省长')
  )
    return '人物';
  if (/^(地点|城市|国家|地区|省|市|区|县|景区|位置|古镇|园区|港口)$/.test(s)) return '地点';
  if (/^(政策|法规|规定|条例|通知|办法|意见)$/.test(s)) return '政策';
  if (/^(事件|事故|会议|活动|危机|发布会|决议)$/.test(s)) return '事件';
  if (
    /^(行业|产业|赛道|领域|板块|市场|业态|业务场景|细分行业|概念板块)$/.test(s) ||
    /行业$|产业$|赛道$|领域$/.test(s)
  )
    return '行业';
  if (
    /^(产品|服务|品牌|型号|方案|工具|平台|课程|软件|硬件|系统|应用|APP|SaaS)$/.test(s) ||
    /产品$|服务$|平台$/.test(s)
  )
    return '产品';
  if (/^(风险|因子|指标|数据|指数|利率|汇率|价格)$/.test(s)) return '行业';
  if (/^(技术|专利|标准|协议)$/.test(s)) return '产品';
  return '行业';
}

export function normalizeRelationType(raw: string): RelationType {
  const s = (raw || '').trim();
  if (!s) return '关联';
  if (REL_ORDER.includes(s as RelationType)) return s as RelationType;
  if (/^(投资|入股|参股|注资)$/.test(s)) return '投资';
  if (/^(控股|控制)$/.test(s)) return '控股';
  if (/^(合作|协作|联手|战略)$/.test(s)) return '合作';
  if (/^(竞争|对标|替代)$/.test(s)) return '竞争';
  if (/^(供应链|上下游|供货|采购链|供应商|客户)$/.test(s)) return '供应链';
  if (/^(监管|管辖|处罚)$/.test(s)) return '监管';
  if (/^(影响|作用于|带动|冲击|制约|促进|拖累)$/.test(s)) return '影响';
  if (/^(关联|相关|涉及|对应|联系)$/.test(s)) return '关联';
  if (/^(任职|担任)$/.test(s)) return '任职';
  if (/^(隶属|归属|属于)$/.test(s)) return '隶属';
  if (/^(生产|制造)$/.test(s)) return '生产';
  if (/^(采购|买入|购入)$/.test(s)) return '采购';
  if (/^(销售|出售|分销)$/.test(s)) return '销售';
  // 常见自然语言关系：优先映射到「关联/影响」，避免大量落入「其他」
  if (/^(适合|开设|位于|发生于|满足|优于|弱于|依赖|需要|面向)$/.test(s)) return '关联';
  if (/^(导致|引发|带来)$/.test(s)) return '影响';
  return '关联';
}
