import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router();

// Only super-admin can create new users
router.post('/register', requireSuperAdmin, async (req: Request, res: Response): Promise<void> => {
  const { email, password, role, siteId } = req.body;

  if (!email || !password || !role || !siteId) {
    res.status(400).json({ error: 'email, password, role and siteId required' });
    return;
  }

  if (!['super-admin', 'client'].includes(role)) {
    res.status(400).json({ error: 'role must be super-admin or client' });
    return;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    res.status(409).json({ error: 'User already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash, role, siteId });

  res.status(201).json({ userId: user._id, email: user.email, role: user.role, siteId: user.siteId });
});

export default router;
