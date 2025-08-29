const { query } = require('../utils/db.js');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    console.log('Initializing database...');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute schema
    await query(schema);
    
    // Create a test user if it doesn't exist
    const testUserResult = await query(
      'SELECT id FROM users WHERE username = $1',
      ['testuser']
    );
    
    if (testUserResult.rows.length === 0) {
      console.log('Creating test user...');
      await query(
        'INSERT INTO users (username, password_hash, email) VALUES ($1, $2, $3)',
        ['testuser', '$2b$10$test.hash.for.testing', 'test@example.com']
      );
    }
    
    // Ensure general chat room exists
    const generalRoomResult = await query(
      'SELECT id FROM chat_rooms WHERE id = 1'
    );
    
    if (generalRoomResult.rows.length === 0) {
      console.log('Creating general chat room...');
      await query(
        'INSERT INTO chat_rooms (id, name, room_type) VALUES (1, $1, $2)',
        ['General', 'general']
      );
    }
    
    console.log('Database initialized successfully!');
    
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  initDatabase().then(() => {
    console.log('Database initialization complete');
    process.exit(0);
  }).catch((error) => {
    console.error('Database initialization failed:', error);
    process.exit(1);
  });
}

module.exports = { initDatabase };
