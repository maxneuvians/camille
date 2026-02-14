export type Level = 'A' | 'B' | 'C';

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
  criteria: {
    [key: string]: {
      score?: number;
      notes?: string;
    };
  };
  notes?: string;
}
