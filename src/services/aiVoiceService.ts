// ============================================
// File: src/services/aiVoiceService.ts
// Backend AI Voice Service - GEMINI VERSION
// ============================================

import { createClient, DeepgramClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface VoiceCallOptions {
  voice?: string;
  language?: string;
  model?: string;
}

export class AIVoiceService {
  private deepgram: DeepgramClient;
  private genAI: GoogleGenerativeAI;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor() {
    const deepgramApiKey = process.env.DEEPGRAM_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!deepgramApiKey) {
      throw new Error('DEEPGRAM_API_KEY not found in environment variables');
    }

    if (!geminiApiKey) {
      throw new Error('GEMINI_API_KEY not found in environment variables');
    }

    this.deepgram = createClient(deepgramApiKey);
    this.genAI = new GoogleGenerativeAI(geminiApiKey);

    console.log('✅ AIVoiceService initialized with Gemini AI');
  }

  /**
   * Transcribe audio using Deepgram
   */
  async transcribeAudio(audioData: string | Buffer): Promise<string> {
    try {
      console.log('📊 Transcribing audio with Deepgram...');

      let audioBuffer: Buffer;

      if (typeof audioData === 'string') {
        console.log('   Converting base64 to buffer...');
        audioBuffer = Buffer.from(audioData, 'base64');
      } else if (Buffer.isBuffer(audioData)) {
        audioBuffer = audioData;
      } else {
        throw new Error('Invalid audio data type');
      }

      console.log('   Buffer size:', audioBuffer.length, 'bytes');

      if (audioBuffer.length < 1000) {
        throw new Error(`Audio buffer too small: ${audioBuffer.length} bytes`);
      }

      const { result, error } =
        await this.deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
          model: 'nova-2',
          language: 'en',
          punctuate: true,
          smart_format: true,
          diarize: false,
          utterances: false,
        });

      if (error) {
        throw new Error(JSON.stringify(error));
      }

      const transcript =
        result?.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';

      const confidence =
        result?.results?.channels?.[0]?.alternatives?.[0]?.confidence;

      console.log('📊 Transcript:', transcript);
      console.log('📊 Confidence:', confidence);

      if (!transcript.trim()) {
        throw new Error('Empty transcript received from Deepgram');
      }

      const cleaned = transcript.trim().toLowerCase();
      const hallucinations = ['thank you', 'thanks', 'bye', 'goodbye'];

      if (cleaned.length < 3 || hallucinations.includes(cleaned)) {
        throw new Error('Transcript appears to be a hallucination');
      }

      return transcript.trim();
    } catch (err: any) {
      console.error('❌ Transcription error:', err.message);
      throw new Error(`Failed to transcribe audio: ${err.message}`);
    }
  }

  /**
   * Generate AI response using Google Gemini
   */
  async generateResponse(
    transcription: string,
    conversationHistory: Array<{
      role: 'user' | 'model';
      parts: Array<{ text: string }>;
    }> = []
  ): Promise<string> {
    try {
      console.log('🤖 Generating AI response with Gemini...');

      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      // Build chat history
      const history = conversationHistory.length > 0 
        ? conversationHistory 
        : this.conversationHistory.map(msg => ({
            role: msg.role as 'user' | 'model',
            parts: [{ text: msg.content }],
          }));

      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      });

      const result = await chat.sendMessage(transcription);
      const response = await result.response;
      const text = response.text();

      if (!text.trim()) {
        throw new Error('Empty AI response from Gemini');
      }

      // Update conversation history
      this.conversationHistory.push({ role: 'user', content: transcription });
      this.conversationHistory.push({ role: 'model', content: text });

      // Keep only last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      console.log('🤖 Gemini Response:', text.substring(0, 100) + '...');
      return text.trim();
    } catch (err: any) {
      console.error('❌ AI response error:', err.message);
      throw new Error(`Failed to generate response: ${err.message}`);
    }
  }

  /**
   * Main voice pipeline
   */
  async processVoiceCall(
    audioData: string | Buffer,
    socket: any,
    options: VoiceCallOptions = {}
  ): Promise<void> {
    try {
      socket.emit('voice:status', {
        status: 'processing',
        message: 'Processing your voice...',
        timestamp: Date.now(),
      });

      const transcription = await this.transcribeAudio(audioData);

      socket.emit('voice:text', {
        type: 'transcription',
        text: transcription,
        timestamp: Date.now(),
      });

      socket.emit('voice:status', {
        status: 'thinking',
        message: 'Thinking...',
        timestamp: Date.now(),
      });

      const aiResponse = await this.generateResponse(transcription);

      socket.emit('voice:text', {
        type: 'response',
        text: aiResponse,
        timestamp: Date.now(),
      });

      socket.emit('voice:status', {
        status: 'complete',
        message: 'Complete',
        timestamp: Date.now(),
      });
    } catch (err: any) {
      console.error('❌ Voice pipeline error:', err.message);

      socket.emit('voice:error', {
        error: err.message,
        timestamp: Date.now(),
      });

      throw err;
    }
  }

  /**
   * Get conversation history
   */
  getHistory(): Array<{ role: string; content: string }> {
    return this.conversationHistory;
  }

  /**
   * Clear conversation history
   */
  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🗑️ Conversation history cleared');
  }

  /**
   * For HTTP endpoint: Process audio and return text
   */
  async transcribeOnly(audioBuffer: Buffer): Promise<string> {
    return this.transcribeAudio(audioBuffer);
  }

  /**
   * For HTTP endpoint: Generate response from text
   */
  async generateResponseOnly(text: string): Promise<string> {
    return this.generateResponse(text);
  }

  /**
   * For HTTP endpoint: Text-to-speech (using browser, no backend TTS)
   */
  async synthesizeSpeech(text: string, voice: string = 'default'): Promise<Buffer> {
    // Note: Since we're using browser TTS, this just returns empty buffer
    // The actual TTS happens on frontend using Web Speech API
    console.log('ℹ️ TTS handled by browser Web Speech API');
    return Buffer.from([]);
  }
}

/**
 * ✅ LAZY SINGLETON (CRITICAL FIX)
 */
let aiVoiceService: AIVoiceService | null = null;

export function getAIVoiceService(): AIVoiceService {
  if (!aiVoiceService) {
    aiVoiceService = new AIVoiceService();
  }
  return aiVoiceService;
}