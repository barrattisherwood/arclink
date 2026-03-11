import { Router, Request, Response } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth';
import { uploadToR2 } from '../services/r2';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// POST /upload/:siteId — single file upload
router.post('/', requireAuth, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'No file provided' });
    return;
  }

  const url = await uploadToR2(
    req.params.siteId,
    req.file.originalname,
    req.file.buffer,
    req.file.mimetype
  );

  res.status(201).json({ url });
});

// POST /upload/:siteId/batch — multiple file upload
router.post('/batch', requireAuth, upload.array('files', 20), async (req: Request, res: Response): Promise<void> => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    res.status(400).json({ error: 'No files provided' });
    return;
  }

  const urls = await Promise.all(
    files.map((file) =>
      uploadToR2(req.params.siteId, file.originalname, file.buffer, file.mimetype)
    )
  );

  res.status(201).json({ urls });
});

export default router;
