import { Router } from 'express';
import { DataService } from '../services/data.service';
import { Level } from '../types';

const router = Router();

router.get('/', (req, res) => {
  try {
    const level = req.query.level as Level | undefined;
    
    // Validate level if provided
    if (level && !['A', 'B', 'C'].includes(level)) {
      return res.status(400).json({ error: 'Invalid level. Must be A, B, or C' });
    }
    
    const themes = DataService.getThemes(level);
    res.json(themes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch themes' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const theme = DataService.getThemeById(req.params.id);
    if (!theme) {
      return res.status(404).json({ error: 'Theme not found' });
    }
    res.json(theme);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch theme' });
  }
});

export default router;
