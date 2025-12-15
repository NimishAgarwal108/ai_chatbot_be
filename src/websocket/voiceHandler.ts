// ============================================
// File: src/websocket/voiceHandler.ts
// WebSocket Handler for Real-time Voice Streaming
// ============================================
import { Server, Socket } from 'socket.io';
import { getAIVoiceService } from '../services/aiVoiceService';
import jwt from 'jsonwebtoken';

export interface VoiceMessage {
  type: 'audio' | 'text' | 'control';
  data: string | Buffer;
  timestamp: number;
  voice?: string;
}

export class VoiceHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupMiddleware();
    this.setupHandlers();
  }

  // Middleware for authentication
  private setupMiddleware() {
    this.io.use((socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        (socket as any).user = decoded;
        next();
      } catch (error) {
        console.error('WebSocket auth error:', error);
        next(new Error('Invalid authentication token'));
      }
    });
  }

  // Setup WebSocket event handlers
  private setupHandlers() {
    this.io.on('connection', (socket: Socket) => {
      console.log(`Voice client connected: ${socket.id}`);
      const user = (socket as any).user;

      // Send welcome message
      socket.emit('voice:connected', {
        message: 'Connected to AI voice service',
        userId: user.id,
        timestamp: Date.now(),
      });

      // Handle incoming audio
      socket.on('voice:audio', async (message: VoiceMessage) => {
        try {
          await this.handleAudioMessage(socket, message);
        } catch (error) {
          console.error('Error handling audio:', error);
          socket.emit('voice:error', {
            error: 'Failed to process audio',
            timestamp: Date.now(),
          });
        }
      });

      // Handle text messages
      socket.on('voice:text', async (message: VoiceMessage) => {
        try {
          await this.handleTextMessage(socket, message);
        } catch (error) {
          console.error('Error handling text:', error);
          socket.emit('voice:error', {
            error: 'Failed to process text',
            timestamp: Date.now(),
          });
        }
      });

      // Handle control messages (start, stop, mute, etc.)
      socket.on('voice:control', (message: VoiceMessage) => {
        this.handleControlMessage(socket, message);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`Voice client disconnected: ${socket.id}`);
      });
    });

    console.log('✅ WebSocket Voice Handler initialized');
  }

  // Handle audio messages
  private async handleAudioMessage(socket: Socket, message: VoiceMessage) {
    try {
      // Convert base64 to buffer if needed
      const audioBuffer = typeof message.data === 'string'
        ? Buffer.from(message.data, 'base64')
        : message.data;

      const voice = message.voice || 'nova';

      // Send status update
      socket.emit('voice:status', {
        status: 'processing',
        message: 'Processing your voice...',
        timestamp: Date.now(),
      });

      // Get AI Voice Service
      const aiVoiceService = getAIVoiceService();

      // Process voice call
      const result = await aiVoiceService.processVoiceCall(audioBuffer, voice);

      // Send transcription
      socket.emit('voice:text', {
        type: 'transcription',
        text: result.text,
        timestamp: Date.now(),
      });

      // Send AI response text
      socket.emit('voice:text', {
        type: 'response',
        text: result.response,
        timestamp: Date.now(),
      });

      // Send audio response
      socket.emit('voice:audio', {
        type: 'response',
        data: result.audioBuffer.toString('base64'),
        timestamp: Date.now(),
      });

      // Send completion status
      socket.emit('voice:status', {
        status: 'complete',
        message: 'Voice processing complete',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error('Audio processing error:', error);
      socket.emit('voice:error', {
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  // Handle text messages
  private async handleTextMessage(socket: Socket, message: VoiceMessage) {
    try {
      const text = message.data as string;
      const voice = message.voice || 'nova';

      // Send status update
      socket.emit('voice:status', {
        status: 'processing',
        message: 'Processing your message...',
        timestamp: Date.now(),
      });

      // Get AI Voice Service
      const aiVoiceService = getAIVoiceService();

      // Process with AI
      const aiResponse = await aiVoiceService.processWithAI(text);

      // Send AI response text
      socket.emit('voice:text', {
        type: 'response',
        text: aiResponse,
        timestamp: Date.now(),
      });

      // Generate and send audio
      const audioBuffer = await aiVoiceService.synthesizeSpeech(aiResponse, voice);
      socket.emit('voice:audio', {
        type: 'response',
        data: audioBuffer.toString('base64'),
        timestamp: Date.now(),
      });

      // Send completion status
      socket.emit('voice:status', {
        status: 'complete',
        message: 'Message processing complete',
        timestamp: Date.now(),
      });
    } catch (error: any) {
      console.error('Text processing error:', error);
      socket.emit('voice:error', {
        error: error.message,
        timestamp: Date.now(),
      });
    }
  }

  // Handle control messages
  private handleControlMessage(socket: Socket, message: VoiceMessage) {
    console.log(`Control message received: ${message.data}`);
    
    // Handle different control actions
    const action = message.data as string;
    
    switch (action) {
      case 'start':
        socket.emit('voice:status', {
          status: 'ready',
          message: 'Voice call started',
          timestamp: Date.now(),
        });
        break;
      
      case 'stop':
        socket.emit('voice:status', {
          status: 'stopped',
          message: 'Voice call stopped',
          timestamp: Date.now(),
        });
        break;
      
      case 'mute':
        socket.emit('voice:status', {
          status: 'muted',
          message: 'Microphone muted',
          timestamp: Date.now(),
        });
        break;
      
      case 'unmute':
        socket.emit('voice:status', {
          status: 'unmuted',
          message: 'Microphone unmuted',
          timestamp: Date.now(),
        });
        break;
      
      default:
        socket.emit('voice:status', {
          status: 'unknown',
          message: `Unknown control action: ${action}`,
          timestamp: Date.now(),
        });
    }
  }
}