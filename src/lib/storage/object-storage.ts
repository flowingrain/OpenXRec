/**
 * 统一存储服务
 * 集成 S3 对象存储，用于文件上传、下载、管理
 */

import { S3Storage } from 'coze-coding-dev-sdk';

// 存储类型
export type StorageCategory = 
  | 'reports'      // 分析报告
  | 'graphs'       // 知识图谱图片
  | 'knowledge'    // 知识库文档
  | 'snapshots'    // 快照备份
  | 'exports'      // 导出文件
  | 'uploads';     // 通用上传

// 存储服务实例
let storageInstance: S3Storage | null = null;

/**
 * 获取存储服务实例
 */
export function getStorage(): S3Storage {
  if (!storageInstance) {
    storageInstance = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    });
  }
  return storageInstance;
}

/**
 * 生成文件存储路径
 */
export function generateStoragePath(
  category: StorageCategory,
  filename: string,
  caseId?: string
): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  
  if (caseId) {
    return `${category}/${caseId}/${year}${month}/${filename}`;
  }
  return `${category}/${year}${month}/${filename}`;
}

/**
 * 上传文件到对象存储
 */
export async function uploadFile(
  category: StorageCategory,
  file: {
    content: Buffer | string;
    filename: string;
    contentType: string;
  },
  options?: {
    caseId?: string;
    metadata?: Record<string, string>;
  }
): Promise<{ key: string; url: string }> {
  const storage = getStorage();
  
  // 生成存储路径
  const storagePath = generateStoragePath(category, file.filename, options?.caseId);
  
  // 上传文件
  const content = typeof file.content === 'string' 
    ? Buffer.from(file.content, 'utf-8')
    : file.content;
  
  const key = await storage.uploadFile({
    fileContent: content,
    fileName: storagePath,
    contentType: file.contentType,
  });
  
  // 生成签名 URL（默认 7 天有效期）
  const url = await storage.generatePresignedUrl({
    key,
    expireTime: 7 * 24 * 60 * 60, // 7 天
  });
  
  return { key, url };
}

/**
 * 从 URL 下载并上传到对象存储
 */
export async function uploadFromUrl(
  category: StorageCategory,
  url: string,
  options?: {
    caseId?: string;
    filename?: string;
    timeout?: number;
  }
): Promise<{ key: string; url: string }> {
  const storage = getStorage();
  
  // 从 URL 上传
  const key = await storage.uploadFromUrl({
    url,
    timeout: options?.timeout || 30000,
  });
  
  // 如果指定了自定义路径，需要重新命名
  if (options?.caseId || options?.filename) {
    const filename = options.filename || key.split('/').pop() || 'file';
    const newPath = generateStoragePath(category, filename, options.caseId);
    
    // 读取并重新上传到新路径
    const content = await storage.readFile({ fileKey: key });
    await storage.deleteFile({ fileKey: key });
    
    const newKey = await storage.uploadFile({
      fileContent: content,
      fileName: newPath,
    });
    
    const signedUrl = await storage.generatePresignedUrl({
      key: newKey,
      expireTime: 7 * 24 * 60 * 60,
    });
    
    return { key: newKey, url: signedUrl };
  }
  
  const signedUrl = await storage.generatePresignedUrl({
    key,
    expireTime: 7 * 24 * 60 * 60,
  });
  
  return { key, url: signedUrl };
}

/**
 * 获取文件访问 URL
 */
export async function getFileUrl(key: string, expireTime?: number): Promise<string> {
  const storage = getStorage();
  return storage.generatePresignedUrl({
    key,
    expireTime: expireTime || 7 * 24 * 60 * 60, // 默认 7 天
  });
}

/**
 * 读取文件内容
 */
export async function readFile(key: string): Promise<Buffer> {
  const storage = getStorage();
  return storage.readFile({ fileKey: key });
}

/**
 * 删除文件
 */
export async function deleteFile(key: string): Promise<boolean> {
  const storage = getStorage();
  return storage.deleteFile({ fileKey: key });
}

/**
 * 检查文件是否存在
 */
export async function fileExists(key: string): Promise<boolean> {
  const storage = getStorage();
  return storage.fileExists({ fileKey: key });
}

/**
 * 列出文件
 */
export async function listFiles(
  category: StorageCategory,
  options?: {
    caseId?: string;
    maxKeys?: number;
    continuationToken?: string;
  }
): Promise<{
  keys: string[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}> {
  const storage = getStorage();
  const prefix = options?.caseId 
    ? `${category}/${options.caseId}/`
    : `${category}/`;
  
  return storage.listFiles({
    prefix,
    maxKeys: options?.maxKeys || 100,
    continuationToken: options?.continuationToken,
  });
}

/**
 * 上传分析报告
 */
export async function uploadReport(
  caseId: string,
  report: {
    content: string;
    filename: string;
    format: 'pdf' | 'markdown' | 'html';
  }
): Promise<{ key: string; url: string }> {
  const contentTypes: Record<string, string> = {
    pdf: 'application/pdf',
    markdown: 'text/markdown',
    html: 'text/html',
  };
  
  return uploadFile('reports', {
    content: report.content,
    filename: report.filename,
    contentType: contentTypes[report.format] || 'application/octet-stream',
  }, { caseId });
}

/**
 * 上传知识图谱图片
 */
export async function uploadGraphImage(
  caseId: string,
  imageData: Buffer,
  format: 'png' | 'svg' = 'png'
): Promise<{ key: string; url: string }> {
  const contentTypes: Record<string, string> = {
    png: 'image/png',
    svg: 'image/svg+xml',
  };
  
  return uploadFile('graphs', {
    content: imageData,
    filename: `knowledge-graph.${format}`,
    contentType: contentTypes[format],
  }, { caseId });
}

/**
 * 上传知识库文档
 */
export async function uploadKnowledgeDoc(
  doc: {
    content: Buffer;
    filename: string;
    contentType: string;
  },
  metadata?: Record<string, string>
): Promise<{ key: string; url: string }> {
  return uploadFile('knowledge', doc, { metadata });
}

/**
 * 上传知识图谱快照
 */
export async function uploadSnapshot(
  caseId: string,
  snapshotData: {
    entities: any[];
    relations: any[];
    metadata?: Record<string, any>;
  }
): Promise<{ key: string; url: string }> {
  const content = JSON.stringify(snapshotData, null, 2);
  
  return uploadFile('snapshots', {
    content,
    filename: `snapshot-${Date.now()}.json`,
    contentType: 'application/json',
  }, { caseId });
}
