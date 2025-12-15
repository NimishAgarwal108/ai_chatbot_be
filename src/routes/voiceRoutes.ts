// ============================================
// File: src/routes/voiceRoutes.ts
// Voice API Routes
// ============================================
import { Router } from 'express';
import {
  handleVoiceCall,
  handleTranscribe,
  handleSpeak,
  handleGetHistory,
  handleClearHistory,
  upload,
} from '../controllers/voiceController';
import { protect } from '../middleware/authMiddleware'; // 👈 CHANGED

const router = Router();

// All voice routes require authentication
router.use(protect); // 👈 CHANGED from authenticateToken

// POST /api/voice/call - Full voice call (audio -> AI -> audio)
router.post('/call', upload.single('audio'), handleVoiceCall);

// POST /api/voice/transcribe - Speech-to-text only
router.post('/transcribe', upload.single('audio'), handleTranscribe);

// POST /api/voice/speak - Text-to-speech only
router.post('/speak', handleSpeak);

// GET /api/voice/history - Get conversation history
router.get('/history', handleGetHistory);

// DELETE /api/voice/history - Clear conversation history
router.delete('/history', handleClearHistory);

export default router;