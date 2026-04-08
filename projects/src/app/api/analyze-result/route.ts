import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

interface AnalyzeResultRequest {
  topic: string;
  framework: any; // 分析框架
  searchResults: any[]; // 搜索结果
}

export async function POST(request: NextRequest) {
  try {
    const { topic, framework, searchResults } = (await request.json()) as AnalyzeResultRequest;
    
    if (!topic || !framework || !searchResults) {
      return new Response(
        JSON.stringify({ error: '参数不完整' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 构建搜索结果摘要
    const searchSummary = searchResults.map((sr: any) => {
      return `
### 搜索关键词: ${sr.query}
AI摘要: ${sr.aiSummary || '无'}
相关新闻:
${sr.results.slice(0, 5).map((r: any) => `- ${r.title} (${r.siteName || '未知来源'})`).join('\n')}
      `.trim();
    }).join('\n\n');

    const systemPrompt = `你是一位资深的宏观态势分析专家，擅长进行归因分析和趋势预测。

你的任务是：
1. 基于搜索到的信息，对主题进行深度归因分析
2. 识别关键影响因素及其权重
3. 分析历史案例和模式
4. 预测未来1-3个月的走势
5. 给出置信度和风险提示

分析要求：
- **客观性**：基于事实和数据，避免主观臆断
- **多维度**：从政治、经济、社会、技术等多角度分析
- **时效性**：关注最新动态和趋势
- **可验证性**：提供可回测的历史案例
- **风险意识**：明确不确定性和潜在风险

输出格式为JSON：
{
  "executiveSummary": "执行摘要（一句话总结）",
  "keyFactors": [
    {
      "factor": "因素名称",
      "description": "因素描述",
      "impact": "正面/负面/中性",
      "weight": 0.0-1.0,
      "evidence": ["证据1", "证据2"]
    }
  ],
  "timeline": {
    "past3Months": "过去3个月的情况",
    "current": "当前状态",
    "future1Month": "未来1个月预测",
    "future3Months": "未来3个月预测"
  },
  "historicalCases": [
    {
      "case": "案例描述",
      "similarity": "相似度说明",
      "outcome": "结果",
      "lessons": "经验教训"
    }
  ],
  "predictions": [
    {
      "scenario": "情景",
      "probability": "概率",
      "description": "详细描述",
      "triggers": ["触发条件1", "触发条件2"]
    }
  ],
  "risks": ["风险1", "风险2"],
  "confidence": {
    "level": "高/中/低",
    "reasoning": "置信度理由"
  },
  "recommendations": ["建议1", "建议2"]
}`;

    const userPrompt = `分析主题：${topic}

分析框架：
${JSON.stringify(framework, null, 2)}

搜索结果：
${searchSummary}

请基于以上信息进行深度归因分析和走势预测。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt }
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: 'doubao-seed-2-0-pro-260215',
            thinking: 'enabled',
            temperature: 0.7
          });

          let fullContent = '';
          
          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              fullContent += text;
              
              // 流式发送数据
              const data = JSON.stringify({ 
                type: 'chunk', 
                content: text 
              });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }

          // 发送完成信号
          const completeData = JSON.stringify({ 
            type: 'complete', 
            fullContent 
          });
          controller.enqueue(encoder.encode(`data: ${completeData}\n\n`));
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = JSON.stringify({ 
            type: 'error', 
            error: error instanceof Error ? error.message : '分析失败' 
          });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : '服务器错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
