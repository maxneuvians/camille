import { Router } from 'express';
import { DataService } from '../services/data.service';
import { Conversation } from '../types';
import crypto from 'crypto';

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
    const { themeId, isWarmup } = req.body;
    
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
      isWarmup: isWarmup || false
    };

    // Only save non-warmup conversations
    if (!isWarmup) {
      DataService.saveConversation(conversation);
    }
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

export default router;
