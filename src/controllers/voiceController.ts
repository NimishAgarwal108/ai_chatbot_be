// ============================================
// File: src/controllers/voiceController.ts
// HTTP Request Handlers for Voice API
// ============================================
import { Request, Response } from 'express';
import multer from 'multer';
import { getAIVoiceService } from '../services/aiVoiceService';

// Configure multer for memory storage
const storage = multer.memoryStorage();
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  },
});

// POST /api/voice/call - Full voice processing
export const handleVoiceCall = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const voice = req.body.voice || 'nova';
    const audioBuffer = req.file.buffer;

    // Get AI Voice Service
    const aiVoiceService = getAIVoiceService();

    // Process the voice call
    const result = await aiVoiceService.processVoiceCall(audioBuffer, voice);

    // Return audio as response
    res.set({
      'Content-Type': 'audio/mpeg',
      'X-Transcription': encodeURIComponent(result.text),
      'X-Response-Text': encodeURIComponent(result.response),
    });

    res.send(result.audioBuffer);
  } catch (error: any) {
    console.error('Voice call error:', error);
    res.status(500).json({
      error: 'Failed to process voice call',
      message: error.message,
    });
  }
};

// POST /api/voice/transcribe - Speech-to-text only
export const handleTranscribe = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const audioBuffer = req.file.buffer;
    const aiVoiceService = getAIVoiceService();

    const transcription = await aiVoiceService.transcribeAudio(audioBuffer);

    res.json({
      success: true,
      text: transcription,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: 'Failed to transcribe audio',
      message: error.message,
    });
  }
};

// POST /api/voice/speak - Text-to-speech only
export const handleSpeak = async (req: Request, res: Response) => {
  try {
    const { text, voice = 'nova' } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const aiVoiceService = getAIVoiceService();
    const audioBuffer = await aiVoiceService.synthesizeSpeech(text, voice);

    res.set({
      'Content-Type': 'audio/mpeg',
    });

    res.send(audioBuffer);
  } catch (error: any) {
    console.error('Speech synthesis error:', error);
    res.status(500).json({
      error: 'Failed to synthesize speech',
      message: error.message,
    });
  }
};

// GET /api/voice/history - Get conversation history
export const handleGetHistory = async (req: Request, res: Response) => {
  try {
    const aiVoiceService = getAIVoiceService();
    const history = aiVoiceService.getHistory();

    res.json({
      success: true,
      history: history,
      count: history.length,
    });
  } catch (error: any) {
    console.error('Get history error:', error);
    res.status(500).json({
      error: 'Failed to get conversation history',
      message: error.message,
    });
  }
};

// DELETE /api/voice/history - Clear conversation history
export const handleClearHistory = async (req: Request, res: Response) => {
  try {
    const aiVoiceService = getAIVoiceService();
    aiVoiceService.clearHistory();

    res.json({
      success: true,
      message: 'Conversation history cleared',
    });
  } catch (error: any) {
    console.error('Clear history error:', error);
    res.status(500).json({
      error: 'Failed to clear conversation history',
      message: error.message,
    });
  }
};