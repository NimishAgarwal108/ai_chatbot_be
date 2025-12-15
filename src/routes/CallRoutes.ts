import { Router } from 'express';
import {
  startCall,
  endCall,
  addMessage,
  processAudio,
  processText,
  getCall,
  getCallHistory,
} from '../controllers/CallController';
import { protect } from '../middleware/authMiddleware';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validationMiddleware';
import multer from 'multer';

const router = Router();

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// Validation middleware
const startCallValidation = [
  body('callType')
    .optional()
    .isIn(['voice', 'video'])
    .withMessage('Call type must be either voice or video'),
  body('aiModel')
    .optional()
    .isString()
    .withMessage('AI model must be a string'),
  body('language')
    .optional()
    .isString()
    .withMessage('Language must be a string'),
  body('voiceSettings.voice')
    .optional()
    .isString()
    .withMessage('Voice must be a string'),
  body('voiceSettings.speed')
    .optional()
    .isFloat({ min: 0.5, max: 2.0 })
    .withMessage('Speed must be between 0.5 and 2.0'),
];

const addMessageValidation = [
  param('callId')
    .isUUID()
    .withMessage('Invalid call ID'),
  body('text')
    .notEmpty()
    .trim()
    .withMessage('Message text is required'),
  body('type')
    .optional()
    .isIn(['user', 'ai'])
    .withMessage('Type must be either user or ai'),
  body('audioUrl')
    .optional()
    .isURL()
    .withMessage('Audio URL must be valid'),
];

const processTextValidation = [
  param('callId')
    .isUUID()
    .withMessage('Invalid call ID'),
  body('text')
    .notEmpty()
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Text must be between 1 and 1000 characters'),
];

const callIdValidation = [
  param('callId')
    .isUUID()
    .withMessage('Invalid call ID'),
];

const historyValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('status')
    .optional()
    .isIn(['active', 'ended', 'failed'])
    .withMessage('Status must be active, ended, or failed'),
];

// Routes
// POST /api/calls - Start a new call
router.post(
  '/',
  protect,
  startCallValidation,
  validate,
  startCall
);

// POST /api/calls/:callId/end - End an active call
router.post(
  '/:callId/end',
  protect,
  callIdValidation,
  validate,
  endCall
);

// POST /api/calls/:callId/messages - Add a message to the call
router.post(
  '/:callId/messages',
  protect,
  addMessageValidation,
  validate,
  addMessage
);

// POST /api/calls/:callId/audio - Process audio and get AI response
router.post(
  '/:callId/audio',
  protect,
  upload.single('audio'),
  callIdValidation,
  validate,
  processAudio
);

// POST /api/calls/:callId/text - Process text message and get AI response
router.post(
  '/:callId/text',
  protect,
  processTextValidation,
  validate,
  processText
);

// GET /api/calls/:callId - Get call details
router.get(
  '/:callId',
  protect,
  callIdValidation,
  validate,
  getCall
);

// GET /api/calls - Get call history
router.get(
  '/',
  protect,
  historyValidation,
  validate,
  getCallHistory
);

export default router;