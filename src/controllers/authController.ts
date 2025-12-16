import { Request, Response, NextFunction } from 'express';
import { OAuth2Client } from 'google-auth-library';
import User from '../models/User';
import { sendTokenResponse } from '../Utils/tokenUtils';
import { SignupRequest, LoginRequest, AuthRequest, GoogleAuthRequest } from '../types';

// Initialize Google OAuth client
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (
  req: Request<{}, {}, SignupRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, password, confirmPassword, agreeToTerms } = req.body;

    // Validate password match (handled by validation middleware, but double-check)
    if (password !== confirmPassword) {
      res.status(400).json({
        success: false,
        message: 'Passwords do not match'
      });
      return;
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
      return;
    }

    // Create user with terms agreement
    const user = await User.create({
      name,
      email,
      password,
      authProvider: 'local',
      agreedToTerms: agreeToTerms,
      agreedToTermsAt: new Date()
    });

    // Send token response (no rememberMe on signup, default 7 days)
    sendTokenResponse(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      },
      201,
      res,
      false
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password, rememberMe = false } = req.body;

    // Validate email & password (handled by validation middleware, but double-check)
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
      return;
    }

    // Check for user (include password for comparison)
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Check if user is using Google auth
    if (user.authProvider === 'google') {
      res.status(400).json({
        success: false,
        message: 'This account uses Google Sign-In. Please sign in with Google.'
      });
      return;
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
      return;
    }

    // Send token response with rememberMe flag
    sendTokenResponse(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name
      },
      200,
      res,
      rememberMe
    );
  } catch (error) {
    next(error);
  }
};

// @desc    Google Sign-In
// @route   POST /api/auth/google
// @access  Public
export const googleAuth = async (
  req: Request<{}, {}, GoogleAuthRequest>,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        success: false,
        message: 'Google credential is required'
      });
      return;
    }

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload) {
      res.status(400).json({
        success: false,
        message: 'Invalid Google token'
      });
      return;
    }

    const { sub: googleId, email, name, picture } = payload;

    if (!email || !name) {
      res.status(400).json({
        success: false,
        message: 'Unable to retrieve user information from Google'
      });
      return;
    }

    // Check if user exists
    let user = await User.findOne({ email });

    if (user) {
      // User exists - check if they're using local auth
      if (user.authProvider === 'local' && !user.googleId) {
        // Link Google account to existing local account
        user.googleId = googleId;
        user.authProvider = 'google';
        user.picture = picture;
        await user.save();
      } else if (user.googleId !== googleId) {
        // User exists with different Google ID
        res.status(400).json({
          success: false,
          message: 'Email already associated with another account'
        });
        return;
      }
      // User exists with same Google ID - proceed to login
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        picture,
        authProvider: 'google',
        agreedToTerms: true, // Assume agreement for Google sign-in
        agreedToTermsAt: new Date()
      });
    }

    // Send token response
    sendTokenResponse(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      200,
      res,
      false
    );
  } catch (error: any) {
    console.error('Google Auth Error:', error);
    
    if (error.message && error.message.includes('Token used too late')) {
      res.status(400).json({
        success: false,
        message: 'Google token has expired. Please try again.'
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Google authentication failed. Please try again.'
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
        authProvider: user.authProvider,
        agreedToTerms: user.agreedToTerms,
        agreedToTermsAt: user.agreedToTermsAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Public (no protection needed - just clears cookie)
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000), // Expire in 10 seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
      data: {}
    });
  } catch (error) {
    next(error);
  }
};