/**
 * 案例复用模板服务
 * 
 * 从高质量案例中提取可复用模板
 */

import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== 类型定义 ====================

export interface CaseTemplate {
  id: string;
  name: string;
  description: string;
  domain: string;
  qualityScore: number;
  usageCount: number;
  sourceCaseId: string;
  
  // 模板结构
  structure: {
    queryTemplate: string;
    keyFactorsTemplate: string[];
    conclusionTemplate: string;
    tagsTemplate: string[];
  };
  
  // 变量占位符
  variables: TemplateVariable[];
  
  createdAt: string;
  updatedAt: string;
}

export interface TemplateVariable {
  name: string;
  label: string;
  type: 'text' | 'select' | 'multiselect';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface ApplyTemplateResult {
  query: string;
  domain: string;
  keyFactors: string[];
  conclusion: string;
  tags: string[];
}

// ==================== 服务类 ====================

class CaseTemplateService {
  
  /**
   * 从高质量案例创建模板
   */
  async createTemplateFromCase(caseId: string): Promise<CaseTemplate | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    
    try {
      const { data: caseData } = await supabase
        .from('analysis_cases')
        .select('*')
        .eq('id', caseId)
        .single();
      
      if (!caseData) return null;
      
      // 只有高质量案例才能创建模板
      const qualityScore = caseData.quality_score || caseData.user_rating || 0;
      if (qualityScore < 0.7) {
        console.warn('[CaseTemplateService] Case quality too low for template');
        return null;
      }
      
      // 提取变量
      const variables = this.extractVariables(caseData);
      
      // 创建模板结构
      const template: CaseTemplate = {
        id: `template_case_${Date.now()}`,
        name: this.generateTemplateName(caseData),
        description: `基于案例"${caseData.query.substring(0, 30)}..."生成的模板`,
        domain: caseData.domain || 'general',
        qualityScore,
        usageCount: 0,
        sourceCaseId: caseId,
        structure: {
          queryTemplate: this.createQueryTemplate(caseData.query),
          keyFactorsTemplate: caseData.key_factors || [],
          conclusionTemplate: caseData.conclusion?.summary || caseData.final_report || '',
          tagsTemplate: caseData.tags || [],
        },
        variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // 保存模板到数据库
      const { error } = await supabase
        .from('case_templates')
        .insert({
          id: template.id,
          name: template.name,
          description: template.description,
          domain: template.domain,
          quality_score: template.qualityScore,
          usage_count: template.usageCount,
          source_case_id: template.sourceCaseId,
          structure: template.structure,
          variables: template.variables,
          created_at: template.createdAt,
          updated_at: template.updatedAt,
        });
      
      if (error) {
        console.error('[CaseTemplateService] Failed to save template:', error);
        // 即使保存失败也返回模板（内存中使用）
      }
      
      return template;
    } catch (error) {
      console.error('[CaseTemplateService] Failed to create template:', error);
      return null;
    }
  }
  
