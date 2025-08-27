const axios = require('axios');

const BASE_URL = 'https://krackenx.onrender.com';

async function testCors() {
  console.log('🧪 Testing CORS Configuration\n');
  
  // Test 1: Simple GET request
  console.log('1. Testing simple GET request:');
  try {
    const response = await axios.get(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'https://beckend-yaj1.onrender.com'
      }
    });
    console.log('✅ GET /api/health - Success');
    console.log('   CORS Headers:', {
      'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': response.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': response.headers['access-control-allow-headers']
    });
  } catch (error) {
    console.log('❌ GET /api/health - Failed:', error.message);
  }
  
  // Test 2: OPTIONS preflight request
  console.log('\n2. Testing OPTIONS preflight request:');
  try {
    const response = await axios.options(`${BASE_URL}/api/health`, {
      headers: {
        'Origin': 'https://beckend-yaj1.onrender.com',
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'X-Requested-With'
      }
    });
    console.log('✅ OPTIONS /api/health - Success');
    console.log('   CORS Headers:', {
      'Access-Control-Allow-Origin': response.headers['access-control-allow-origin'],
      'Access-Control-Allow-Methods': response.headers['access-control-allow-methods'],
      'Access-Control-Allow-Headers': response.headers['access-control-allow-headers']
    });
  } catch (error) {
    console.log('❌ OPTIONS /api/health - Failed:', error.message);
  }
  
  // Test 3: CORS test endpoint
  console.log('\n3. Testing CORS test endpoint:');
  try {
    const response = await axios.get(`${BASE_URL}/api/cors-test`, {
      headers: {
        'Origin': 'https://beckend-yaj1.onrender.com'
      }
    });
    console.log('✅ GET /api/cors-test - Success');
    console.log('   Response:', response.data);
  } catch (error) {
    console.log('❌ GET /api/cors-test - Failed:', error.message);
  }
  
  console.log('\n✅ CORS testing completed!');
}

testCors().catch(console.error);
