/**
 * 预置响应模板
 * 
 * 定义系统中常用的响应模板
 */

import type { ResponseTemplate } from './types';
import { TemplateType, DEFAULT_RENDER_CONFIGS } from './types';

// ============================================================================
// 对比分析模板
// ============================================================================

export const COMPARISON_ANALYSIS_TEMPLATE: ResponseTemplate = {
  id: TemplateType.COMPARISON_ANALYSIS,
  name: '对比分析模板',
  description: '适用于两个或多个选项的对比分析，输出优缺点、对比表格和推荐建议',

  triggers: {
    queryPatterns: [
      '对比{A}和{B}',
      '{A}和{B}的区别',
      '{A}和{B}哪个好',
      '比较{A}与{B}',
      '{A} vs {B}',
      '{A}和{B}的优缺点',
      '对比分析{A}和{B}',
    ],
    intentTypes: ['comparison_analysis', 'comparison'],
    keywords: ['对比', '比较', '区别', 'vs', '优缺点', '哪个好', '差异'],
    entityCount: { min: 2, max: 5 },
  },

  promptTemplate: `你是一个专业的对比分析师。请基于以下信息生成对比分析。

## 用户问题
{{query}}

## 相关信息
{{#sources}}
### {{title}}
{{snippet}}
{{/sources}}

{{^sources}}
（暂无外部信息来源，请基于你的知识回答）
{{/sources}}

## 对比实体
{{#entities}}
- {{name}} {{#type}}({{.}}){{/type}}
{{/entities}}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "type": "comparison_analysis",
  "entities": [
    {
      "name": "实体名称",
      "type": "类型（可选）",
      "pros": ["优势1", "优势2", "优势3"],
      "cons": ["劣势1", "劣势2"],
      "score": 8.5
    }
  ],
  "dimensions": [
    {
      "name": "对比维度名称",
      "values": {
        "实体A": "值",
        "实体B": "值"
      }
    }
  ],
  "summary": "一句话概括核心差异",
  "conclusion": "详细结论，包括适用场景分析",
  "recommendation": {
    "preferred": "推荐的选项名称（可选）",
    "reason": "推荐理由",
    "conditions": [
      {
        "condition": "如果用户需求是XXX",
        "recommendation": "推荐选择YYY"
      }
    ]
  },
  "sources": [
    {
      "title": "信息来源标题",
      "url": "链接（可选）",
      "snippet": "摘要"
    }
  ]
}
\`\`\`

## 注意事项
1. pros 和 cons 各列出 3-5 条核心要点
2. dimensions 选择 4-6 个最重要的对比维度
3. score 是 1-10 分的综合评分
4. recommendation 要结合不同场景给出建议
5. 如果有信息来源，请准确引用`,

  outputSchema: {
    type: 'object',
    properties: {
      type: { const: 'comparison_analysis' },
      entities: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            type: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
            score: { type: 'number', minimum: 1, maximum: 10 },
          },
          required: ['name', 'pros', 'cons'],
        },
      },
      dimensions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            values: { type: 'object' },
          },
        },
      },
      summary: { type: 'string' },
      conclusion: { type: 'string' },
      recommendation: {
        type: 'object',
        properties: {
          preferred: { type: 'string' },
          reason: { type: 'string' },
          conditions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                condition: { type: 'string' },
                recommendation: { type: 'string' },
              },
            },
          },
        },
      },
      sources: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            url: { type: 'string' },
            snippet: { type: 'string' },
          },
        },
      },
    },
    required: ['type', 'entities', 'summary', 'conclusion'],
  },

  renderConfig: DEFAULT_RENDER_CONFIGS[TemplateType.COMPARISON_ANALYSIS],

  examples: [
    {
      input: '对比特斯拉Model 3和比亚迪汉的优点缺点',
      output: {
        type: 'comparison_analysis',
        entities: [
          {
            name: '特斯拉Model 3',
            type: '电动汽车',
            pros: ['品牌影响力强', '自动驾驶技术领先', '超充网络完善', '操控性能出色'],
            cons: ['价格相对较高', '内饰风格简约', '后排空间一般'],
            score: 8.5,
          },
          {
            name: '比亚迪汉',
            type: '电动汽车',
            pros: ['性价比高', '空间宽敞舒适', '配置丰富', '刀片电池安全'],
            cons: ['品牌溢价较低', '智能化程度一般', '超充网络待完善'],
            score: 8.0,
          },
        ],
        summary: 'Model 3主打科技感和品牌价值，汉主打性价比和舒适空间',
        conclusion: '两款车各有特色，Model 3适合追求科技体验的年轻用户，汉适合注重性价比的家庭用户。',
        recommendation: {
          reason: '根据预算和使用场景选择',
          conditions: [
            { condition: '预算充足，追求科技感和驾驶乐趣', recommendation: '推荐Model 3' },
            { condition: '注重性价比和家庭出行', recommendation: '推荐比亚迪汉' },
          ],
        },
      },
    },
  ],
};

