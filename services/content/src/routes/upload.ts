import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { uploadImage } from '../services/cloudinary';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /upload/:siteId — single file upload
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const folder = `content/${req.params.siteId}`;
  const result = await uploadImage(req.file.buffer, folder);

  res.status(201).json(result);
});

// POST /upload/:siteId/batch — multiple file upload
router.post('/batch', requireAuth, upload.array('files', 20), async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }

  const folder = `content/${req.params.siteId}`;
  const results = await Promise.all(
    files.map((file) => uploadImage(file.buffer, folder))
  );

  res.status(201).json({ images: results });
});

export default router;
