#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = 'https://krackenxonrender.com'; //prod server original 

async function testEndpoint(method, path, data = null, headers = {}) {
  try {
    const response = await axios({
      method,
      url: `${BASE_URL}${path}`,
      data,
      headers,
      timeout: 5000
    });
    
    console.log(`✅ ${method} ${path} - ${response.status}`);
    if (response.data) {
      console.log(`   Response: ${JSON.stringify(response.data, null, 2)}`);
    }
    return true;
  } catch (error) {
    console.log(`❌ ${method} ${path} - ${error.response?.status || 'Error'}`);
    if (error.response?.data) {
      console.log(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    return false;
  }
}

async function runTests() {
  console.log('🧪 Testing Kracken Server Endpoints\n');
  
  // Test health endpoints
  console.log('📊 Health Endpoints:');
  await testEndpoint('GET', '/api/health');
  await testEndpoint('GET', '/api/ping');
  
  console.log('\n🔧 Admin Endpoints (without auth):');
  await testEndpoint('GET', '/api/admin/logs');
  await testEndpoint('POST', '/api/admin/clear-logs');
  await testEndpoint('POST', '/api/admin/delete-messages');
  await testEndpoint('POST', '/api/admin/delete-users');
  
  console.log('\n🔧 Admin Endpoints (with auth):');
  await testEndpoint('GET', '/api/admin/logs', null, { 'X-Admin-Password': 'test' });
  await testEndpoint('POST', '/api/admin/clear-logs', null, { 'X-Admin-Password': 'test' });
  
  console.log('\n🏠 Static Files:');
  await testEndpoint('GET', '/');
  await testEndpoint('GET', '/admin.html');
  
  console.log('\n✅ Testing completed!');
}

runTests().catch(console.error);