// ============================================================================
// 排序列表模板
// ============================================================================

export const RANKING_LIST_TEMPLATE: ResponseTemplate = {
  id: TemplateType.RANKING_LIST,
  name: '排序列表模板',
  description: '适用于多选项推荐和排名，输出排序结果和对比表格',

  triggers: {
    queryPatterns: [
      '推荐几个{category}',
      '{category}排名',
      '哪个{category}好',
      '{category}推荐',
      '给我一些{category}建议',
      '最好的{category}',
      '{category}排行榜',
    ],
    intentTypes: ['ranking', 'recommendation'],
    keywords: ['推荐', '排名', '排行榜', '哪个好', '最好', 'top'],
    entityCount: { min: 3, max: 10 },
  },

  promptTemplate: `你是一个专业的推荐顾问。请基于以下信息生成推荐排名。

## 用户问题
{{query}}

## 用户需求
{{#requirements}}
- {{.}}
{{/requirements}}

## 相关信息
{{#sources}}
### {{title}}
{{snippet}}
{{/sources}}

{{^sources}}
（暂无外部信息来源，请基于你的知识回答）
{{/sources}}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "type": "ranking_list",
  "category": "推荐分类名称",
  "items": [
    {
      "rank": 1,
      "title": "名称",
      "description": "简介（50字以内）",
      "score": 9.0,
      "maxScore": 10,
      "advantages": ["优势1", "优势2"],
      "disadvantages": ["劣势1"],
      "reasoning": "推荐理由（100字以内）",
      "targetUsers": "适合什么人群",
      "priceRange": "价格区间（可选）",
      "source": "信息来源",
      "sourceUrl": "来源链接（可选）"
    }
  ],
  "comparisonTable": [
    {
      "name": "项目名称",
      "评分": "9.0",
      "特点": "核心特点",
      "价格": "价格区间"
    }
  ],
  "selectionGuide": {
    "highBudget": "预算充足推荐第X名",
    "valueForMoney": "性价比推荐第X名",
    "entryLevel": "入门推荐第X名",
    "custom": [
      {
        "scenario": "特定场景",
        "recommendation": "推荐选择"
      }
    ]
  },
  "sources": [
    {
      "title": "信息来源标题",
      "url": "链接"
    }
  ]
}
\`\`\`

## 注意事项
1. items 推荐输出 3-5 个最佳选项
2. score 使用 1-10 分制
3. advantages/disadvantages 各 2-3 条
4. comparisonTable 用于快速对比关键指标
5. selectionGuide 给出不同场景的选择建议`,

  outputSchema: {
    type: 'object',
    properties: {
      type: { const: 'ranking_list' },
      category: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            rank: { type: 'number' },
            title: { type: 'string' },
            description: { type: 'string' },
            score: { type: 'number' },
            maxScore: { type: 'number' },
            advantages: { type: 'array', items: { type: 'string' } },
            disadvantages: { type: 'array', items: { type: 'string' } },
            reasoning: { type: 'string' },
            targetUsers: { type: 'string' },
            priceRange: { type: 'string' },
            source: { type: 'string' },
            sourceUrl: { type: 'string' },
          },
          required: ['rank', 'title', 'score', 'reasoning'],
        },
      },
      comparisonTable: { type: 'array' },
      selectionGuide: {
        type: 'object',
        properties: {
          highBudget: { type: 'string' },
          valueForMoney: { type: 'string' },
          entryLevel: { type: 'string' },
          custom: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                scenario: { type: 'string' },
                recommendation: { type: 'string' },
              },
            },
          },
        },
      },
      sources: { type: 'array' },
    },
    required: ['type', 'category', 'items'],
  },

  renderConfig: DEFAULT_RENDER_CONFIGS[TemplateType.RANKING_LIST],

  examples: [
    {
      input: '推荐几本人工智能入门书籍',
      output: {
        type: 'ranking_list',
        category: '人工智能书籍',
        items: [
          {
            rank: 1,
            title: '深度学习',
            description: 'AI领域经典著作，三位作者都是深度学习先驱',
            score: 9.5,
            reasoning: '内容权威全面，适合系统学习深度学习原理',
            targetUsers: '有一定数学和编程基础的读者',
          },
        ],
      },
    },
  ],
};

