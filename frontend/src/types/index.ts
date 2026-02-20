export type Level = 'A' | 'B' | 'C';
export type ConversationMode = 'practice' | 'exam';

export interface Question {
  text: string;
  followUps?: string[];
}

export interface Theme {
  id: string;
  title: string;
  description: string;
  level: Level;
  questions: Question[];
}

export interface ExamQuestion {
  id: string;
  text: string;
  difficulty: Level;
  source: 'generated' | 'theme-inspired';
}

export interface ExamRunningAssessment {
  at: number;
  difficulty: Level;
  questionId: string;
  summary: string;
  strengths: string[];
  improvements: string[];
}

export interface ExamSession {
  questionsByDifficulty: Record<Level, ExamQuestion[]>;
  targetQuestionCountByDifficulty: Record<Level, number>;
  askedTurnCountByDifficulty?: Record<Level, number>;
  followUpCountForActive?: number;
  maxFollowUpsPerQuestion?: number;
  focusTheme?: {
    id: string;
    title: string;
    description: string;
  };
  askedQuestionIds: string[];
  activeQuestionId?: string;
  followUpAskedForActive?: boolean;
  currentDifficulty: Level;
  completed: boolean;
  runningAssessments: ExamRunningAssessment[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audio?: boolean;
}

export interface Conversation {
  id: string;
  themeId: string;
  startTime: number;
  endTime?: number;
  messages: ConversationMessage[];
  evaluation?: ConversationEvaluation;
  analysis?: ConversationAnalysis;
  voice?: string;
  mode?: ConversationMode;
  examSession?: ExamSession;
}

export type AnalysisSeverity = 'low' | 'medium' | 'high';

export type AnalysisCategory =
  | 'grammar'
  | 'spelling'
  | 'wording'
  | 'clarity'
  | 'tone'
  | 'structure'
  | 'consistency'
  | 'other';

export interface AnalysisIssue {
  category: AnalysisCategory;
  severity: AnalysisSeverity;
  description: string;
  suggestion: string;
}

export interface MessageAnalysis {
  messageTimestamp: number;
  summary: string;
  issues: AnalysisIssue[];
  improvedExample?: string;
  analyzedAt: number;
}

export interface ConversationAnalysis {
  messageAnalyses: MessageAnalysis[];
  lastAnalyzedAt?: number;
}

export interface ConversationEvaluation {
  score?: number;
  overallLevel?: Level;
  levelRationale?: Record<Level, string>;
  criteria: {
    [key: string]: {
      score?: number;
      notes?: string;
    };
  };
  notes?: string;
  recommendations?: string[];
}
