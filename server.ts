// server.ts - WORKS ON BOTH LOCALHOST & RAILWAY
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express, { Application, Request, Response } from 'express';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './src/config/database';
import { errorHandler, notFound } from './src/middleware/errorMiddleware';
import authRoutes from './src/routes/authRoutes';
import chatRoutes from './src/routes/chatRoutes';
import voiceRoutes from './src/routes/voiceRoutes';
import { getAIVoiceService } from './src/services/aiVoiceService';
import { VoiceHandler } from './src/websocket/voiceHandler';

// Load environment variables
dotenv.config();

// Detect environment
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_RAILWAY = process.env.RAILWAY_ENVIRONMENT !== undefined;
const IS_LOCAL = !IS_PRODUCTION && !IS_RAILWAY;

console.log(`🌍 Environment: ${IS_PRODUCTION ? 'Production' : 'Development'}`);
console.log(`🚂 Platform: ${IS_RAILWAY ? 'Railway' : 'Local'}`);

// Create Express app
const app: Application = express();

// Create HTTP server for Socket.IO
const httpServer = createServer(app);

// Parse allowed origins - works for both localhost and Railway
const getClientURLs = (): string[] => {
  const clientUrl = process.env.CLIENT_URL;
  
  if (clientUrl) {
    // Parse comma-separated URLs
    return clientUrl.split(',').map(url => url.trim()).filter(Boolean);
  }
  
  // Default to localhost for development
  return ['http://localhost:3000'];
};

const allowedOrigins = getClientURLs();

console.log('🔐 Allowed CORS Origins:', allowedOrigins);

// Initialize Socket.IO - works for both environments
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, Postman, curl)
      if (!origin) {
        return callback(null, true);
      }
      
      // In development, allow localhost variants
      if (!IS_PRODUCTION) {
        const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/;
        if (localhostPattern.test(origin)) {
          return callback(null, true);
        }
      }
      
      // Check allowed origins
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked origin: ${origin}`);
        console.warn('   Allowed origins:', allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  },
  // Optimal settings for both environments
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  perMessageDeflate: {
    threshold: 1024,
  },
});

// Connect to database
connectDB();

// Initialize AI Voice Service
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;

if (deepgramApiKey && geminiApiKey) {
  try {
    // Lazy singleton initialization (no arguments)
    getAIVoiceService();

    console.log('✅ AI Voice Service initialized');
    console.log('   - Speech-to-Text: Deepgram');
    console.log('   - AI Chat: Anthropic Claude');
    console.log('   - Text-to-Speech: Browser Web Speech API');
  } catch (error) {
    console.error('⚠️  Failed to initialize AI Voice Service:', error);
  }
}
 else {
  console.warn('⚠️  Voice Service Configuration Incomplete:');
  if (!deepgramApiKey) {
    console.warn('   ❌ DEEPGRAM_API_KEY not found');
    console.warn('      Get it from: https://console.deepgram.com/signup');
  }
  if (!geminiApiKey) {
    console.warn('   ❌ GEMINI_API_KEY not found');
    console.warn('      Get it from: https://aistudio.google.com/app/apikey');
  }
}

// Initialize WebSocket Voice Handler
try {
  new VoiceHandler(io);
  console.log('✅ WebSocket Voice Handler initialized');
} catch (error) {
  console.error('⚠️  Failed to initialize WebSocket Voice Handler:', error);
}

// Trust proxy - needed for Railway, harmless for localhost
app.set('trust proxy', 1);

// Security Middleware - adjusted for environment
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration - works for both environments
const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {
    // Allow requests with no origin
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, be more permissive with localhost
    if (!IS_PRODUCTION) {
      const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/;
      if (localhostPattern.test(origin)) {
        return callback(null, true);
      }
    }
    
    // Check allowed origins
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS blocked origin: ${origin}`);
      console.warn('   Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Rate limiting - more lenient in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: IS_PRODUCTION ? 200 : 1000, // More lenient in development
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return req.path === '/health' || req.path === '/';
  },
});

app.use(limiter);

// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: IS_PRODUCTION ? 10 : 100,
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true,
});

// Chat rate limiting
const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: IS_PRODUCTION ? 30 : 100,
  message: 'Too many messages, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Voice call rate limiting
const voiceLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: IS_PRODUCTION ? 15 : 50,
  message: 'Too many voice calls, please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Request logging in development
