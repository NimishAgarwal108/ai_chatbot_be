// ============================================
// File: src/websocket/voiceHandler.ts
// WebSocket Voice Handler - FIXED VERSION
// ============================================

import { Server, Socket } from 'socket.io';
import { getAIVoiceService } from '../services/aiVoiceService';

interface VoiceMessage {
  type: 'audio' | 'text' | 'control';
  data: string | Buffer;
  timestamp: number;
  voice?: string;
  format?: string;
}

export class VoiceHandler {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    console.log('🎤 VoiceHandler constructor called');
    
    // ✅ CRITICAL FIX: Auto-initialize on construction
    this.initialize();
  }

  initialize(): void {
    console.log('🔧 Initializing WebSocket voice handlers...');
    
    this.io.on('connection', (socket: Socket) => {
      console.log('✅ Voice client connected:', socket.id);

      // Send connection confirmation
      socket.emit('voice:connected', {
        status: 'connected',
        message: 'Voice service ready',
        timestamp: Date.now(),
      });

      // Handle incoming audio
      socket.on('voice:audio', async (message: VoiceMessage) => {
        await this.handleAudioMessage(socket, message);
      });

      // Handle incoming text
      socket.on('voice:text', async (message: VoiceMessage) => {
        await this.handleTextMessage(socket, message);
      });

      // Handle control commands
      socket.on('voice:control', (message: VoiceMessage) => {
        this.handleControlMessage(socket, message);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        console.log('👋 Voice client disconnected:', socket.id, 'Reason:', reason);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('❌ Socket error:', error);
      });
    });
    
    console.log('✅ Voice handlers initialized successfully');
  }

  /**
   * Handle audio messages with proper base64 decoding
   */
  private async handleAudioMessage(socket: Socket, message: VoiceMessage): Promise<void> {
    try {
      console.log('📥 Received audio message');
      console.log('   Type:', message.type);
      console.log('   Format:', message.format);
      console.log('   Timestamp:', message.timestamp);

      if (!message.data) {
        throw new Error('No audio data provided');
      }

      // The data comes as base64 string from frontend
      let audioData: string;
      
      if (typeof message.data === 'string') {
        audioData = message.data;
        console.log('   Base64 string length:', audioData.length);
      } else if (Buffer.isBuffer(message.data)) {
        // Convert buffer to base64 if it came as buffer
        audioData = message.data.toString('base64');
        console.log('   Converted buffer to base64, length:', audioData.length);
      } else {
        throw new Error('Invalid audio data type');
      }

      // Validate base64
      if (audioData.length === 0) {
        throw new Error('Empty audio data');
      }

      // Get AI Voice Service
      const aiVoiceService = getAIVoiceService();

      // Pass the base64 string directly to the service
      await aiVoiceService.processVoiceCall(
        audioData,
        socket,
        {
          voice: message.voice,
        }
      );

    } catch (error: any) {
      console.error('❌ Audio processing error:', error);
      
      socket.emit('voice:error', {
        type: 'error',
        error: error.message || 'Failed to process audio',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle text messages
   */
  private async handleTextMessage(socket: Socket, message: VoiceMessage): Promise<void> {
    try {
      console.log('📥 Received text message:', message.data);

      if (!message.data || typeof message.data !== 'string') {
        throw new Error('Invalid text data');
      }

      // Send status
      socket.emit('voice:status', {
        type: 'status',
        status: 'processing',
        message: 'Processing your message...',
        timestamp: Date.now(),
      });

      // Get AI Voice Service
      const aiVoiceService = getAIVoiceService();

      // Generate response
      const response = await aiVoiceService.generateResponseOnly(message.data);

      // Send response
      socket.emit('voice:text', {
        type: 'response',
        text: response,
        timestamp: Date.now(),
      });

      socket.emit('voice:status', {
        type: 'status',
        status: 'complete',
        message: 'Complete',
        timestamp: Date.now(),
      });

    } catch (error: any) {
      console.error('❌ Text processing error:', error);
      
      socket.emit('voice:error', {
        type: 'error',
        error: error.message || 'Failed to process text',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle control messages
   */
  private handleControlMessage(socket: Socket, message: VoiceMessage): void {
    try {
      console.log('🎮 Control command:', message.data);

      const command = message.data as string;

      switch (command) {
        case 'start':
          socket.emit('voice:status', {
            type: 'status',
            status: 'listening',
            message: 'Listening...',
            timestamp: Date.now(),
          });
          break;

        case 'stop':
          socket.emit('voice:status', {
            type: 'status',
            status: 'stopped',
            message: 'Stopped',
            timestamp: Date.now(),
          });
          break;

        case 'mute':
          socket.emit('voice:status', {
            type: 'status',
            status: 'muted',
            message: 'Muted',
            timestamp: Date.now(),
          });
          break;

        case 'unmute':
          socket.emit('voice:status', {
            type: 'status',
            status: 'unmuted',
            message: 'Unmuted',
            timestamp: Date.now(),
          });
          break;

        default:
          console.warn('Unknown control command:', command);
      }

    } catch (error: any) {
      console.error('❌ Control message error:', error);
      
      socket.emit('voice:error', {
        type: 'error',
        error: error.message || 'Failed to process control',
        timestamp: Date.now(),
      });
    }
  }
}

export default VoiceHandler;