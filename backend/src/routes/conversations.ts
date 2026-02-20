import { Router } from 'express';
import { DataService } from '../services/data.service';
import { Conversation } from '../types';
import crypto from 'crypto';
import { AnalysisService } from '../services/analysis.service';
import OpenAI from 'openai';
import { ExamService } from '../services/exam.service';

const router = Router();

router.get('/', (req, res) => {
  try {
    const conversations = DataService.getConversations();
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const conversation = DataService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

router.post('/', (req, res) => {
  try {
    const { themeId } = req.body;

    if (!themeId) {
      return res.status(400).json({ error: 'Theme ID is required' });
    }

    const theme = DataService.getThemeById(themeId);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }

    const conversation: Conversation = {
      id: crypto.randomUUID(),
      themeId,
      startTime: Date.now(),
      messages: [],
      mode: themeId === 'exam-mode' ? 'exam' : 'practice'
    };

    DataService.saveConversation(conversation);
    res.status(201).json(conversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

router.put('/:id', (req, res) => {
  try {
    const conversation = DataService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const updatedConversation = {
      ...conversation,
      ...req.body,
      id: req.params.id // Ensure ID cannot be changed
    };

    DataService.saveConversation(updatedConversation);
    res.json(updatedConversation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

router.post('/:id/analyze', async (req, res) => {
  try {
    const { messageTimestamp, apiKey } = req.body;

    if (!messageTimestamp || !apiKey) {
      return res.status(400).json({ error: 'messageTimestamp and apiKey are required' });
    }

    const timestamp = Number(messageTimestamp);
    if (Number.isNaN(timestamp)) {
      return res.status(400).json({ error: 'messageTimestamp must be a number' });
    }

    const analysis = await AnalysisService.analyzeUserMessage(
      req.params.id,
      timestamp,
      apiKey
    );

    res.json(analysis);
  } catch (error) {
    console.error('Conversation analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze message' });
  }
});

router.post('/:id/evaluate', async (req, res) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ error: 'apiKey is required' });
    }

    const conversation = DataService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (!ExamService.isExamConversation(conversation)) {
      return res.status(400).json({ error: 'Evaluation endpoint is only available for exam conversations' });
    }

    const client = new OpenAI({ apiKey });
    const evaluation = await ExamService.evaluateExamConversation(conversation, client);

    res.json(evaluation);
  } catch (error) {
    console.error('Conversation evaluation error:', error);
    res.status(500).json({ error: 'Failed to evaluate conversation' });
  }
});

router.delete('/empty', (req, res) => {
  try {
    const removed = DataService.deleteEmptyConversations();
    res.json({ removed });
  } catch (error) {
    console.error('Failed to delete empty conversations:', error);
    res.status(500).json({ error: 'Failed to delete empty conversations' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const conversation = DataService.getConversationById(req.params.id);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    DataService.deleteConversation(req.params.id);
    res.json({ deleted: true });
  } catch (error) {
    console.error('Failed to delete conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

export default router;