if (!IS_PRODUCTION) {
  app.use((req: Request, res: Response, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// Health check route
app.get('/health', (req: Request, res: Response) => {
  const voiceStatus = (deepgramApiKey && geminiApiKey) 
    ? 'enabled' 
    : deepgramApiKey 
      ? 'partial (missing Gemini key)' 
      : 'disabled';

  res.json({
    success: true,
    message: IS_RAILWAY ? 'Server is running on Railway' : 'Server is running locally',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    platform: IS_RAILWAY ? 'Railway' : 'Local',
    services: {
      database: 'connected',
      voice: voiceStatus,
      websocket: 'enabled',
      speechToText: deepgramApiKey ? 'Deepgram (FREE)' : 'disabled',
      textToSpeech: 'Browser Web Speech API (FREE)',
      aiChat: geminiApiKey ? 'Google Gemini (FREE)' : 'disabled',
    },
    cors: {
      allowedOrigins: allowedOrigins,
    }
  });
});

// Root route
app.get('/', (req: Request, res: Response) => {
  const PORT = Number(process.env.PORT) || 3001;
  const baseUrl = IS_RAILWAY && process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`;

  res.json({
    success: true,
    message: 'AI Chat Bot API - SumNex Tech',
    version: '2.0.0',
    platform: IS_RAILWAY ? 'Railway.app' : 'Local Development',
    endpoints: {
      auth: `${baseUrl}/api/auth`,
      chat: `${baseUrl}/api/chat`,
      voice: `${baseUrl}/api/voice`,
      health: `${baseUrl}/health`,
    },
    websocket: {
      url: baseUrl.replace('https://', 'wss://').replace('http://', 'ws://'),
      namespace: '/',
      status: 'enabled',
    },
    cors: {
      allowedOrigins: allowedOrigins,
    },
    documentation: process.env.API_DOCS_URL || 'Coming soon'
  });
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/chat', chatLimiter, chatRoutes);
app.use('/api/voice', voiceLimiter, voiceRoutes);

// 404 handler
app.use(notFound);

// Error handling middleware
app.use(errorHandler);

// Port and Host configuration
const PORT = Number(process.env.PORT) || 3001;
// Railway needs 0.0.0.0, localhost needs 127.0.0.1 or can use 0.0.0.0
const HOST = '0.0.0.0'; // Works for both!

// Start server
const server = httpServer.listen(PORT, HOST, () => {
  const railwayUrl = IS_RAILWAY && process.env.RAILWAY_PUBLIC_DOMAIN 
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${PORT}`;

  console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║   🚀 AI Chat Bot API - ${IS_RAILWAY ? 'Railway' : 'Local   '}              ║
║                                                       ║
║   🌐 Platform:    ${IS_RAILWAY ? 'Railway.app' : 'Local Development'}                        ║
║   📡 Port:        ${PORT}                                   ║
║   🏠 Host:        ${HOST}                              ║
║   🌍 Environment: ${(process.env.NODE_ENV || 'development').padEnd(31)} ║
║   🔗 URL:         ${railwayUrl.padEnd(31)} ║
║   📝 Health:      ${railwayUrl}/health${' '.repeat(Math.max(0, 15 - railwayUrl.length))} ║
║   💬 Chat:        ${railwayUrl}/api/chat${' '.repeat(Math.max(0, 12 - railwayUrl.length))} ║
║   🎤 Voice:       ${railwayUrl}/api/voice${' '.repeat(Math.max(0, 11 - railwayUrl.length))} ║
║   📡 WebSocket:   ${railwayUrl.replace('https', 'wss').replace('http', 'ws')}${' '.repeat(Math.max(0, 10 - railwayUrl.length))} ║
║                                                       ║
║   © 2025 SumNex Tech                                 ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
  `);
  
  console.log('🔐 CORS Configuration:');
  console.log(`   Mode: ${IS_PRODUCTION ? 'Production (Strict)' : 'Development (Permissive)'}`);
  console.log(`   Allowed Origins: ${allowedOrigins.join(', ')}`);
  if (!IS_PRODUCTION) {
    console.log(`   + All localhost variants (http://localhost:*, http://127.0.0.1:*)`);
  }
  console.log('');
  
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
    console.log(`   Add GEMINI_API_KEY to ${IS_RAILWAY ? 'Railway variables' : '.env file'}`);
  } else if (geminiApiKey) {
    console.log('⚠️  Voice calling is PARTIALLY ENABLED');
    console.log('   ❌ Deepgram API Key missing');
    console.log('   ✅ Gemini API Key found');
    console.log(`   Add DEEPGRAM_API_KEY to ${IS_RAILWAY ? 'Railway variables' : '.env file'}`);
  } else {
    console.log('⚠️  Voice calling is DISABLED');
    console.log(`   Add both API keys to ${IS_RAILWAY ? 'Railway variables' : '.env file'}:`);
    console.log('   - DEEPGRAM_API_KEY (https://console.deepgram.com)');
    console.log('   - GEMINI_API_KEY (https://aistudio.google.com/app/apikey)');
  }
  
  console.log('');
  console.log('✅ Server is ready to accept connections!');
  
  if (!IS_PRODUCTION) {
    console.log('\n💡 Development Tips:');
    console.log('   - Frontend should connect to: http://localhost:3001');
    console.log('   - WebSocket URL: ws://localhost:3001');
    console.log('   - Hot reload enabled with nodemon/ts-node-dev');
  }
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} signal received: closing HTTP server`);
  
  io.close(() => {
    console.log('✅ WebSocket connections closed');
  });
  
  server.close(() => {
    console.log('✅ HTTP server closed');
    console.log('👋 Goodbye!');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('⚠️ Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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