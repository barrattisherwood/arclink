import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' });
    return;
  }

  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = jwt.sign(
    { userId: user._id, siteId: user.siteId, role: user.role, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as jwt.SignOptions['expiresIn'] }
  );

  res.json({ token, role: user.role, siteId: user.siteId });
});

export default router;
