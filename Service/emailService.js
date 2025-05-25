// const nodemailer = require('nodemailer');

// // Configure transporter based on environment
// const transporter = nodemailer.createTransport(
//     process.env.NODE_ENV === 'production' 
//     ? {
//         // Production configuration
//         host: process.env.EMAIL_HOST,
//         port: process.env.EMAIL_PORT,
//         secure: true,
//         auth: {
//             user: process.env.EMAIL_USER,
//             pass: process.env.EMAIL_PASS
//         }
//       }
//     : {
//         // Development configuration (ethereal.email)
//         host: 'smtp.ethereal.email',
//         port: 587,
//         auth: {
//             user: 'your-ethereal-username',
//             pass: 'your-ethereal-password'
//         }
//       }
// );

// const verifyEmailConnection = async () => {
//     try {
//         await transporter.verify();
//         console.log('✅ Email server connection verified');
//     } catch (error) {
//         console.error('❌ Email server connection failed:', error);
//         process.exit(1); // Exit if email service is critical
//     }
// };

// const sendPasswordResetEmail = async (email, token) => {
//     const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    
//     try {
//         const info = await transporter.sendMail({
//             from: `"Health Team" <${process.env.EMAIL_FROM || 'noreply@example.com'}>`,
//             to: email,
//             subject: 'Password Reset Request',
//             html: `
//                 <p>You requested a password reset:</p>
//                 <a href="${resetUrl}">Reset Password Here</a>
//                 <p>This link expires in 1 hour</p>
//             `
//         });

//         // Return debug info for development
//         return {
//             success: true,
//             debugInfo: {
//                 messageId: info.messageId,
//                 previewUrl: nodemailer.getTestMessageUrl(info)
//             }
//         };

//     } catch (error) {
//         console.error('Email send failed:', {
//             email,
//             error: error.response || error.message
//         });
//         throw new Error('Failed to send password reset email');
//     }
// };

// // Verify connection on startup
// verifyEmailConnection();

// module.exports = { sendPasswordResetEmail };
