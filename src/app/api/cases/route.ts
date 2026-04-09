/**
 * 案例管理 API
 * 
 * 支持的操作：
 * - GET: 获取案例列表或单个案例详情
 * - POST: 提交反馈、添加案例
 * - PUT: 更新案例
 * - DELETE: 删除案例
 */

import { NextRequest, NextResponse } from 'next/server';
import { caseMemoryStore, CaseFeedback, AnalysisCase } from '@/lib/langgraph/case-memory-store';
import { getKnowledgeAccumulator } from '@/lib/knowledge/knowledge-accumulator';
import { getSupabaseClient } from '@/storage/database/supabase-client';

// ==================== GET: 获取案例 ====================

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('id');
    const limit = parseInt(searchParams.get('limit') || '20');
    const minRating = searchParams.get('minRating') ? parseFloat(searchParams.get('minRating')!) : undefined;
    const domain = searchParams.get('domain') || undefined;
    
    const supabase = getSupabaseClient();
    
    // 获取单个案例
    if (caseId) {
      // 先从数据库查询
      if (supabase) {
        const { data: caseData, error } = await supabase
          .from('analysis_cases')
          .select('*')
          .eq('id', caseId)
          .maybeSingle();
        
        if (error) {
          console.error('[Cases API] 查询案例失败:', error);
        }
        
        if (caseData) {
          return NextResponse.json({
            success: true,
            data: { case: caseData }
          });
        }
      }
      
      // 回退到内存
      const memoryCase = caseMemoryStore.getCase(caseId);
      if (!memoryCase) {
        return NextResponse.json(
          { success: false, error: '案例不存在' },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        data: { case: memoryCase }
      });
    }
    
    // 获取案例列表
    let dbCases: any[] = [];
    
    if (supabase) {
      let query = supabase
        .from('analysis_cases')
        .select('id, query, domain, conclusion, tags, quality_score, user_rating, analyzed_at, created_at, agent_outputs, causal_chains, key_factors')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (domain) {
        query = query.eq('domain', domain);
      }
      if (minRating) {
        query = query.gte('user_rating', minRating);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('[Cases API] 查询案例列表失败:', error);
      } else {
        dbCases = data || [];
      }
    }
    
    // 获取统计数据
    const stats = caseMemoryStore.getStatistics();
    
    // 数据库统计
    let dbStats = { total: 0, avgRating: 0 };
    if (supabase) {
      const { count } = await supabase
        .from('analysis_cases')
        .select('*', { count: 'exact', head: true });
      dbStats.total = count || 0;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        cases: dbCases,
        stats: {
          totalCases: dbStats.total || stats.totalCases,
          averageRating: stats.avgRating,
          highQualityCases: Math.floor((dbStats.total || stats.totalCases) * (stats.accuracyRate || 0.5))
        }
      }
    });
    
  } catch (error) {
    console.error('[Cases API] GET error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== POST: 提交反馈 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, caseId, data } = body;
    
    switch (action) {
      case 'submit_feedback': {
        // 提交用户反馈
        const { rating, comments, adoptedConclusions, modifications, correction } = data;
        
        if (!caseId) {
          return NextResponse.json(
            { success: false, error: '缺少案例ID' },
            { status: 400 }
          );
        }
        
        // 更新数据库中的评分
        const supabase = getSupabaseClient();
        if (supabase && rating !== undefined) {
          const { error: updateError } = await supabase
            .from('analysis_cases')
            .update({ 
              user_rating: rating,
              updated_at: new Date().toISOString()
            })
            .eq('id', caseId);
          
          if (updateError) {
            console.error('[Cases API] 更新评分失败:', updateError);
          }
        }
        
        // 构建反馈对象
        const feedback: CaseFeedback = {
          userRating: rating,
          userComments: comments,
          adoptedConclusions,
          modifications
        };
        
        // 如果有修正内容，从中学习
        if (correction) {
          const accumulator = getKnowledgeAccumulator();
          await accumulator.learnFromFeedback({
            caseId,
            feedbackType: correction.type || 'correction',
            originalContent: correction.original,
            userCorrection: correction.corrected,
            reason: correction.reason
          });
        }
        
        return NextResponse.json({
          success: true,
          message: '反馈提交成功',
          data: {
            caseId,
            feedbackSubmitted: true
          }
        });
      }
      
      case 'verify_prediction': {
        // 验证预测结果
        const { scenarioName, actualOutcome, deviation, lessons } = data;
        
        if (!caseId) {
          return NextResponse.json(
            { success: false, error: '缺少案例ID' },
            { status: 400 }
          );
        }
        
        // 更新实际结果
        // 注意：当前实现中需要扩展 CaseMemoryStore 以支持验证更新
        
        // 从验证结果中学习
        if (lessons) {
          const accumulator = getKnowledgeAccumulator();
          await accumulator.learnFromFeedback({
            caseId,
            feedbackType: 'validation',
            originalContent: `预测：${scenarioName}`,
            userCorrection: `实际结果：${actualOutcome}。偏差：${deviation}。教训：${lessons}`,
            reason: '事后验证'
          });
        }
        
        return NextResponse.json({
          success: true,
          message: '预测验证已记录',
          data: {
            caseId,
            scenarioName,
            verifiedAt: new Date().toISOString()
          }
        });
      }
      
      case 'add_manual_case': {
        // 手动添加案例（专家知识输入）
        const { query, domain, scenario, conclusion, keyFactors, tags } = data;
        
        if (!query || !conclusion) {
          return NextResponse.json(
            { success: false, error: '主题和结论不能为空' },
            { status: 400 }
          );
        }
        
        // 创建新案例对象
        const caseId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const now = new Date().toISOString();
        
        const newCase = {
          id: caseId,
          query,
          domain: domain || 'general',
          conclusion: { summary: conclusion },
          final_report: conclusion,
          key_factors: keyFactors || [],
          tags: tags || [],
          timeline: [],
          causal_chains: [],
          scenarios: [],
          agent_outputs: { manual_entry: { conclusion } },
          confidence: 0.9,
          quality_score: 0.85,
          status: 'completed',
          analyzed_at: now,
          created_at: now,
        };
        
        // 保存到数据库
        const supabase = getSupabaseClient();
        if (supabase) {
          const { error: insertError } = await supabase
            .from('analysis_cases')
            .insert(newCase);
          
          if (insertError) {
            console.error('[Cases API] 保存案例失败:', insertError);
            return NextResponse.json(
              { success: false, error: '保存案例失败：' + insertError.message },
              { status: 500 }
            );
          }
        }
        
        // 从手动案例中提取知识
        try {
          const accumulator = getKnowledgeAccumulator();
          await accumulator.extractFromAnalysis({
            query,
            conclusion,
            keyFactors: keyFactors || [],
            causalChains: [],
            scenarios: []
          });
        } catch (extractError) {
          console.warn('[Cases API] 知识提取失败:', extractError);
          // 知识提取失败不影响案例保存
        }
        
        return NextResponse.json({
          success: true,
          message: '案例添加成功',
          data: {
            caseId,
            query,
            domain: newCase.domain,
            createdAt: now
          }
        });
      }
      
      default:
        return NextResponse.json(
          { success: false, error: '未知操作类型' },
          { status: 400 }
        );
    }
    
  } catch (error) {
    console.error('[Cases API] POST error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== PUT: 更新案例 ====================

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, data } = body;
    
    if (!caseId) {
      return NextResponse.json(
        { success: false, error: '缺少案例ID' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: '数据库连接不可用' },
        { status: 500 }
      );
    }
    
    // 准备更新数据
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };
    
    if (data.query !== undefined) updateData.query = data.query;
    if (data.domain !== undefined) updateData.domain = data.domain;
    if (data.conclusion !== undefined) updateData.conclusion = data.conclusion;
    if (data.final_report !== undefined) updateData.final_report = data.final_report;
    if (data.key_factors !== undefined) updateData.key_factors = data.key_factors;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.user_rating !== undefined) updateData.user_rating = data.user_rating;
    
    // 更新数据库
    const { error: updateError } = await supabase
      .from('analysis_cases')
      .update(updateData)
      .eq('id', caseId);
    
    if (updateError) {
      console.error('[Cases API] 更新案例失败:', updateError);
      return NextResponse.json(
        { success: false, error: '更新案例失败：' + updateError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '案例更新成功',
      data: { caseId }
    });
    
  } catch (error) {
    console.error('[Cases API] PUT error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

// ==================== DELETE: 删除案例 ====================

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const caseId = searchParams.get('id');
    
    if (!caseId) {
      return NextResponse.json(
        { success: false, error: '缺少案例ID' },
        { status: 400 }
      );
    }
    
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: '数据库连接不可用' },
        { status: 500 }
      );
    }
    
    // 删除案例
    const { error: deleteError } = await supabase
      .from('analysis_cases')
      .delete()
      .eq('id', caseId);
    
    if (deleteError) {
      console.error('[Cases API] 删除案例失败:', deleteError);
      return NextResponse.json(
        { success: false, error: '删除案例失败：' + deleteError.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '案例删除成功',
      data: { caseId }
    });
    
  } catch (error) {
    console.error('[Cases API] DELETE error:', error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
