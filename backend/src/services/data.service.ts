import fs from 'fs';
import path from 'path';
import { Theme, Conversation, Level } from '../types';

const DATA_DIR = path.join(__dirname, '../data');
const THEMES_FILE = path.join(DATA_DIR, 'themes.json');
const CONVERSATIONS_FILE = path.join(DATA_DIR, 'conversations.json');

export class DataService {
  private static readonly EXAM_THEME_ID = 'exam-mode';

  static getExamTheme(): Theme {
    return {
      id: this.EXAM_THEME_ID,
      title: 'Mode examen oral (A → C)',
      description: 'Examen progressif du niveau A au niveau C avec évaluation finale et recommandations.',
      level: 'C',
      questions: []
    };
  }

  private static ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  static getThemes(level?: Level): Theme[] {
    try {
      const data = fs.readFileSync(THEMES_FILE, 'utf-8');
      const themes: Theme[] = JSON.parse(data);
      const themesWithExam = [...themes, this.getExamTheme()];

      if (level) {
        return themesWithExam.filter(theme => theme.level === level);
      }

      return themesWithExam;
    } catch (error) {
      console.error('Error reading themes:', error);
      return [];
    }
  }

  static getThemeById(id: string): Theme | undefined {
    if (id === this.EXAM_THEME_ID) {
      return this.getExamTheme();
    }

    const themes = this.getThemes();
    const theme = themes.find(theme => theme.id === id);

    // Randomize question order for level C themes
    if (theme && theme.level === 'C') {
      const shuffledTheme = { ...theme };
      shuffledTheme.questions = this.shuffleArray([...theme.questions]);
      return shuffledTheme;
    }

    return theme;
  }

  private static shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
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

  static deleteConversation(id: string): void {
    this.ensureDataDir();
    const conversations = this.getConversations();
    const filtered = conversations.filter(c => c.id !== id);
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(filtered, null, 2));
  }

  static deleteEmptyConversations(): number {
    this.ensureDataDir();
    const conversations = this.getConversations();
    const filtered = conversations.filter(c => (c.messages?.length || 0) > 0);
    const removed = conversations.length - filtered.length;
    fs.writeFileSync(CONVERSATIONS_FILE, JSON.stringify(filtered, null, 2));
    return removed;
  }

  static getConversationById(id: string): Conversation | undefined {
    const conversations = this.getConversations();
    return conversations.find(c => c.id === id);
  }
}