// ============================================================================
// 单一答案模板
// ============================================================================

export const SINGLE_ANSWER_TEMPLATE: ResponseTemplate = {
  id: TemplateType.SINGLE_ANSWER,
  name: '单一答案模板',
  description: '适用于问答型查询，输出简洁准确的答案',

  triggers: {
    queryPatterns: [
      '什么是{concept}',
      '{concept}是什么意思',
      '为什么{question}',
      '如何{action}',
      '{concept}的定义',
      '解释一下{concept}',
      '告诉我{concept}',
    ],
    intentTypes: ['single', 'qa', 'definition'],
    keywords: ['是什么', '什么是', '为什么', '如何', '定义', '解释', '意思'],
    entityCount: { min: 0, max: 1 },
  },

  promptTemplate: `你是一个知识渊博的助手。请基于以下信息回答用户问题。

## 用户问题
{{query}}

## 相关信息
{{#sources}}
### {{title}}
{{snippet}}
{{/sources}}

{{^sources}}
（暂无外部信息来源，请基于你的知识回答）
{{/sources}}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "type": "single_answer",
  "answer": "核心答案（简洁明了，100字以内）",
  "explanation": "详细解释（300字以内）",
  "examples": [
    {
      "title": "示例标题",
      "content": "示例内容"
    }
  ],
  "relatedConcepts": [
    {
      "term": "相关概念",
      "definition": "概念定义"
    }
  ],
  "sources": [
    {
      "title": "信息来源",
      "url": "链接"
    }
  ]
}
\`\`\`

## 注意事项
1. answer 要直接回答用户问题，简洁有力
2. explanation 提供更详细的背景和解释
3. examples 使用具体实例帮助理解
4. relatedConcepts 列出 2-3 个相关概念`,

  outputSchema: {
    type: 'object',
    properties: {
      type: { const: 'single_answer' },
      answer: { type: 'string' },
      explanation: { type: 'string' },
      examples: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' },
          },
        },
      },
      relatedConcepts: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            term: { type: 'string' },
            definition: { type: 'string' },
          },
        },
      },
      sources: { type: 'array' },
    },
    required: ['type', 'answer'],
  },

  renderConfig: DEFAULT_RENDER_CONFIGS[TemplateType.SINGLE_ANSWER],

  examples: [
    {
      input: '什么是机器学习',
      output: {
        type: 'single_answer',
        answer: '机器学习是人工智能的一个分支，让计算机能够从数据中自动学习和改进，而无需显式编程。',
        explanation: '机器学习通过算法让计算机识别数据中的模式，并做出预测或决策。它包括监督学习、无监督学习和强化学习等类型。',
        examples: [
          {
            title: '垃圾邮件过滤',
            content: '邮件系统通过学习历史邮件特征，自动识别垃圾邮件',
          },
        ],
      },
    },
  ],
};

// ============================================================================
// 推荐列表模板
// ============================================================================

