const { query } = require('./utils/db.js');

async function testMessenger() {
  try {
    console.log('🧪 Testing Kracken Messenger...\n');
    
    // Test database connection
    console.log('1. Testing database connection...');
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connected:', result.rows[0].current_time);
    
    // Check tables
    console.log('\n2. Checking database tables...');
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const expectedTables = ['users', 'chat_rooms', 'chat_room_participants', 'messages'];
    const existingTables = tablesResult.rows.map(row => row.table_name);
    
    console.log('Found tables:', existingTables);
    
    for (const table of expectedTables) {
      if (existingTables.includes(table)) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' missing`);
      }
    }
    
    // Check general chat room
    console.log('\n3. Checking general chat room...');
    const roomResult = await query('SELECT * FROM chat_rooms WHERE id = 1');
    if (roomResult.rows.length > 0) {
      console.log('✅ General chat room exists:', roomResult.rows[0]);
    } else {
      console.log('❌ General chat room missing');
    }
    
    // Check test user
    console.log('\n4. Checking test user...');
    const userResult = await query('SELECT * FROM users WHERE username = $1', ['testuser']);
    if (userResult.rows.length > 0) {
      console.log('✅ Test user exists:', userResult.rows[0].username);
    } else {
      console.log('❌ Test user missing - run: node scripts/create-test-user.js');
    }
    
    // Check messages
    console.log('\n5. Checking messages table...');
    const messagesResult = await query('SELECT COUNT(*) as count FROM messages');
    console.log(`✅ Messages table has ${messagesResult.rows[0].count} messages`);
    
    console.log('\n🎉 Messenger test completed!');
    console.log('\nTo start the server:');
    console.log('  npm run dev');
    console.log('\nTo create test user:');
    console.log('  node scripts/create-test-user.js');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\nMake sure to:');
    console.log('1. Set up your .env file with DATABASE_URL');
    console.log('2. Run: node scripts/init-db.js');
    console.log('3. Run: node scripts/create-test-user.js');
  }
}

// Run test
testMessenger();
