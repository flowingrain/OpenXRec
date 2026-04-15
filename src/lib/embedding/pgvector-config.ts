/**
 * pgvector 存储维度（与 Qwen3-Embedding-4B MRL 等对齐：常用取前 1024 维）。
 * 须与 Supabase 中 vector(N) 列、RPC 函数参数一致。
 */

const DEFAULT_DIM = 1024;

export function getPgvectorDimension(): number {
  const raw = process.env.OPENXREC_PGVECTOR_DIMENSION?.trim();
  const n = raw ? parseInt(raw, 10) : NaN;
  if (Number.isFinite(n) && n >= 32 && n <= 8192) return n;
  return DEFAULT_DIM;
}

/**
 * 将模型返回的向量截断到目标维度（MRL：取前 N 维）。
 * 若向量更短则抛错（避免静默补零破坏语义）。
 */
export function normalizeEmbeddingForStorage(
  embedding: number[],
  targetDim: number = getPgvectorDimension()
): number[] {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error('normalizeEmbeddingForStorage: empty embedding');
  }
  if (embedding.length === targetDim) return embedding;
  if (embedding.length > targetDim) return embedding.slice(0, targetDim);
  throw new Error(
    `Embedding length ${embedding.length} is shorter than pgvector target ${targetDim}; check model output or OPENXREC_PGVECTOR_DIMENSION`
  );
}
