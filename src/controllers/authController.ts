import { Request, Response, NextFunction } from 'express';
import User from '../models/User';
import { sendTokenResponse } from '../Utils/tokenUtils';
import { SignupRequest, LoginRequest, AuthRequest } from '../types';

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