const express = require('express');
const cors = require('cors');
const connectDB = require('./server/config/database');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./server/routes/auth'));
app.use('/api/devices', require('./server/routes/devices'));  // Add this line

// Basic test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});