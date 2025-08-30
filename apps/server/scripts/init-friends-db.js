const { query } = require('../utils/db.js');

async function initFriendsDatabase() {
    try {
        console.log('Initializing friends system database...');
        
        // Create friends table
        await query(`
            CREATE TABLE IF NOT EXISTS friends (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(user_id, friend_id)
            );
        `);
        console.log('✅ Friends table created/verified');
        
        // Create friend requests table
        await query(`
            CREATE TABLE IF NOT EXISTS friend_requests (
                id SERIAL PRIMARY KEY,
                from_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                to_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(from_user_id, to_user_id)
            );
        `);
        console.log('✅ Friend requests table created/verified');
        
        // Create indexes for better performance
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user_id ON friend_requests(to_user_id);`);
        await query(`CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON friend_requests(status);`);
        console.log('✅ Indexes created/verified');
        
        console.log('🎉 Friends system database initialized successfully!');
        
    } catch (error) {
        console.error('❌ Error initializing friends database:', error);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    initFriendsDatabase()
        .then(() => {
            console.log('Database initialization completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Database initialization failed:', error);
            process.exit(1);
        });
}

module.exports = initFriendsDatabase;
