/**
 * 动态配置 API
 *
 * 展示智能体驱动的配置学习和反馈循环机制
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ConfigurationAgent,
  FeedbackLoopManager,
  DEFAULT_DYNAMIC_CONFIGURATION,
  UserFeedback,
  DynamicConfiguration
} from '@/lib/recommendation/dynamic-config';
import { createLLMClient } from '@/lib/langgraph/nodes';

// 全局配置管理器（生产环境应该使用数据库）
const configAgents: Map<string, ConfigurationAgent> = new Map();
const feedbackLoopManagers: Map<string, FeedbackLoopManager> = new Map();

/**
 * 获取或创建配置智能体
 */
function getConfigurationAgent(userId: string): ConfigurationAgent {
  if (!configAgents.has(userId)) {
    const llmClient = createLLMClient();
    const agent = new ConfigurationAgent(llmClient, DEFAULT_DYNAMIC_CONFIGURATION);
    configAgents.set(userId, agent);
  }
  return configAgents.get(userId)!;
}

/**
 * 获取或创建反馈循环管理器
 */
function getFeedbackLoopManager(userId: string): FeedbackLoopManager {
  if (!feedbackLoopManagers.has(userId)) {
    const agent = getConfigurationAgent(userId);
    const manager = new FeedbackLoopManager(agent);
    feedbackLoopManagers.set(userId, manager);
  }
  return feedbackLoopManagers.get(userId)!;
}

/**
 * POST /api/recommendation/dynamic-config/feedback
 *
 * 收集用户反馈，触发配置学习
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      userId,
      action = 'collect',  // collect | analyze
      feedback = null,
      scenario = 'default'
    } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId 是必需的' },
        { status: 400 }
      );
    }

    const manager = getFeedbackLoopManager(userId);

    if (action === 'collect' && feedback) {
      // 收集反馈
      manager.collectFeedback(feedback as UserFeedback);

      const status = manager.getBufferStatus(userId);

      return NextResponse.json({
        success: true,
        message: '反馈已收集',
        status
      });
    } else if (action === 'analyze') {
      // 手动触发分析
      const result = await manager.manualTrigger(userId, scenario);
      const currentConfig = getConfigurationAgent(userId).getCurrentConfiguration();

      return NextResponse.json({
        success: true,
        ...result,
        currentConfig
      });
    } else {
      return NextResponse.json(
        { error: '无效的操作' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[Dynamic Config API] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/recommendation/dynamic-config?userId=xxx
 *
 * 获取当前配置和历史
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId 是必需的' },
        { status: 400 }
      );
    }

    const agent = getConfigurationAgent(userId);
    const manager = getFeedbackLoopManager(userId);

    const currentConfig = agent.getCurrentConfiguration();
    const performanceHistory = agent.getPerformanceHistory();
    const bufferStatus = manager.getBufferStatus(userId);

    return NextResponse.json({
      success: true,
      currentConfig,
      performanceHistory: performanceHistory.slice(-10), // 最近10次
      bufferStatus
    });
  } catch (error) {
    console.error('[Dynamic Config API] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/recommendation/dynamic-config?userId=xxx
 *
 * 清除缓冲区，回滚配置
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const version = searchParams.get('version');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId 是必需的' },
        { status: 400 }
      );
    }

    const agent = getConfigurationAgent(userId);
    const manager = getFeedbackLoopManager(userId);

    if (version) {
      // 回滚到指定版本
      const success = agent.rollbackConfiguration(parseInt(version));

      return NextResponse.json({
        success: success,
        message: success ? `已回滚到配置 v${version}` : '回滚失败',
        currentConfig: agent.getCurrentConfiguration()
      });
    } else {
      // 清除缓冲区
      manager.clearBuffer(userId);

      return NextResponse.json({
        success: true,
        message: '缓冲区已清除'
      });
    }
  } catch (error) {
    console.error('[Dynamic Config API] 错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
