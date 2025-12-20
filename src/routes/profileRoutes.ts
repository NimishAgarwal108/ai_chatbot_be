import express from 'express';
import { body } from 'express-validator';
import {
  getProfile,
  updateProfile,
  updatePreferences,
  changePassword,
  deleteAccount,
  getStats
} from '../controllers/profileController';
import { protect } from '../middleware/authMiddleware';
import { validationMiddleware } from '../middleware/validationMiddleware';

const router = express.Router();

// All routes are protected
router.use(protect);

// Profile validation rules
const updateProfileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s]+$/)
    .withMessage('Name can only contain letters and spaces'),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[\d\s\-\+\(\)]+$/)
    .withMessage('Please provide a valid phone number'),
  
  body('location')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Location is too long'),
  
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Bio cannot exceed 500 characters')
];

// Preferences validation rules
const updatePreferencesValidation = [
  body('notifications')
    .optional()
    .isBoolean()
    .withMessage('Notifications must be a boolean'),
  
  body('language')
    .optional()
    .isString()
    .isLength({ min: 2, max: 10 })
    .withMessage('Language code must be between 2 and 10 characters')
];

// Password change validation rules
const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
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
    .custom((value, { req }) => value === req.body.newPassword)
    .withMessage('Passwords must match')
];

// Routes
router.get('/', getProfile);
router.get('/stats', getStats);
router.put('/', updateProfileValidation, validationMiddleware, updateProfile);
router.put('/preferences', updatePreferencesValidation, validationMiddleware, updatePreferences);
router.put('/password', changePasswordValidation, validationMiddleware, changePassword);
router.delete('/', deleteAccount);

export default router;