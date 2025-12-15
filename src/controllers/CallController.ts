import { Response, NextFunction } from 'express';
import Call, { ICall } from '../models/Call';
import { AuthRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Start a new AI call
export const startCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callType, aiModel, language, voiceSettings } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    // Generate unique call ID
    const callId = uuidv4();

    // Create new call
    const call = new Call({
      userId,
      callId,
      callType: callType || 'voice',
      aiModel: aiModel || 'gpt-4',
      language: language || 'en',
      voiceSettings: voiceSettings || { voice: 'alloy', speed: 1.0 },
      status: 'active',
    });

    await call.save();

    res.status(201).json({
      success: true,
      message: 'Call started successfully',
      data: {
        callId: call.callId,
        status: call.status,
        startTime: call.startTime,
      },
    });
  } catch (error) {
    next(error);
  }
};

// End an active call
export const endCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callId } = req.params;
    const userId = req.user?.id;

    const call = await Call.findOne({ callId, userId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (call.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Call is not active',
      });
    }

    // End call manually
    call.status = 'ended';
    call.endTime = new Date();
    
    if (call.startTime) {
      call.duration = Math.floor((call.endTime.getTime() - call.startTime.getTime()) / 1000);
    }
    
    await call.save();

    res.json({
      success: true,
      message: 'Call ended successfully',
      data: {
        callId: call.callId,
        duration: call.duration,
        totalMessages: call.metadata?.totalMessages || 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Add message to call
export const addMessage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callId } = req.params;
    const { text, type, audioUrl } = req.body;
    const userId = req.user?.id;

    const call = await Call.findOne({ callId, userId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (call.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Call is not active',
      });
    }

    const message = {
      id: uuidv4(),
      type: type || 'user',
      text,
      audioUrl,
      timestamp: new Date(),
    };

    // Add message manually
    call.messages.push(message);
    
    // Update metadata
    call.metadata = call.metadata || {
      totalMessages: 0,
      userMessages: 0,
      aiMessages: 0,
    };
    
    call.metadata.totalMessages = call.messages.length;
    call.metadata.userMessages = call.messages.filter(m => m.type === 'user').length;
    call.metadata.aiMessages = call.messages.filter(m => m.type === 'ai').length;
    
    await call.save();

    res.json({
      success: true,
      message: 'Message added successfully',
      data: {
        messageId: message.id,
        callId: call.callId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process audio and get AI response
export const processAudio = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callId } = req.params;
    const userId = req.user?.id;

    // Get the audio file from request (multer)
    const audioFile = (req as any).file;

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided',
      });
    }

    const call = await Call.findOne({ callId, userId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (call.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Call is not active',
      });
    }

    // Transcribe audio
    const transcript = await transcribeAudio(audioFile);

    // Add user message
    const userMessage = {
      id: uuidv4(),
      type: 'user' as const,
      text: transcript,
      timestamp: new Date(),
    };
    
    call.messages.push(userMessage);
    
    // Update metadata
    call.metadata = call.metadata || {
      totalMessages: 0,
      userMessages: 0,
      aiMessages: 0,
    };
    call.metadata.totalMessages = call.messages.length;
    call.metadata.userMessages = call.messages.filter(m => m.type === 'user').length;
    call.metadata.aiMessages = call.messages.filter(m => m.type === 'ai').length;

    // Generate AI response
    const aiResponseText = await generateAIResponse(transcript, call);

    // Generate audio response
    const audioUrl = await generateAudioResponse(
      aiResponseText,
      call.voiceSettings
    );

    // Add AI message
    const aiMessage = {
      id: uuidv4(),
      type: 'ai' as const,
      text: aiResponseText,
      audioUrl,
      timestamp: new Date(),
    };
    
    call.messages.push(aiMessage);
    
    // Update metadata again
    call.metadata.totalMessages = call.messages.length;
    call.metadata.userMessages = call.messages.filter(m => m.type === 'user').length;
    call.metadata.aiMessages = call.messages.filter(m => m.type === 'ai').length;
    
    await call.save();

    res.json({
      success: true,
      message: 'Audio processed successfully',
      data: {
        transcript,
        aiResponse: aiResponseText,
        audioUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Process text message and get AI response
export const processText = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callId } = req.params;
    const { text } = req.body;
    const userId = req.user?.id;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Text message is required',
      });
    }

    const call = await Call.findOne({ callId, userId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    if (call.status !== 'active') {
      return res.status(400).json({
        success: false,
        message: 'Call is not active',
      });
    }

    // Add user message
    const userMessage = {
      id: uuidv4(),
      type: 'user' as const,
      text,
      timestamp: new Date(),
    };
    
    call.messages.push(userMessage);
    
    // Update metadata
    call.metadata = call.metadata || {
      totalMessages: 0,
      userMessages: 0,
      aiMessages: 0,
    };
    call.metadata.totalMessages = call.messages.length;
    call.metadata.userMessages = call.messages.filter(m => m.type === 'user').length;
    call.metadata.aiMessages = call.messages.filter(m => m.type === 'ai').length;

    // Generate AI response
    const aiResponseText = await generateAIResponse(text, call);

    // Generate audio response
    const audioUrl = await generateAudioResponse(
      aiResponseText,
      call.voiceSettings
    );

    // Add AI message
    const aiMessage = {
      id: uuidv4(),
      type: 'ai' as const,
      text: aiResponseText,
      audioUrl,
      timestamp: new Date(),
    };
    
    call.messages.push(aiMessage);
    
    // Update metadata again
    call.metadata.totalMessages = call.messages.length;
    call.metadata.userMessages = call.messages.filter(m => m.type === 'user').length;
    call.metadata.aiMessages = call.messages.filter(m => m.type === 'ai').length;
    
    await call.save();

    res.json({
      success: true,
      message: 'Text processed successfully',
      data: {
        aiResponse: aiResponseText,
        audioUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get call details
export const getCall = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { callId } = req.params;
    const userId = req.user?.id;

    const call = await Call.findOne({ callId, userId });

    if (!call) {
      return res.status(404).json({
        success: false,
        message: 'Call not found',
      });
    }

    res.json({
      success: true,
      data: call,
    });
  } catch (error) {
    next(error);
  }
};

// Get call history
export const getCallHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 10, status } = req.query;

    const query: any = { userId };
    if (status) {
      query.status = status;
    }

    const calls = await Call.find(query)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .select('-messages'); // Exclude messages for performance

    const total = await Call.countDocuments(query);

    res.json({
      success: true,
      data: {
        calls,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ==============================================
// HELPER FUNCTIONS - Replace with actual implementations
// ==============================================

async function transcribeAudio(audioFile: any): Promise<string> {
  // TODO: Implement actual speech-to-text
  // Example with OpenAI Whisper:
  // const formData = new FormData();
  // formData.append('file', audioFile.buffer, audioFile.originalname);
  // formData.append('model', 'whisper-1');
  // const response = await openai.audio.transcriptions.create(formData);
  // return response.text;
  
  return 'This is a sample transcription of the audio';
}

async function generateAIResponse(text: string, call: ICall): Promise<string> {
  // TODO: Implement actual AI response generation
  // Example with OpenAI:
  // const response = await openai.chat.completions.create({
  //   model: call.aiModel || 'gpt-4',
  //   messages: [
  //     { role: 'system', content: 'You are a helpful AI assistant.' },
  //     { role: 'user', content: text }
  //   ],
  // });
  // return response.choices[0].message.content;
  
  return `I received your message: "${text}". That's an interesting question! Let me help you with that.`;
}

async function generateAudioResponse(
  text: string,
  voiceSettings?: { voice: string; speed: number }
): Promise<string | undefined> {
  // TODO: Implement actual text-to-speech
  // Example with OpenAI TTS:
  // const mp3 = await openai.audio.speech.create({
  //   model: 'tts-1',
  //   voice: voiceSettings?.voice || 'alloy',
  //   input: text,
  //   speed: voiceSettings?.speed || 1.0,
  // });
  // const buffer = Buffer.from(await mp3.arrayBuffer());
  // // Upload to S3 or your storage service
  // const audioUrl = await uploadToS3(buffer);
  // return audioUrl;
  
  return undefined; // Return undefined for now
}