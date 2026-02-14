import type { Theme, Conversation, Level, MessageAnalysis } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export const api = {
  async getThemes(level?: Level): Promise<Theme[]> {
    const url = level ? `${API_BASE}/themes?level=${level}` : `${API_BASE}/themes`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch themes');
    return response.json();
  },

  async getTheme(id: string): Promise<Theme> {
    const response = await fetch(`${API_BASE}/themes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch theme');
    return response.json();
  },

  async getThemesByLevel(level: Level): Promise<Theme[]> {
    return this.getThemes(level);
  },

  async getConversations(): Promise<Conversation[]> {
    const response = await fetch(`${API_BASE}/conversations`);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE}/conversations/${id}`);
    if (!response.ok) throw new Error('Failed to fetch conversation');
    return response.json();
  },

  async createConversation(themeId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId })
    });
    if (!response.ok) throw new Error('Failed to create conversation');
    return response.json();
  },

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) throw new Error('Failed to update conversation');
    return response.json();
  },

  async analyzeMessage(
    conversationId: string,
    messageTimestamp: number,
    apiKey: string
  ): Promise<MessageAnalysis> {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageTimestamp, apiKey })
    });

    if (!response.ok) throw new Error('Failed to analyze message');
    return response.json();
  },

  async deleteEmptyConversations(): Promise<{ removed: number }> {
    const response = await fetch(`${API_BASE}/conversations/empty`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete empty conversations');
    return response.json();
  },

  async deleteConversation(id: string): Promise<{ deleted: boolean }> {
    const response = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete conversation');
    return response.json();
  }
};
