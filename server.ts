// server.ts - UPDATED VERSION WITH DEEPGRAM VOICE CALLING
import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/database';
import authRoutes from './src/routes/authRoutes';
import chatRoutes from './src/routes/chatRoutes';
import voiceRoutes from './src/routes/voiceRoutes';
import { errorHandler, notFound } from './src/middleware/errorMiddleware';
import { getAIVoiceService } from './src/services/aiVoiceService';
import { VoiceHandler } from './src/websocket/voiceHandler';

// Load environment variables
dotenv.config();

// Create Express app
const app: Application = express();

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Initialize Socket.IO
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',') 
  : ['http://localhost:3000'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Connect to database
connectDB();

// Initialize AI Voice Service with Deepgram and Gemini (100% FREE)
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (deepgramApiKey && geminiApiKey) {
  try {
    getAIVoiceService(deepgramApiKey, geminiApiKey);
    console.log('✅ AI Voice Service initialized (100% FREE!)');
    console.log('   - Speech-to-Text: Deepgram (FREE - 45,000 min/month)');
    console.log('   - AI Chat: Google Gemini (FREE - 60 requests/min)');
    console.log('   - Text-to-Speech: Browser Web Speech API (FREE)');
  } catch (error) {
    console.error('⚠️  Failed to initialize AI Voice Service:', error);
  }
} else {
  console.warn('⚠️  Voice Service Configuration Incomplete:');
  if (!deepgramApiKey) {
    console.warn('   ❌ DEEPGRAM_API_KEY not found');
    console.warn('      Get it from: https://console.deepgram.com/signup');
  }
  if (!geminiApiKey) {
    console.warn('   ❌ GEMINI_API_KEY not found');
    console.warn('      Get it from: https://aistudio.google.com/app/apikey');
  }
  console.warn('   Voice features will not work until both keys are added to .env');
}

// Initialize WebSocket Voice Handler
try {
  new VoiceHandler(io);
} catch (error) {
  console.error('⚠️  Failed to initialize WebSocket Voice Handler:', error);
}

// Trust proxy (important for rate limiting behind reverse proxies like Nginx)
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet()); // Set security HTTP headers

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' })); // Limit payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to all routes
app.use(limiter);

// Stricter rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Only 5 login/signup attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Chat rate limiting (more lenient than auth)
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 messages per minute
  message: 'Too many messages, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Voice call rate limiting
const voiceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 voice calls per minute
  message: 'Too many voice calls, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req: Request, res: Response, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// Health check route (should be before rate limiting for monitoring)
app.get('/health', (req: Request, res: Response) => {
  const voiceStatus = (deepgramApiKey && geminiApiKey) 
    ? 'enabled' 
    : deepgramApiKey 
      ? 'partial (missing Gemini key)' 
      : 'disabled';

  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      database: 'connected',
      voice: voiceStatus,
      websocket: 'enabled',
      speechToText: deepgramApiKey ? 'Deepgram (FREE)' : 'disabled',
      textToSpeech: 'Browser Web Speech API (FREE)',
      aiChat: geminiApiKey ? 'Google Gemini (FREE)' : 'disabled',
    }
  });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'AI Chat Bot API - SumNex Tech',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      chat: '/api/chat',
      voice: '/api/voice',
      health: '/health'
    },
    websocket: {
      url: `ws://localhost:${process.env.PORT || 3001}`,
      namespace: '/',
    },
    documentation: process.env.API_DOCS_URL || 'Coming soon'
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/voice', voiceLimiter, voiceRoutes);

// 404 handler (must be after all routes)
app.use(notFound);

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3001;
const server = httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 AI Chat Bot API - Server Started                ║
║                                                       ║
║   📡 Port:        ${PORT}                           ║
║   🌍 Environment: ${process.env.NODE_ENV || 'development'}                    ║
║   🔗 URL:         http://localhost:${PORT}          ║
║   📝 Health:      http://localhost:${PORT}/health   ║
║   💬 Chat:        http://localhost:${PORT}/api/chat ║
║   🎤 Voice:       http://localhost:${PORT}/api/voice║
║   📡 WebSocket:   ws://localhost:${PORT}            ║
║                                                       ║
║   © 2025 SumNex Tech                                 ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  if (deepgramApiKey && geminiApiKey) {
    console.log('🎤 Voice calling is 100% FREE & ENABLED!');
    console.log('   ✅ Speech-to-Text: Deepgram (FREE - 45,000 min/month)');
    console.log('   ✅ AI Chat: Google Gemini (FREE - 60 req/min)');
    console.log('   ✅ Text-to-Speech: Browser Web Speech API (FREE)');
    console.log('   💡 No credit card required for any service!');
  } else if (deepgramApiKey) {
    console.log('⚠️  Voice calling is PARTIALLY ENABLED');
    console.log('   ✅ Deepgram API Key found');
    console.log('   ❌ Gemini API Key missing');
    console.log('   Add GEMINI_API_KEY to .env for full voice support');
  } else if (geminiApiKey) {
    console.log('⚠️  Voice calling is PARTIALLY ENABLED');
    console.log('   ❌ Deepgram API Key missing');
    console.log('   ✅ Gemini API Key found');
    console.log('   Add DEEPGRAM_API_KEY to .env for full voice support');
  } else {
    console.log('⚠️  Voice calling is DISABLED');
    console.log('   Add both API keys to .env:');
    console.log('   - DEEPGRAM_API_KEY (https://console.deepgram.com)');
    console.log('   - GEMINI_API_KEY (https://aistudio.google.com/app/apikey)');
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} signal received: closing HTTP server`);
  
  // Close Socket.IO connections
  io.close(() => {
    console.log('✅ WebSocket connections closed');
  });
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Handle different termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.log('❌ UNHANDLED REJECTION! Shutting down...');
  console.log('Error name:', err.name);
  console.log('Error message:', err.message);
  if (err.stack) {
    console.log('Stack trace:', err.stack);
  }
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err: Error) => {
  console.log('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.log('Error name:', err.name);
  console.log('Error message:', err.message);
  if (err.stack) {
    console.log('Stack trace:', err.stack);
  }
  
  process.exit(1);
});

export default app;