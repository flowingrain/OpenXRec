/**
 * 知识模板库服务
 * 
 * 提供预置模板，降低用户添加知识的门槛
 */

// ==================== 模板类型定义 ====================

export interface KnowledgeTemplate {
  id: string;
  name: string;
  category: 'company' | 'person' | 'product' | 'event' | 'location' | 'policy' | 'industry' | 'other';
  description: string;
  fields: TemplateField[];
  example: Record<string, any>;
  tags: string[];
}

export interface TemplateField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'multiselect' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[];  // 用于 select 和 multiselect
  defaultValue?: any;
}

// ==================== 预置模板 ====================

export const KNOWLEDGE_TEMPLATES: KnowledgeTemplate[] = [
  // 公司模板
  {
    id: 'template_company',
    name: '公司实体',
    category: 'company',
    description: '添加一家公司或企业',
    fields: [
      { name: 'name', label: '公司名称', type: 'text', required: true, placeholder: '例如：腾讯科技' },
      { name: 'aliases', label: '别名/简称', type: 'multiselect', required: false, placeholder: '输入别名后按回车添加' },
      { name: 'description', label: '公司简介', type: 'textarea', required: false, placeholder: '公司主营业务、规模等' },
      { name: 'industry', label: '所属行业', type: 'select', required: false, options: ['互联网', '金融', '制造业', '零售', '教育', '医疗', '能源', '其他'] },
      { name: 'founded', label: '成立年份', type: 'text', required: false, placeholder: '例如：1998' },
      { name: 'headquarters', label: '总部地点', type: 'text', required: false, placeholder: '例如：深圳' },
    ],
    example: {
      name: '腾讯科技',
      aliases: ['腾讯', 'Tencent'],
      description: '中国领先的互联网科技公司，主营社交、游戏、金融科技等业务',
      industry: '互联网',
      founded: '1998',
      headquarters: '深圳',
    },
    tags: ['企业', '商业'],
  },
  
  // 人物模板
  {
    id: 'template_person',
    name: '人物实体',
    category: 'person',
    description: '添加一位人物',
    fields: [
      { name: 'name', label: '人物姓名', type: 'text', required: true, placeholder: '例如：马化腾' },
      { name: 'aliases', label: '别名/英文名', type: 'multiselect', required: false },
      { name: 'description', label: '人物简介', type: 'textarea', required: false, placeholder: '职位、成就、背景等' },
      { name: 'title', label: '职位/头衔', type: 'text', required: false, placeholder: '例如：CEO、创始人' },
      { name: 'company', label: '所属公司', type: 'text', required: false, placeholder: '关联的公司名称' },
    ],
    example: {
      name: '马化腾',
      aliases: ['Pony Ma'],
      description: '腾讯公司创始人之一，现任腾讯董事会主席兼CEO',
      title: '董事会主席兼CEO',
      company: '腾讯',
    },
    tags: ['人物', '商业领袖'],
  },
  
  // 产品模板
  {
    id: 'template_product',
    name: '产品实体',
    category: 'product',
    description: '添加一款产品或服务',
    fields: [
      { name: 'name', label: '产品名称', type: 'text', required: true, placeholder: '例如：微信' },
      { name: 'aliases', label: '别名', type: 'multiselect', required: false },
      { name: 'description', label: '产品简介', type: 'textarea', required: false, placeholder: '产品功能、特点等' },
      { name: 'company', label: '开发公司', type: 'text', required: false },
      { name: 'category', label: '产品类别', type: 'select', required: false, options: ['社交', '电商', '工具', '娱乐', '金融', '教育', '其他'] },
      { name: 'launchDate', label: '发布时间', type: 'text', required: false, placeholder: '例如：2011年1月' },
    ],
    example: {
      name: '微信',
      aliases: ['WeChat'],
      description: '腾讯推出的即时通讯应用，支持聊天、支付、小程序等功能',
      company: '腾讯',
      category: '社交',
      launchDate: '2011年1月',
    },
    tags: ['产品', '应用'],
  },
  
  // 事件模板
  {
    id: 'template_event',
    name: '事件实体',
    category: 'event',
    description: '添加一个重要事件',
    fields: [
      { name: 'name', label: '事件名称', type: 'text', required: true, placeholder: '例如：2024年AI大模型爆发' },
      { name: 'description', label: '事件描述', type: 'textarea', required: false, placeholder: '事件背景、经过、影响等' },
      { name: 'date', label: '发生时间', type: 'text', required: false, placeholder: '例如：2024年3月' },
      { name: 'location', label: '发生地点', type: 'text', required: false },
      { name: 'impact', label: '影响范围', type: 'select', required: false, options: ['全球', '国内', '行业', '局部'] },
    ],
    example: {
      name: '2024年AI大模型爆发',
      description: 'ChatGPT引领的AI大模型技术快速发展，各科技巨头纷纷推出自己的大模型产品',
      date: '2024年',
      location: '全球',
      impact: '全球',
    },
    tags: ['事件', '科技'],
  },
  
  // 地点模板
  {
    id: 'template_location',
    name: '地点实体',
    category: 'location',
    description: '添加一个地点或地区',
    fields: [
      { name: 'name', label: '地点名称', type: 'text', required: true, placeholder: '例如：深圳' },
      { name: 'aliases', label: '别名', type: 'multiselect', required: false },
      { name: 'description', label: '地点简介', type: 'textarea', required: false, placeholder: '地理位置、特色等' },
      { name: 'type', label: '地点类型', type: 'select', required: false, options: ['城市', '省份', '国家', '区域', '其他'] },
    ],
    example: {
      name: '深圳',
      aliases: ['鹏城'],
      description: '中国广东省辖市，经济特区，科技产业中心',
      type: '城市',
    },
    tags: ['地点', '城市'],
  },
  
  // 政策模板
  {
    id: 'template_policy',
    name: '政策实体',
    category: 'policy',
    description: '添加一个政策或法规',
    fields: [
      { name: 'name', label: '政策名称', type: 'text', required: true, placeholder: '例如：数据安全法' },
      { name: 'description', label: '政策简介', type: 'textarea', required: false, placeholder: '政策内容、影响等' },
      { name: 'issuer', label: '发布机构', type: 'text', required: false },
      { name: 'effectiveDate', label: '生效时间', type: 'text', required: false },
      { name: 'scope', label: '适用范围', type: 'select', required: false, options: ['全国', '地方', '行业', '企业'] },
    ],
    example: {
      name: '数据安全法',
      description: '规范数据处理活动，保障数据安全，促进数据开发利用',
      issuer: '全国人大常委会',
      effectiveDate: '2021年9月1日',
      scope: '全国',
    },
    tags: ['政策', '法规'],
  },
  
  // 行业模板
  {
    id: 'template_industry',
    name: '行业实体',
    category: 'industry',
    description: '添加一个行业或产业',
    fields: [
      { name: 'name', label: '行业名称', type: 'text', required: true, placeholder: '例如：新能源汽车' },
      { name: 'description', label: '行业简介', type: 'textarea', required: false, placeholder: '行业定义、特点、现状等' },
      { name: 'marketSize', label: '市场规模', type: 'text', required: false, placeholder: '例如：万亿级' },
      { name: 'growthRate', label: '增长率', type: 'text', required: false, placeholder: '例如：年增长20%' },
      { name: 'keyPlayers', label: '主要参与者', type: 'multiselect', required: false, placeholder: '主要公司或组织' },
    ],
    example: {
      name: '新能源汽车',
      description: '采用新型动力系统的汽车产业，包括纯电动、混动等',
      marketSize: '万亿级',
      growthRate: '年增长30%+',
      keyPlayers: ['比亚迪', '特斯拉', '蔚来', '理想'],
    },
    tags: ['行业', '产业'],
  },
];

