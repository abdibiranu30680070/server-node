require('dotenv').config(); // Load environment variables first
const express = require('express');
const helmet = require('helmet'); // Security middleware
const cors = require('cors');
const morgan = require('morgan'); // HTTP request logger

const app = express();

// Middleware setup
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*', // Configure properly for production
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json()); // Built-in alternative to bodyParser.json()
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev')); // Log requests

// Route imports
const adminRouter = require('./Routes/adminRouter');
const userRouter = require('./Routes/userRouter');
const appRouter = require('./Routes/appRouter');
const authRoutes = require("./Routes/auth");

// Route mounting (organized together)
app.use('/admin', adminRouter);
app.use('/api/users', userRouter);
app.use('/api', appRouter);
app.use("/api/auth", authRoutes);

// Health check endpoint
app.get('/health', (req, res) => res.status(200).json({ 
  status: 'OK',
  timestamp: new Date().toISOString()
}));

// Error handling middleware (should be last)
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1); // Exit with failure
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});
// Server initialization
const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`Server started on port ${port}`);
});
