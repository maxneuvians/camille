import type { Theme, Conversation } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001/api';

export const api = {
  async getThemes(): Promise<Theme[]> {
    const response = await fetch(`${API_BASE}/themes`);
    if (!response.ok) throw new Error('Failed to fetch themes');
    return response.json();
  },

  async getTheme(id: string): Promise<Theme> {
    const response = await fetch(`${API_BASE}/themes/${id}`);
    if (!response.ok) throw new Error('Failed to fetch theme');
    return response.json();
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
  }
};
