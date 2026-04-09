/**
 * 关系类型管理 API
 * 
 * 支持：
 * - 获取所有关系类型
 * - 动态抽取新关系类型
 * - 合并关系类型
 * - 创建层级关系
 */

import { NextRequest, NextResponse } from 'next/server';
import type { LLMClient } from 'coze-coding-dev-sdk';
import { createLLMClient } from '@/lib/llm/create-llm-client';
import { 
  createRelationTypeManager,
  RelationTypeEntry,
  PREDEFINED_RELATION_TYPES,
} from '@/lib/knowledge-graph/relation-type-manager';

// LLM客户端单例
let llmClient: LLMClient | null = null;
let relationTypeManager: ReturnType<typeof createRelationTypeManager> | null = null;

function getRelationTypeManager(): ReturnType<typeof createRelationTypeManager> {
  if (!relationTypeManager) {
    if (!llmClient) {
      llmClient = createLLMClient({});
    }
    relationTypeManager = createRelationTypeManager(llmClient);
  }
  return relationTypeManager;
}

/**
 * 获取所有关系类型
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const includeStats = searchParams.get('includeStats') === 'true';

    const manager = getRelationTypeManager();

    if (category) {
      const types = manager.getTypesByCategory(category as any);
      return NextResponse.json({
        success: true,
        data: types,
      });
    }

    const types = manager.getAllTypes();
    const response: any = { success: true, data: types };

    if (includeStats) {
      response.stats = manager.getStats();
    }

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('[RelationType API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * 关系类型操作
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...params } = body;

    const manager = getRelationTypeManager();

    switch (action) {
      case 'extract': {
        // 动态抽取关系类型
        const { text, minConfidence } = params;
        
        if (!text) {
          return NextResponse.json(
            { success: false, error: '缺少文本内容' },
            { status: 400 }
          );
        }

        const result = await manager.extractRelationTypes({
          text,
          minConfidence,
        });

        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case 'add': {
        // 添加自定义关系类型
        const { name, category, synonyms, description } = params;
        
        if (!name || !category) {
          return NextResponse.json(
            { success: false, error: '缺少必需参数' },
            { status: 400 }
          );
        }

        const now = Date.now();
        const entry: RelationTypeEntry = {
          id: `custom_${now}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          normalizedName: name.toLowerCase().trim(),
          category,
          synonyms: synonyms || [],
          isPredefined: false,
          isVerified: false,
          confidence: 0.5,
          usageCount: 0,
          description,
          createdAt: now,
          updatedAt: now,
        };

        manager.addType(entry);

        return NextResponse.json({
          success: true,
          data: entry,
        });
      }

      case 'merge': {
        // 合并关系类型
        const { sourceIds, targetId, reason } = params;
        
        if (!sourceIds || !targetId) {
          return NextResponse.json(
            { success: false, error: '缺少必需参数' },
            { status: 400 }
          );
        }

        const success = manager.mergeTypes(sourceIds, targetId, reason || '');
        const target = manager.getType(targetId);

        return NextResponse.json({
          success,
          data: target,
          message: success ? '合并成功' : '合并失败',
        });
      }

      case 'createHierarchy': {
        // 创建层级关系
        const { parentId, childName, description } = params;
        
        if (!parentId || !childName) {
          return NextResponse.json(
            { success: false, error: '缺少必需参数' },
            { status: 400 }
          );
        }

        const child = manager.createHierarchy(parentId, childName, description);

        return NextResponse.json({
          success: !!child,
          data: child,
        });
      }

      case 'findSimilar': {
        // 查找相似类型
        const { name, threshold } = params;
        
        if (!name) {
          return NextResponse.json(
            { success: false, error: '缺少关系类型名称' },
            { status: 400 }
          );
        }

        const similar = manager.findSimilarTypes(name, threshold || 0.7);

        return NextResponse.json({
          success: true,
          data: similar,
        });
      }

      case 'update': {
        // 更新关系类型
        const { id, ...updates } = params;
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: '缺少类型ID' },
            { status: 400 }
          );
        }

        manager.updateType(id, updates);
        const updated = manager.getType(id);

        return NextResponse.json({
          success: !!updated,
          data: updated,
        });
      }

      case 'delete': {
        // 删除关系类型
        const { id } = params;
        
        if (!id) {
          return NextResponse.json(
            { success: false, error: '缺少类型ID' },
            { status: 400 }
          );
        }

        const success = manager.deleteType(id);

        return NextResponse.json({
          success,
          message: success ? '删除成功' : '删除失败（预定义类型不可删除）',
        });
      }

      case 'export': {
        // 导出所有类型
        const types = manager.exportTypes();

        return NextResponse.json({
          success: true,
          data: types,
          count: types.length,
        });
      }

      case 'import': {
        // 导入类型
        const { types } = params;
        
        if (!types || !Array.isArray(types)) {
          return NextResponse.json(
            { success: false, error: '缺少类型列表' },
            { status: 400 }
          );
        }

        const imported = manager.importTypes(types);

        return NextResponse.json({
          success: true,
          imported,
          message: `成功导入 ${imported} 个类型`,
        });
      }

      case 'stats': {
        // 获取统计信息
        const stats = manager.getStats();

        return NextResponse.json({
          success: true,
          data: stats,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `未知操作: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('[RelationType API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
