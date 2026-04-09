/**
 * 可观测性状态管理 Hook
 * 
 * 功能：
 * 1. 提取可观测性指标
 * 2. 定时更新机制
 * 3. 异常触发重分析
 * 4. 历史趋势记录
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Observable, SearchItem } from '@/lib/graph/types';
import { extractObservables } from '@/lib/graph/extractors/observables';

// 导出 Observable 类型供外部使用
export type { Observable } from '@/lib/graph/types';

export interface ObservabilitySnapshot {
  timestamp: number;
  observables: Observable[];
  status: 'normal' | 'warning' | 'danger';
  topic?: string;
}

export interface ObservabilityState {
  current: ObservabilitySnapshot | null;
  history: ObservabilitySnapshot[];
  isMonitoring: boolean;
  lastUpdate: number | null;
  updateCount: number;
}

export interface UseObservabilityOptions {
  topic: string;
  searchResults: SearchItem[];
  autoStart?: boolean;
  updateInterval?: number; // 更新间隔（毫秒），默认 1 小时
  maxHistory?: number; // 最大历史记录数，默认 24 条
  onAnomaly?: (snapshot: ObservabilitySnapshot) => void; // 异常回调
}

/**
 * 判断整体状态
 */
function determineStatus(observables: Observable[]): 'normal' | 'warning' | 'danger' {
  const dangerCount = observables.filter(o => o.status === '危险').length;
  const warningCount = observables.filter(o => o.status === '警告').length;
  
  if (dangerCount > 0) return 'danger';
  if (warningCount >= 2) return 'warning';
  return 'normal';
}

export function useObservability(options: UseObservabilityOptions) {
  const {
    topic,
    searchResults,
    autoStart = false,
    updateInterval = 60 * 60 * 1000, // 默认 1 小时
    maxHistory = 24,
    onAnomaly
  } = options;

  const [state, setState] = useState<ObservabilityState>({
    current: null,
    history: [],
    isMonitoring: false,
    lastUpdate: null,
    updateCount: 0
  });

  // 使用 ref 存储最新值，避免闭包问题
  const searchResultsRef = useRef(searchResults);
  const onAnomalyRef = useRef(onAnomaly);
  const maxHistoryRef = useRef(maxHistory);
  const topicRef = useRef(topic);
  
  // 更新 ref
  useEffect(() => {
    searchResultsRef.current = searchResults;
  }, [searchResults]);
  
  useEffect(() => {
    onAnomalyRef.current = onAnomaly;
  }, [onAnomaly]);
  
  useEffect(() => {
    maxHistoryRef.current = maxHistory;
  }, [maxHistory]);
  
  useEffect(() => {
    topicRef.current = topic;
  }, [topic]);

  // 定时器引用
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // 是否已初始化的标记
  const initializedRef = useRef(false);

  /**
   * 创建快照（使用 ref 获取最新值）
   */
  const createSnapshot = useCallback((): ObservabilitySnapshot => {
    const currentResults = searchResultsRef.current;
    if (!currentResults || currentResults.length === 0) {
      return {
        timestamp: Date.now(),
        observables: [],
        status: 'normal',
        topic: topicRef.current
      };
    }
    
    const observables = extractObservables(currentResults);
    const status = determineStatus(observables);
    
    return {
      timestamp: Date.now(),
      observables,
      status,
      topic: topicRef.current
    };
  }, []); // 无依赖，使用 ref 获取最新值

  /**
   * 更新可观测性指标
   */
  const update = useCallback(() => {
    const snapshot = createSnapshot();
    
    setState(prev => {
      const newHistory = [snapshot, ...prev.history].slice(0, maxHistoryRef.current);
      
      return {
        ...prev,
        current: snapshot,
        history: newHistory,
        lastUpdate: Date.now(),
        updateCount: prev.updateCount + 1
      };
    });

    // 检测异常并触发回调
    if (snapshot.status !== 'normal' && onAnomalyRef.current) {
      onAnomalyRef.current(snapshot);
    }

    return snapshot;
  }, [createSnapshot]); // 只依赖 createSnapshot

  /**
   * 开始监控
   */
  const startMonitoring = useCallback(() => {
    setState(prev => {
      if (prev.isMonitoring) return prev;
      return { ...prev, isMonitoring: true };
    });
  }, []);

  /**
   * 停止监控
   */
  const stopMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setState(prev => ({ ...prev, isMonitoring: false }));
  }, []);

  /**
   * 手动刷新
   */
  const refresh = useCallback(() => {
    return update();
  }, [update]);

  /**
   * 清空历史
   */
  const clearHistory = useCallback(() => {
    setState(prev => ({
      ...prev,
      history: [],
      updateCount: 0
    }));
  }, []);

  /**
   * 获取趋势分析
   */
  const getTrendAnalysis = useCallback(() => {
    if (state.history.length < 2) {
      return null;
    }

    const recent = state.history.slice(0, 5);
    
    // 分析状态变化趋势
    const statusChanges = recent.map(s => s.status);
    const isDegrading = statusChanges.some((status, i) => {
      if (i === 0) return false;
      const prevStatus = statusChanges[i - 1];
      return (prevStatus === 'normal' && status !== 'normal') ||
             (prevStatus === 'warning' && status === 'danger');
    });

    // 分析各指标趋势
    const metricTrends: Record<string, string[]> = {};
    recent.forEach(snapshot => {
      snapshot.observables.forEach(obs => {
        if (!metricTrends[obs.label]) {
          metricTrends[obs.label] = [];
        }
        metricTrends[obs.label].push(obs.trend);
      });
    });

    return {
      isDegrading,
      statusChanges,
      metricTrends,
      recentSnapshots: recent
    };
  }, [state.history]);

  /**
   * 提取当前可观测性指标
   */
  const extractCurrentObservables = useCallback((): Observable[] => {
    const currentResults = searchResultsRef.current;
    if (!currentResults || currentResults.length === 0) {
      return [];
    }
    return extractObservables(currentResults);
  }, []);

  /**
   * 监控状态变化时启动/停止定时器
   */
  useEffect(() => {
    if (state.isMonitoring) {
      // 立即更新一次
      update();
      
      // 设置定时更新
      intervalRef.current = setInterval(update, updateInterval);
    } else {
      // 停止定时器
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [state.isMonitoring, updateInterval, update]);

  /**
   * 自动启动监控
   */
  useEffect(() => {
    if (autoStart && searchResults && searchResults.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      startMonitoring();
    }
  }, [autoStart, searchResults, startMonitoring]);

  return {
    // 状态
    ...state,
    
    // 操作方法
    startMonitoring,
    stopMonitoring,
    refresh,
    clearHistory,
    
    // 分析方法
    getTrendAnalysis,
    
    // 工具方法
    extractCurrentObservables
  };
}