// ==================== 模板服务类 ====================

class KnowledgeTemplateService {
  
  /**
   * 获取所有模板
   */
  getAllTemplates(): KnowledgeTemplate[] {
    return KNOWLEDGE_TEMPLATES;
  }
  
  /**
   * 按类别获取模板
   */
  getTemplatesByCategory(category: string): KnowledgeTemplate[] {
    return KNOWLEDGE_TEMPLATES.filter(t => t.category === category);
  }
  
  /**
   * 获取单个模板
   */
  getTemplate(id: string): KnowledgeTemplate | undefined {
    return KNOWLEDGE_TEMPLATES.find(t => t.id === id);
  }
  
  /**
   * 从模板创建实体数据
   */
  createFromTemplate(templateId: string, values: Record<string, any>): {
    name: string;
    type: string;
    description?: string;
    aliases: string[];
    importance: number;
    properties: Record<string, any>;
  } {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }
    
    // 映射类型
    const typeMapping: Record<string, string> = {
      company: '公司',
      person: '人物',
      product: '产品',
      event: '事件',
      location: '地点',
      policy: '政策',
      industry: '行业',
      other: '其他',
    };
    
    // 提取核心字段
    const name = values.name || '';
    const aliases = Array.isArray(values.aliases) ? values.aliases : 
      (values.aliases ? values.aliases.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
    const description = values.description || '';
    
    // 提取额外属性
    const properties: Record<string, any> = {};
    const coreFields = ['name', 'aliases', 'description'];
    for (const [key, value] of Object.entries(values)) {
      if (!coreFields.includes(key) && value !== undefined && value !== '') {
        properties[key] = value;
      }
    }
    
    return {
      name,
      type: typeMapping[template.category] || '其他',
      description,
      aliases,
      importance: 0.5,
      properties,
    };
  }
  
  /**
   * 获取模板分类列表
   */
  getCategories(): Array<{ id: string; name: string; count: number }> {
    const categoryNames: Record<string, string> = {
      company: '公司',
      person: '人物',
      product: '产品',
      event: '事件',
      location: '地点',
      policy: '政策',
      industry: '行业',
      other: '其他',
    };
    
    const counts = new Map<string, number>();
    for (const template of KNOWLEDGE_TEMPLATES) {
      counts.set(template.category, (counts.get(template.category) || 0) + 1);
    }
    
    return Object.entries(categoryNames).map(([id, name]) => ({
      id,
      name,
      count: counts.get(id) || 0,
    }));
  }
}

// 导出单例
export const knowledgeTemplateService = new KnowledgeTemplateService();
