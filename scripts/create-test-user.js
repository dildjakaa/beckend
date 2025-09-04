const { query } = require('../utils/db.js');
const { hashPassword } = require('../utils/hash.js');

async function createTestUser() {
  try {
    const username = 'testuser';
    const email = 'test@example.com';
    const password = 'testpass123';
    
    // Check if user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );
    
    if (existingUser.rows.length > 0) {
      console.log('User already exists:', existingUser.rows[0]);
      return;
    }
    
    // Create new user
    const hashedPassword = hashPassword(password);
    const result = await query(
      `INSERT INTO users (username, email, password_hash, email_verified, created_at) 
       VALUES ($1, $2, $3, true, CURRENT_TIMESTAMP) 
       RETURNING id, username, email`,
      [username, email, hashedPassword]
    );
    
    console.log('✅ Test user created successfully:');
    console.log('  ID:', result.rows[0].id);
    console.log('  Username:', result.rows[0].username);
    console.log('  Email:', result.rows[0].email);
    console.log('  Password:', password);
    console.log('\nYou can now login with:');
    console.log('  Username:', username);
    console.log('  Password:', password);
    
  } catch (error) {
    console.error('❌ Failed to create test user:', error);
  }
}

// Run the function
createTestUser();
