// ============================================
// File: src/services/aiVoiceService.ts
// Core AI Voice Processing Service - 100% FREE VERSION
// ============================================
import { createClient } from '@deepgram/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface VoiceConfig {
  model?: string;
  voice?: string;
  language?: string;
}

export class AIVoiceService {
  private deepgramApiKey: string;
  private geminiApiKey: string;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor(deepgramApiKey: string, geminiApiKey: string) {
    this.deepgramApiKey = deepgramApiKey;
    this.geminiApiKey = geminiApiKey;
  }

  // Speech-to-Text: Convert audio to text using Deepgram (FREE)
  async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const deepgram = createClient(this.deepgramApiKey);

      const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language: 'en',
          smart_format: true,
          punctuate: true,
        }
      );

      if (error) {
        console.error('Deepgram API error:', error);
        throw new Error(`Deepgram transcription failed: ${error.message}`);
      }

      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

      if (!transcript) {
        throw new Error('No transcription text received from Deepgram');
      }

      return transcript;
    } catch (error) {
      console.error('Transcription error:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  // Process with AI: Get response from Google Gemini (FREE)
  async processWithAI(userMessage: string, systemPrompt?: string): Promise<string> {
    try {
      const genAI = new GoogleGenerativeAI(this.geminiApiKey);
      // Using the same model as your chat feature
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash'
      });

      // Add user message to history
      this.conversationHistory.push({
        role: 'user',
        content: userMessage,
      });

      // Build conversation context
      const conversationContext = this.conversationHistory
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const prompt = `${systemPrompt || 'You are a helpful AI assistant for customer support. Be concise, friendly, and professional. Keep responses under 50 words for voice chat.'}

Conversation history:
${conversationContext}

Please respond to the user's last message.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const aiResponse = response.text() || 'I apologize, I could not generate a response.';

      // Add AI response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
      });

      // Keep conversation history limited to last 10 messages
      if (this.conversationHistory.length > 10) {
        this.conversationHistory = this.conversationHistory.slice(-10);
      }

      return aiResponse;
    } catch (error) {
      console.error('AI processing error:', error);
      throw new Error('Failed to process with AI');
    }
  }

  // Text-to-Speech: Using Browser's Web Speech API (FREE)
  // Note: This will be handled on the frontend instead
  async synthesizeSpeech(text: string, voice: string = 'default'): Promise<Buffer> {
    // Since we're using free services, TTS will be done on the frontend
    // using the browser's built-in speechSynthesis API
    // Return empty buffer and handle TTS on frontend
    return Buffer.from('');
  }

  // Full pipeline: Audio in -> Text response out
  async processVoiceCall(audioBuffer: Buffer, voice: string = 'default'): Promise<{
    text: string;
    response: string;
    audioBuffer: Buffer;
  }> {
    try {
      // 1. Speech-to-Text (Deepgram - FREE)
      const userText = await this.transcribeAudio(audioBuffer);
      console.log('User said:', userText);

      // 2. Process with AI (Google Gemini - FREE)
      const aiResponse = await this.processWithAI(userText);
      console.log('AI response:', aiResponse);

      // 3. Text-to-Speech will be handled on frontend using browser's Web Speech API
      // Return empty buffer - frontend will synthesize speech
      const audioResponse = Buffer.from('');

      return {
        text: userText,
        response: aiResponse,
        audioBuffer: audioResponse,
      };
    } catch (error) {
      console.error('Voice call processing error:', error);
      throw error;
    }
  }

  // Clear conversation history
  clearHistory(): void {
    this.conversationHistory = [];
  }

  // Get conversation history
  getHistory(): Array<{ role: string; content: string }> {
    return this.conversationHistory;
  }
}

// Export singleton factory
let aiVoiceServiceInstance: AIVoiceService | null = null;

export const getAIVoiceService = (deepgramApiKey?: string, geminiApiKey?: string): AIVoiceService => {
  if (!aiVoiceServiceInstance && deepgramApiKey && geminiApiKey) {
    aiVoiceServiceInstance = new AIVoiceService(deepgramApiKey, geminiApiKey);
  }
  if (!aiVoiceServiceInstance) {
    throw new Error('AI Voice Service not initialized');
  }
  return aiVoiceServiceInstance;
};