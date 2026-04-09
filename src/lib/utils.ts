import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================================
// 向量相似度计算函数
// ============================================================================

/**
 * 计算余弦相似度
 * @param vec1 第一个向量
 * @param vec2 第二个向量
 * @returns 余弦相似度 (0-1)
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);

  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

/**
 * 计算欧氏距离
 * @param vec1 第一个向量
 * @param vec2 第二个向量
 * @returns 欧氏距离
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let sum = 0;

  for (let i = 0; i < vec1.length; i++) {
    sum += Math.pow(vec1[i] - vec2[i], 2);
  }

  return Math.sqrt(sum);
}
