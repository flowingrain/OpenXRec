/**
 * 简单的情感分析
 * 基于关键词统计判断内容情感倾向
 */
export function analyzeSentiment(content: string): { 
  positive: number; 
  neutral: number; 
  negative: number 
} {
  const positiveWords = ['增长', '突破', '创新', '成功', '发展', '机遇', '提升', '利好', '进步', '繁荣'];
  const negativeWords = ['风险', '挑战', '下降', '危机', '问题', '压力', '衰退', '困难', '威胁', '损失'];
  
  const lowerContent = content.toLowerCase();
  let positiveCount = 0;
  let negativeCount = 0;
  
  positiveWords.forEach(word => {
    if (lowerContent.includes(word)) positiveCount++;
  });
  
  negativeWords.forEach(word => {
    if (lowerContent.includes(word)) negativeCount++;
  });
  
  const total = positiveCount + negativeCount + 1;
  const rawPositive = positiveCount / total;
  const rawNegative = negativeCount / total;
  const rawNeutral = 1 - rawPositive - rawNegative;
  
  // 归一化并限制范围
  const positive = Math.max(0.2, Math.min(0.4, Math.round(rawPositive * 100) / 100));
  const negative = Math.max(0.1, Math.min(0.3, Math.round(rawNegative * 100) / 100));
  const neutral = Math.max(0.3, Math.min(0.5, Math.round(rawNeutral * 100) / 100));
  
  // 确保总和为1
  const sum = positive + negative + neutral;
  
  return {
    positive: Math.round((positive / sum) * 100) / 100,
    neutral: Math.round((neutral / sum) * 100) / 100,
    negative: Math.round((negative / sum) * 100) / 100
  };
}
