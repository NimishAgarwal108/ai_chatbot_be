// routes/chatRoutes.ts
import express, { Request, Response } from 'express';
import Conversation from '../models/Conversation';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

// Lazy Gemini initialization with better error handling
function getGemini() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.error('❌ GEMINI_API_KEY is not set in environment variables');
    return null;
  }
  console.log('✅ Gemini API key found, initializing...');
  return new GoogleGenerativeAI(key);
}

// AI Response Function using Google Gemini
async function getAIResponse(message: string, conversationHistory: any[]): Promise<string> {
  try {
    const genAI = getGemini();

    // If no API key, use fallback
    if (!genAI) {
      console.warn('⚠️ No Gemini API key, using fallback response');
      return getFallbackResponse(message);
    }

    console.log('🤖 Calling Gemini API for message:', message.substring(0, 50) + '...');

    // Initialize the model (using Gemini 2.5 Flash - latest stable model)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash'  // Updated to latest model name
    });

    // Build conversation history for context (exclude the message we just added)
    let contextText = '';
    if (conversationHistory.length > 1) {
      // Exclude the last message (which is the current user message we just added)
      const recentHistory = conversationHistory.slice(-7, -1); // Last 3 exchanges before current
      contextText = recentHistory.map(msg => {
        const role = msg.role === 'assistant' ? 'Assistant' : 'User';
        return `${role}: ${msg.content}`;
      }).join('\n');
    }

    // Create the full prompt
    const systemPrompt = 'You are a helpful AI assistant. Be concise, friendly, and informative.';
    const fullPrompt = contextText 
      ? `${systemPrompt}\n\nPrevious conversation:\n${contextText}\n\nUser: ${message}\n\nAssistant:`
      : `${systemPrompt}\n\nUser: ${message}\n\nAssistant:`;

    console.log('📝 Sending prompt to Gemini...');

    // Generate response
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ Received response from Gemini:', text.substring(0, 100) + '...');

    return text || 'Sorry, I could not generate a response.';

  } catch (error: any) {
    console.error('❌ Gemini API Error:', {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      name: error?.name
    });

    // Handle specific Gemini errors
    if (error?.status === 429) {
      return 'I am experiencing high demand. Please try again shortly.';
    }
    if (error?.status === 401 || error?.status === 403) {
      return 'Gemini API key error. Please check your configuration.';
    }
    if (error?.message?.includes('quota') || error?.message?.includes('API key')) {
      return 'API quota exceeded or invalid API key. Please check your Gemini API configuration.';
    }
    if (error?.message?.includes('SAFETY')) {
      return 'I apologize, but I cannot respond to that message due to safety filters.';
    }

    console.warn('⚠️ Falling back to simple response');
    return getFallbackResponse(message);
  }
}

// Fallback response when API is unavailable
function getFallbackResponse(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('hello') || lower.includes('hi')) return "Hello! How can I assist you today?";
  if (lower.includes('how are you')) return "I'm doing well! How can I help you?";
  if (lower.includes('what is your name') || lower.includes('who are you')) return "I'm your AI assistant powered by Google Gemini.";
  if (lower.includes('help')) return "I'm here to help! What would you like to know?";
  if (lower.includes('thank')) return "You're welcome! Anything else I can assist with?";
  if (lower.includes('bye') || lower.includes('goodbye')) return "Goodbye! Come back anytime for assistance.";
  
  // Math operations
  if (lower.match(/what is \d+[\+\-\*\/]\d+/) || lower.match(/\d+[\+\-\*\/]\d+/)) {
    try {
      const match = message.match(/(\d+)\s*([\+\-\*\/])\s*(\d+)/);
      if (match) {
        const num1 = parseInt(match[1]);
        const operator = match[2];
        const num2 = parseInt(match[3]);
        let result;
        switch(operator) {
          case '+': result = num1 + num2; break;
          case '-': result = num1 - num2; break;
          case '*': result = num1 * num2; break;
          case '/': result = num2 !== 0 ? num1 / num2 : 'Error: Division by zero'; break;
        }
        return `The answer is ${result}.`;
      }
    } catch (e) {
      // Fall through to default
    }
  }

  return `I received your message: "${message}". The AI service is temporarily unavailable, but I'm here to help with basic queries!`;
}

// POST /api/chat - send message and get AI response
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, conversationId, userId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message must be a non-empty string' });
    }

    let conversation = conversationId ? await Conversation.findOne({ conversationId }) : null;
    let newConversationId = conversationId;

    if (!conversation) {
      newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      conversation = new Conversation({
        conversationId: newConversationId,
        userId: userId || undefined,
        messages: []
      });
    }

    conversation.messages.push({ role: 'user', content: message.trim(), timestamp: new Date() });
    const aiResponse = await getAIResponse(message, conversation.messages);
    conversation.messages.push({ role: 'assistant', content: aiResponse, timestamp: new Date() });

    await conversation.save();

    res.json({ success: true, response: aiResponse, conversationId: newConversationId });
  } catch (error: any) {
    console.error('Error in chat endpoint:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

// GET /api/chat/conversations - get all conversations
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};
    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .limit(50)
      .select('-__v');

    res.json({ success: true, count: conversations.length, data: conversations });
  } catch (error: any) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

// GET /api/chat/conversations/:conversationId - get single conversation
router.get('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const conversation = await Conversation.findOne({ conversationId }).select('-__v');

    if (!conversation) return res.status(404).json({ success: false, error: 'Conversation not found' });

    res.json({ success: true, data: conversation });
  } catch (error: any) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/chat/conversations/:conversationId - delete a conversation
router.delete('/conversations/:conversationId', async (req: Request, res: Response) => {
  try {
    const { conversationId } = req.params;
    const result = await Conversation.deleteOne({ conversationId });

    if (result.deletedCount === 0) return res.status(404).json({ success: false, error: 'Conversation not found' });

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

// DELETE /api/chat/conversations - delete all conversations
router.delete('/conversations', async (req: Request, res: Response) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};
    const result = await Conversation.deleteMany(query);

    res.json({ success: true, message: `${result.deletedCount} conversation(s) deleted successfully`, deletedCount: result.deletedCount });
  } catch (error: any) {
    console.error('Error deleting conversations:', error);
    res.status(500).json({ success: false, error: 'Internal server error', message: error.message });
  }
});

export default router;