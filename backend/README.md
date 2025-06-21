
# YouTube Enhancer Backend

Simple Node.js backend for YouTube video summarization using Google's Gemini AI.

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set up API Key
Create a `.env` file in the backend directory:
```bash
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
PORT=3000
NODE_ENV=development
```

### 3. Start the Server
```bash
npm run dev
```

### 4. Test the Connection
```bash
npm test
```

## 🔧 Troubleshooting

**Port 3000 already in use?**
```bash
# Kill process using port 3000
sudo pkill -f "node.*3000"

# Or use different port
PORT=3001 npm run dev
```

**API Key Issues?**
- Make sure your Google AI API key is valid
- Check that the `.env` file is in the backend directory
- Ensure the API key has the correct permissions for Gemini API

**Node.js version issues?**
- Requires Node.js 16+ for best compatibility
- Uses axios instead of node:fetch for older Node versions

## 📋 API Endpoints

**Health Check:**
```
GET /health
```

**Test Gemini Connection:**
```
GET /api/summary/test
```

**YouTube Video Summary:**
```
POST /api/summary/youtube
{
  "videoUrl": "https://youtube.com/watch?v=VIDEO_ID",
  "detailLevel": "quick" | "detailed"
}
```

## 🔧 Usage

1. Create `.env` file with your Google AI API key
2. Start backend: `npm run dev`
3. Server runs on: http://localhost:3000
4. Load your Chrome extension
5. Test on any YouTube video

The backend will automatically detect the video's language and provide a summary in that language using Gemini 2.5 Flash.
