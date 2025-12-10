import express from 'express';
import { body } from 'express-validator';
import { signup, login, getMe, logout } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';
import { validationMiddleware } from '../middleware/validationMiddleware';

const router = express.Router();

// Validation rules for signup
const signupValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
    .isLength({ max: 100 })
    .withMessage('Email is too long'),
  
  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain at least one lowercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number')
    .matches(/[@$!%*?&#^()\-_=+{}[\]|;:'",.<>/~`]/)
    .withMessage('Password must contain at least one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => value === req.body.password)
    .withMessage('Passwords must match'),
  
  body('agreeToTerms')
    .isBoolean()
    .withMessage('Agreement to terms must be a boolean')
    .equals('true')
    .withMessage('You must agree to the terms and conditions')
];

// Validation rules for login
const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
  
  body('rememberMe')
    .optional()
    .isBoolean()
    .withMessage('Remember me must be a boolean')
];

// Public routes
router.post('/signup', signupValidation, validationMiddleware, signup);
router.post('/login', loginValidation, validationMiddleware, login);
router.post('/logout', logout); // No protection needed - just clears cookie

// Protected routes
router.get('/me', protect, getMe);

// Optional: Add these routes for future features
// router.post('/forgot-password', forgotPasswordValidation, validationMiddleware, forgotPassword);
// router.post('/reset-password/:token', resetPasswordValidation, validationMiddleware, resetPassword);
// router.put('/update-password', protect, updatePasswordValidation, validationMiddleware, updatePassword);
// router.put('/update-profile', protect, updateProfileValidation, validationMiddleware, updateProfile);

export default router;