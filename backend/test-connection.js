
const axios = require('axios');

async function testBackend() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing YouTube Enhancer Backend...\n');
  
  try {
    // Test health check
    console.log('1️⃣ Testing health endpoint...');
    const healthResponse = await axios.get(`${baseUrl}/health`);
    console.log('✅ Health check:', healthResponse.data.status);
    
    console.log('\n🎉 Backend is ready!');
    console.log('📍 API Endpoint: http://localhost:3000/api/summary/youtube');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('\n❌ Connection refused - Backend not running');
      console.log('\n💡 Make sure to run "npm run dev" in the backend folder');
      console.log('🔍 If port 3000 is busy, kill the process with: sudo pkill -f "node.*3000"');
    } else {
      console.error('\n❌ Backend test failed:', error.message);
    }
  }
}

testBackend();
