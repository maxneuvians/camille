export interface Theme {
  id: string;
  title: string;
  description: string;
  questions: string[];
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
