const express = require('express'); 
const app = express();
const cors = require('cors'); 
const bodyParser = require('body-parser');

// Middleware setup
app.use(cors()); 
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: false }));

// Import routers
const adminRouter = require('./Routes/adminRouter.js');
const userRouter = require('./Routes/userRouter.js');
const appRouter = require('./Routes/appRouter.js'); 

// Use routers
app.use('/admin', adminRouter);
app.use('/', userRouter); 
app.use('/', appRouter); 

// Health check route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Server initialization
const port = process.env.PORT || 4001; // Using environment variable for the port
app.listen(port, () => {
    console.log(`Server started successfully on port ${port}`);
});
const authRoutes = require("./Routes/auth");
app.use("/api/auth", authRoutes);

