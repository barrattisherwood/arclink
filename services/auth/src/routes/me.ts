import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/me', requireAuth, (req: Request, res: Response): void => {
  res.json(req.user);
});

export default router;
