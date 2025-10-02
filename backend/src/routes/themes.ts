import { Router } from 'express';
import { DataService } from '../services/data.service';

const router = Router();

router.get('/', (req, res) => {
  try {
    const themes = DataService.getThemes();
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
