import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 检查数据库表状态
 */
export async function GET() {
  const supabaseUrl = process.env.COZE_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.COZE_SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({
      success: false,
      error: 'Supabase credentials not found'
    }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 所有需要检查的表
  const allTables = {
    'Schema Tables': [
      'ab_experiments',
      'health_check',
      'experiment_runs',
      'knowledge_patterns',
      'optimizations',
      'case_embeddings',
      'user_feedbacks',
      'analysis_cases',
      'kg_entities',
      'kg_relations',
      'kg_corrections',
      'kg_snapshots',
      'user_preferences',
      'report_versions',
      'knowledge_docs'
    ],
    'User System Tables': [
      'users',
      'user_sessions',
      'user_interactions',
      'user_profiles',
      'recommendation_history',
      'user_feedback'
    ],
    'Recommendation Infrastructure': [
      'recommendation_knowledge',
      'recommendation_items',
      'recommendation_embeddings',
      'recommendation_cases',
      'recommendation_scenarios',
      'recommendation_algorithms'
    ]
  };

  const results: Record<string, any> = {};
  const missingTables: string[] = [];
  const existingTables: string[] = [];

  for (const [category, tables] of Object.entries(allTables)) {
    results[category] = {};
    
    for (const tableName of tables) {
      try {
        // 尝试查询表
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(0);
        
        if (error) {
          // 表不存在
          results[category][tableName] = {
            status: 'MISSING',
            error: error.message
          };
          missingTables.push(tableName);
        } else {
          // 表存在
          results[category][tableName] = {
            status: 'EXISTS'
          };
          existingTables.push(tableName);
        }
      } catch (err: any) {
        results[category][tableName] = {
          status: 'MISSING',
          error: err.message
        };
        missingTables.push(tableName);
      }
    }
  }

  const summary = {
    totalTables: Object.values(allTables).flat().length,
    existingCount: existingTables.length,
    missingCount: missingTables.length,
    existingTables: existingTables.sort(),
    missingTables: missingTables.sort()
  };

  return NextResponse.json({
    success: true,
    summary,
    details: results
  });
}
