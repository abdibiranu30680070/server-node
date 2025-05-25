// import { Router } from 'express';
// import crypto from 'crypto';
// import bcrypt from 'bcrypt';
// import { prisma } from '../prisma/client';
// import { sendPasswordResetEmail } from '../services/emailService';
// import { body, validationResult } from 'express-validator';
// import rateLimit from 'express-rate-limit';

// const router = Router();

// // Rate limiting configuration
// const resetLimiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 5, // Limit each IP to 5 requests per window
//   message: 'Too many attempts, please try again later'
// });

// // Password validation middleware
// const validatePassword = [
//   body('newPassword')
//     .isLength({ min: 8 })
//     .withMessage('Password must be at least 8 characters')
//     .matches(/\d/)
//     .withMessage('Password must contain a number')
//     .matches(/[!@#$%^&*(),.?":{}|<>]/)
//     .withMessage('Password must contain a special character')
// ];

// // Forgot Password Route
// router.post('/forgot-password', resetLimiter, 
//   body('email').isEmail().normalizeEmail(),
//   async (req, res) => {
//     try {
//       // Validate input
//       const errors = validationResult(req);
//       if (!errors.isEmpty()) {
//         return res.status(400).json({ errors: errors.array() });
//       }

//       const { email } = req.body;
      
//       const user = await prisma.user.findUnique({ where: { email } });
//       if (!user) {
//         // Generic response to prevent email enumeration
//         return res.json({ message: 'If the email exists, a reset link will be sent' });
//       }

//       const token = crypto.randomBytes(20).toString('hex');
//       const expiresAt = new Date(Date.now() + 3600000);

//       await prisma.user.update({
//         where: { id: user.id },
//         data: {
//           resetPasswordToken: token,
//           resetPasswordExpires: expiresAt
//         }
//       });

//       const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${token}`;
//       await sendPasswordResetEmail(user.email, resetUrl);

//       res.json({ message: 'Password reset instructions sent to your email' });
//     } catch (error) {
//       console.error('Forgot password error:', error);
//       res.status(500).json({ 
//         message: 'Error processing request',
//         error: process.env.NODE_ENV === 'development' ? error.message : null
//       });
//     }
//   }
// );

// // Reset Password Route
// router.post('/reset-password', resetLimiter, validatePassword, async (req, res) => {
//   try {
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       return res.status(400).json({ errors: errors.array() });
//     }

//     const { token, newPassword } = req.body;

//     const user = await prisma.user.findFirst({
//       where: {
//         resetPasswordToken: token,
//         resetPasswordExpires: { gt: new Date() }
//       }
//     });

//     if (!user) {
//       return res.status(400).json({ message: 'Invalid or expired token' });
//     }

//     const hashedPassword = await bcrypt.hash(newPassword, 10);
    
//     await prisma.user.update({
//       where: { id: user.id },
//       data: {
//         password: hashedPassword,
//         resetPasswordToken: null,
//         resetPasswordExpires: null
//       }
//     });

//     res.json({ message: 'Password has been reset successfully' });
//   } catch (error) {
//     console.error('Reset password error:', error);
//     res.status(500).json({
//       message: 'Error resetting password',
//       error: process.env.NODE_ENV === 'development' ? error.message : null
//     });
//   }
// });

// export default router;