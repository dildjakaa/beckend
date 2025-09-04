const sqlite3 = require('sqlite3').verbose();

// SQLite database
const db = new sqlite3.Database(':memory:');

// Initialize database
db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        email TEXT UNIQUE,
        github_id TEXT UNIQUE,
        avatar_url TEXT,
        email_verified INTEGER DEFAULT 0,
        verification_code TEXT,
        verification_code_expires DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_oauth_user INTEGER DEFAULT 0
    )`);
    
    // Chat rooms table
    db.run(`CREATE TABLE chat_rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        room_type TEXT DEFAULT 'general',
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(created_by) REFERENCES users(id)
    )`);
    
    // Messages table  
    db.run(`CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL DEFAULT 1,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(room_id) REFERENCES chat_rooms(id)
    )`);
    
    // Chat room participants
    db.run(`CREATE TABLE chat_room_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(room_id) REFERENCES chat_rooms(id),
        FOREIGN KEY(user_id) REFERENCES users(id),
        UNIQUE(room_id, user_id)
    )`);
    
    // Insert default general room
    db.run("INSERT INTO chat_rooms (id, name, room_type) VALUES (1, 'General Chat', 'general')");
});

module.exports = db;