  /**
   * 获取所有可用模板
   */
  async getTemplates(domain?: string): Promise<CaseTemplate[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return this.getDefaultTemplates();
    
    try {
      let query = supabase
        .from('case_templates')
        .select('*')
        .order('quality_score', { ascending: false });
      
      if (domain) {
        query = query.eq('domain', domain);
      }
      
      const { data, error } = await query.limit(50);
      
      if (error || !data || data.length === 0) {
        return this.getDefaultTemplates();
      }
      
      return data.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        domain: t.domain,
        qualityScore: t.quality_score,
        usageCount: t.usage_count,
        sourceCaseId: t.source_case_id,
        structure: t.structure,
        variables: t.variables,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      }));
    } catch (error) {
      console.error('[CaseTemplateService] Failed to get templates:', error);
      return this.getDefaultTemplates();
    }
  }
  
  /**
   * 应用模板生成新案例
   */
  async applyTemplate(templateId: string, values: Record<string, string>): Promise<ApplyTemplateResult | null> {
    const supabase = getSupabaseClient();
    
    let template: CaseTemplate | null = null;
    
    if (supabase) {
      try {
        const { data } = await supabase
          .from('case_templates')
          .select('*')
          .eq('id', templateId)
          .single();
        
        if (data) {
          template = {
            id: data.id,
            name: data.name,
            description: data.description,
            domain: data.domain,
            qualityScore: data.quality_score,
            usageCount: data.usage_count,
            sourceCaseId: data.source_case_id,
            structure: data.structure,
            variables: data.variables,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
        }
      } catch (e) {
        console.warn('[CaseTemplateService] Failed to load template from DB');
      }
    }
    
    // 如果数据库没有，从默认模板查找
    if (!template) {
      template = this.getDefaultTemplates().find(t => t.id === templateId) || null;
    }
    
    if (!template) return null;
    
    // 替换变量
    let query = template.structure.queryTemplate;
    let conclusion = template.structure.conclusionTemplate;
    
    for (const variable of template.variables) {
      const value = values[variable.name] || variable.defaultValue || '';
      const placeholder = `{{${variable.name}}}`;
      query = query.replace(new RegExp(placeholder, 'g'), value);
      conclusion = conclusion.replace(new RegExp(placeholder, 'g'), value);
    }
    
    // 更新使用计数
    if (supabase) {
      await supabase
        .from('case_templates')
        .update({ usage_count: template.usageCount + 1 })
        .eq('id', templateId);
    }
    
    return {
      query,
      domain: template.domain,
      keyFactors: template.structure.keyFactorsTemplate,
      conclusion,
      tags: template.structure.tagsTemplate,
    };
  }
  
  /**
   * 提取变量
   */
  private extractVariables(caseData: any): TemplateVariable[] {
    const variables: TemplateVariable[] = [];
    
    // 从查询中提取可能的变量
    const query = caseData.query || '';
    
    // 常见变量模式
    const patterns = [
      { pattern: /[\u4e00-\u9fa5]{2,}公司/g, name: 'company', label: '公司名称' },
      { pattern: /\d{4}年/g, name: 'year', label: '年份' },
      { pattern: /[\u4e00-\u9fa5]{2,}行业/g, name: 'industry', label: '行业' },
    ];
    
    for (const { pattern, name, label } of patterns) {
      const matches = query.match(pattern);
      if (matches && matches.length > 0) {
        variables.push({
          name,
          label,
          type: 'text',
          required: false,
          defaultValue: matches[0],
        });
      }
    }
    
    // 默认添加主题变量
    if (!variables.find(v => v.name === 'topic')) {
      variables.push({
        name: 'topic',
        label: '分析主题',
        type: 'text',
        required: true,
      });
    }
    
    return variables;
  }
  
  /**
   * 创建查询模板
   */
  private createQueryTemplate(query: string): string {
    let template = query;
    
    // 替换年份
    template = template.replace(/\d{4}年/g, '{{year}}');
    
    // 替换公司名（简化处理）
    // 实际应用中可以使用NLP进行更精确的提取
    
    return template;
  }
  
  /**
   * 生成模板名称
   */
  private generateTemplateName(caseData: any): string {
    const domain = caseData.domain || '通用';
    const query = caseData.query || '';
    const shortQuery = query.substring(0, 20) + (query.length > 20 ? '...' : '');
    return `${domain}案例模板 - ${shortQuery}`;
  }
  
  /**
   * 获取默认模板
   */
  private getDefaultTemplates(): CaseTemplate[] {
    return [
      {
        id: 'template_default_tech',
        name: '科技趋势分析模板',
        description: '分析科技行业发展趋势',
        domain: 'tech_trend',
        qualityScore: 0.9,
        usageCount: 0,
        sourceCaseId: 'system',
        structure: {
          queryTemplate: '{{year}}年{{topic}}发展趋势分析',
          keyFactorsTemplate: ['技术成熟度', '市场规模', '政策支持', '竞争格局'],
          conclusionTemplate: '{{topic}}领域在{{year}}年呈现加速发展态势，建议关注技术创新和市场机会。',
          tagsTemplate: ['科技', '趋势', '{{year}}'],
        },
        variables: [
          { name: 'year', label: '年份', type: 'text', required: true, defaultValue: '2024' },
          { name: 'topic', label: '分析主题', type: 'text', required: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'template_default_market',
        name: '市场分析模板',
        description: '分析特定市场的发展状况',
        domain: 'market_analysis',
        qualityScore: 0.85,
        usageCount: 0,
        sourceCaseId: 'system',
        structure: {
          queryTemplate: '{{company}}{{topic}}市场分析',
          keyFactorsTemplate: ['市场规模', '增长率', '主要参与者', '进入壁垒'],
          conclusionTemplate: '{{company}}在{{topic}}市场具有较强竞争力，建议持续关注市场动态。',
          tagsTemplate: ['市场分析', '{{company}}'],
        },
        variables: [
          { name: 'company', label: '公司/品牌', type: 'text', required: true },
          { name: 'topic', label: '市场领域', type: 'text', required: true },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 'template_default_product',
        name: '产品推荐模板',
        description: '基于需求推荐产品',
        domain: 'product_recommendation',
        qualityScore: 0.85,
        usageCount: 0,
        sourceCaseId: 'system',
        structure: {
          queryTemplate: '推荐适合{{scenario}}的{{category}}产品',
          keyFactorsTemplate: ['功能匹配度', '性价比', '用户评价', '品牌信誉'],
          conclusionTemplate: '根据您的需求，推荐关注以下产品特点：{{features}}',
          tagsTemplate: ['产品推荐', '{{category}}'],
        },
        variables: [
          { name: 'scenario', label: '使用场景', type: 'text', required: true },
          { name: 'category', label: '产品类别', type: 'select', required: true, options: ['软件工具', '硬件设备', '服务平台', '学习资源'] },
          { name: 'features', label: '关注特性', type: 'text', required: false },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }
}

// 导出单例
export const caseTemplateService = new CaseTemplateService();
