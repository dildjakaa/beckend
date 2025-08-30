const fetch = require('node-fetch');

const SERVER_URL = 'krackenx.onrender.com';

async function testFriendsAPI() {
    console.log('🧪 Testing Friends API endpoints...\n');
    
    try {
        // Test 1: Health check
        console.log('1. Testing health endpoint...');
        const healthResponse = await fetch(`${SERVER_URL}/api/health`);
        console.log(`   Status: ${healthResponse.status}`);
        if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            console.log(`   Response: ${JSON.stringify(healthData)}`);
        }
        console.log('');
        
        // Test 2: Friends endpoints (should return 404 if not authenticated)
        console.log('2. Testing friends endpoints (unauthenticated)...');
        
        const endpoints = [
            '/api/friends/list/1',
            '/api/friends/requests/1',
            '/api/friends/send-request',
            '/api/friends/respond-request' 
        ];
        
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(`${SERVER_URL}${endpoint}`);
                console.log(`   ${endpoint}: ${response.status} ${response.statusText}`);
            } catch (error) {
                console.log(`   ${endpoint}: Error - ${error.message}`);
            }
        }
        console.log('');
        
        // Test 3: Check if server is running
        console.log('3. Testing server availability...');
        try {
            const response = await fetch(`${SERVER_URL}/`);
            console.log(`   Main page: ${response.status} ${response.statusText}`);
        } catch (error) {
            console.log(`   Main page: Error - ${error.message}`);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run tests
testFriendsAPI();
