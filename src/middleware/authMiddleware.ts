import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { verifyToken } from '../Utils/tokenUtils';
import User from '../models/User';

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    // Check for token in headers (Bearer token)
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Check for token in cookies (for browser requests)
    else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    // Check if token exists
    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Not authorized to access this route. Please login.'
      });
      return;
    }

    try {
      // Verify token
      const decoded = verifyToken(token);

      // Optional: Verify user still exists in database
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User no longer exists'
        });
        return;
      }

      // Add user info to request
      req.user = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name
      };

      next();
    } catch (error) {
      // Log error for debugging (in development)
      if (process.env.NODE_ENV === 'development') {
        console.error('Token verification error:', error);
      }

      res.status(401).json({
        success: false,
        message: 'Token is invalid or has expired. Please login again.'
      });
      return;
    }
  } catch (error) {
    // Log unexpected errors
    console.error('Authentication middleware error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
    return;
  }
};

// Optional: Role-based middleware
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authorized'
      });
      return;
    }

    next();
  };
};