const { query } = require('../utils/db.js');
const { hashPassword } = require('../utils/hash.js');

async function createTestUser() {
  try {
    console.log('Creating test user...');
    
    // Check if test user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1',
      ['testuser']
    );
    
    if (existingUser.rows.length > 0) {
      console.log('Test user already exists');
      return;
    }
    
    // Hash password
    const hashedPassword = await hashPassword('testpass123');
    
    // Create test user
    const result = await query(
      `INSERT INTO users (username, email, password_hash, email_verified) 
       VALUES ($1, $2, $3, true) 
       RETURNING id, username, email`,
      ['testuser', 'test@example.com', hashedPassword]
    );
    
    const user = result.rows[0];
    console.log('Test user created:', user);
    
    // Ensure user is in general chat room
    await query(
      'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
      [1, user.id]
    );
    
    console.log('Test user added to general chat room');
    console.log('Login credentials:');
    console.log('Username: testuser');
    console.log('Password: testpass123');
    
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createTestUser().then(() => {
    console.log('Test user creation complete');
    process.exit(0);
  }).catch((error) => {
    console.error('Test user creation failed:', error);
    process.exit(1);
  });
}

module.exports = { createTestUser };
