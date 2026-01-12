import fs from 'fs';
import path from 'path';
import { Theme, Conversation, Level } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const THEMES_FILE = path.join(DATA_DIR, 'themes.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

export class DataService {
  private static ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  static getThemes(level?: Level): Theme[] {
    try {
      const data = fs.readFileSync(THEMES_FILE, 'utf-8');
      const themes: Theme[] = JSON.parse(data);
      
      if (level) {
        return themes.filter(theme => theme.level === level);
      }
      
      return themes;
    } catch (error) {
      console.error('Error reading themes:', error);
      return [];
    }
  }

  static getThemeById(id: string): Theme | undefined {
    const themes = this.getThemes();
    return themes.find(theme => theme.id === id);
  }

  static getThemesByLevel(level: Level): Theme[] {
    return this.getThemes(level);
  }

  static getConversations(): Conversation[] {
    this.ensureDataDir();
    try {
      if (!fs.existsSync(CONVERSATIONS_FILE)) {
        return [];
      }
      const data = fs.readFileSync(CONVERSATIONS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading conversations:', error);
      return [];
    }
  }

  static saveConversation(conversation: Conversation): void {
    this.ensureDataDir();
    const conversations = this.getConversations();
    const index = conversations.findIndex(c => c.id === conversation.id);
    
    if (index >= 0) {
      conversations[index] = conversation;
    } else {
      conversations.push(conversation);
    }

    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(conversations, null, 2));
  }

  static getConversationById(id: string): Conversation | undefined {
    const conversations = this.getConversations();
    return conversations.find(c => c.id === id);
  }
}
