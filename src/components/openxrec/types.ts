export interface RecommendationItem {
  id: string;
  title: string;
  type: string;
  description: string;
  score: number;
  confidence: number;
  explanation: string;
  factors: Array<{
    name: string;
    value: string;
    importance: number;
  }>;
  metadata?: {
    isComparisonAnalysis?: boolean;
    entities?: Array<{
      name: string;
      pros: string[];
      cons: string[];
    }>;
    conclusion?: {
      summary?: string;
      recommendation?: string;
    };
    sources?: Array<{
      title: string;
      url?: string;
      snippet?: string;
    }>;
  };
  source?: string;
  sourceUrl?: string;
}

export interface ClarificationQuestion {
  id: string;
  question: string;
  type: 'single_choice' | 'multiple_choice' | 'text' | 'range';
  options?: string[];
  placeholder?: string;
  required: boolean;
  priority: 'high' | 'medium' | 'low';
  fieldId?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  recommendations?: RecommendationItem[];
  explanation?: string;
  clarification?: {
    needsClarification: boolean;
    questions: ClarificationQuestion[];
    missingFields: string[];
    progress: number;
  };
  recommendationType?: 'comparison' | 'ranking' | 'single' | 'clarification' | 'comparison_analysis';
  responseMeta?: {
    cacheHit?: boolean;
    cacheType?: string;
    reusedCaseId?: string;
    similarity?: number;
    [key: string]: any;
  };
}

export interface RankingItem extends RecommendationItem {
  rank?: number;
  overallScore?: number;
  scores?: {
    name: string;
    score: number;
    weight: number;
    description?: string;
  }[];
  advantages?: string[];
  disadvantages?: string[];
}

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string;
}

export const VECTOR_REUSE_RECOMPUTE_THRESHOLD = 0.94;

export const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export const quickExamples = [
  '我想找一些关于推荐系统的学习资料',
  '帮我推荐一些数据可视化工具',
  '最近对机器学习很感兴趣，有什么好的入门资源？',
  '我们公司需要选择一个合适的数据分析平台',
];
