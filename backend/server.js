// backend/server.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { Pool } = require('pg');

// 🌟🌟🌟 START: IMPORTANT - LOAD ENVIRONMENT VARIABLES FIRST 🌟🌟🌟
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '.env') });
// 🌟🌟🌟 END: IMPORTANT - LOAD ENVIRONMENT VARIABLES FIRST 🌟🌟🌟

// NEW: Import database initializer
const DatabaseInitializer = require('./database/init');

// Database connection configuration
const pool = new Pool({
   connectionString: process.env.DATABASE_URL,
    ssl: false
});

// NEW: Initialize database initializer
const dbInitializer = new DatabaseInitializer(pool);

// Test the database connection and initialize schema when the server starts
pool.connect()
    .then(async (client) => {
        console.log('✅ Connected to local PostgreSQL database!');
        client.release();
        
        // NEW: Initialize database schema
        try {
            await dbInitializer.initializeDatabase();
            await dbInitializer.healthCheck();
        } catch (initError) {
            console.error('❌ Database initialization failed:', initError.message);
            console.error('💡 Make sure your PostgreSQL server is running and the database exists.');
        }
    })
    .catch(err => {
        console.error('❌ Error connecting to PostgreSQL database:', err.message);
        console.error('💡 Please ensure your local PostgreSQL server is running and DATABASE_URL in .env is correct.');
    });

// Debug environment loading
console.log('🔧 Environment loading debug:');
console.log('   - Working directory:', process.cwd());
console.log('   - __dirname:', __dirname);
console.log('   - NODE_ENV:', process.env.NODE_ENV);
console.log('   - PORT:', process.env.PORT);
console.log('   - API Key present:', process.env.GOOGLE_AI_API_KEY ? 'Yes' : 'No');
console.log('   - API Key length:', process.env.GOOGLE_AI_API_KEY ? process.env.GOOGLE_AI_API_KEY.length : 0);
console.log('   - API Key first 10 chars:', process.env.GOOGLE_AI_API_KEY ? process.env.GOOGLE_AI_API_KEY.substring(0, 10) + '...' : 'None');

const summaryRoutes = require('./routes/summary');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Simple CORS for Chrome extension
app.use(cors({
  origin: true,
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    port: PORT,
    apiKeyLoaded: process.env.GOOGLE_AI_API_KEY ? true : false
  });
});

// API routes
app.use('/api/summary', summaryRoutes(pool)); // Pass the pool to the router

// Start server with error handling
const server = app.listen(PORT, () => {
  console.log(`🚀 Backend running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`🎥 Summary: http://localhost:${PORT}/api/summary/youtube`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use!`);
    console.log('💡 To fix this, either:');
    console.log(`   - Kill the process using port ${PORT}: sudo pkill -f "node.*${PORT}"`);
    console.log(`   - Or use a different port: PORT=3001 npm run dev`);
    process.exit(1);
  } else {
    console.error('❌ Server error:', error);
    process.exit(1);
  }
});

module.exports = app;