export const RECOMMENDATION_ITEMS_TEMPLATE: ResponseTemplate = {
  id: TemplateType.RECOMMENDATION_ITEMS,
  name: '推荐列表模板',
  description: '通用推荐模板，输出推荐项列表及解释',

  triggers: {
    queryPatterns: [
      '推荐{item}',
      '给我推荐{item}',
      '有什么{item}推荐',
      '{item}有哪些',
    ],
    intentTypes: ['recommendation', 'item_recommendation'],
    keywords: ['推荐', '有什么', '有哪些'],
  },

  promptTemplate: `你是一个推荐助手。请基于以下信息生成推荐。

## 用户问题
{{query}}

## 相关信息
{{#sources}}
### {{title}}
{{snippet}}
{{/sources}}

{{^sources}}
（暂无外部信息来源，请基于你的知识回答）
{{/sources}}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "type": "recommendation_items",
  "items": [
    {
      "id": "unique-id",
      "title": "推荐项名称",
      "description": "简介（100字以内）",
      "score": 8.5,
      "confidence": 0.9,
      "explanations": [
        {
          "type": "推荐理由类型",
          "reason": "详细推荐理由",
          "factors": [
            {
              "name": "因素名",
              "value": "因素值",
              "importance": 0.8
            }
          ]
        }
      ],
      "source": "信息来源",
      "sourceUrl": "来源链接",
      "image": "图片链接（可选）"
    }
  ],
  "explanation": "整体推荐说明",
  "strategy": "使用的推荐策略"
}
\`\`\`

## 注意事项
1. items 推荐输出 3-5 个选项
2. explanations 每项至少一个推荐理由
3. confidence 表示推荐置信度（0-1）
4. source 和 sourceUrl 标注信息来源`,

  outputSchema: {
    type: 'object',
    properties: {
      type: { const: 'recommendation_items' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            score: { type: 'number' },
            confidence: { type: 'number' },
            explanations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string' },
                  reason: { type: 'string' },
                  factors: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        value: { type: 'string' },
                        importance: { type: 'number' },
                      },
                    },
                  },
                },
              },
            },
            source: { type: 'string' },
            sourceUrl: { type: 'string' },
            image: { type: 'string' },
          },
          required: ['id', 'title', 'description'],
        },
      },
      explanation: { type: 'string' },
      strategy: { type: 'string' },
    },
    required: ['type', 'items'],
  },

  renderConfig: DEFAULT_RENDER_CONFIGS[TemplateType.RECOMMENDATION_ITEMS],

  examples: [],
};

// ============================================================================
// 追问引导模板
// ============================================================================

export const CLARIFICATION_TEMPLATE: ResponseTemplate = {
  id: TemplateType.CLARIFICATION,
  name: '追问引导模板',
  description: '适用于信息不足需要追问的场景',

  triggers: {
    intentTypes: ['clarification', 'need_info'],
  },

  promptTemplate: `用户问题：{{query}}

当前已获取的信息：
{{#extractedInfo}}
- {{.}}
{{/extractedInfo}}

缺失的关键信息：
{{#missingFields}}
- {{name}}: {{description}}
{{/missingFields}}

## 输出要求
请严格按照以下 JSON 格式输出，不要输出其他内容：

\`\`\`json
{
  "type": "clarification",
  "questions": [
    {
      "id": "q1",
      "question": "追问问题",
      "type": "single_choice",
      "options": ["选项1", "选项2", "选项3"],
      "required": true,
      "priority": "high",
      "placeholder": "提示文字（可选）"
    }
  ],
  "extractedInfo": ["已提取的信息"],
  "suggestedAnswers": "建议的回答方式",
  "guidance": "引导说明"
}
\`\`\`

## 注意事项
1. questions 最多 3 个关键问题
2. type 支持：single_choice, multiple_choice, text, range, date
3. priority 设置为 high/medium/low
4. required 标记是否必须回答`,

  outputSchema: {
    type: 'object',
    properties: {
      type: { const: 'clarification' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            question: { type: 'string' },
            type: { type: 'string', enum: ['single_choice', 'multiple_choice', 'text', 'range', 'date'] },
            options: { type: 'array', items: { type: 'string' } },
            required: { type: 'boolean' },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
            placeholder: { type: 'string' },
          },
          required: ['id', 'question', 'type', 'required', 'priority'],
        },
      },
      extractedInfo: { type: 'array', items: { type: 'string' } },
      suggestedAnswers: { type: 'string' },
      guidance: { type: 'string' },
    },
    required: ['type', 'questions'],
  },

  renderConfig: DEFAULT_RENDER_CONFIGS[TemplateType.CLARIFICATION],

  examples: [],
};

// ============================================================================
// 导出所有预置模板
// ============================================================================

export const PRESET_TEMPLATES = {
  [TemplateType.COMPARISON_ANALYSIS]: COMPARISON_ANALYSIS_TEMPLATE,
  [TemplateType.RANKING_LIST]: RANKING_LIST_TEMPLATE,
  [TemplateType.SINGLE_ANSWER]: SINGLE_ANSWER_TEMPLATE,
  [TemplateType.RECOMMENDATION_ITEMS]: RECOMMENDATION_ITEMS_TEMPLATE,
  [TemplateType.CLARIFICATION]: CLARIFICATION_TEMPLATE,
} as const;
