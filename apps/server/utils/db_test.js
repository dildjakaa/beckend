const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create SQLite database
const dbPath = path.join(__dirname, '..', 'test.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
function initializeDatabase() {
    return new Promise((resolve, reject) => {
        // Create users table
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                email TEXT UNIQUE,
                github_id TEXT UNIQUE,
                avatar_url TEXT,
                email_verified BOOLEAN DEFAULT 0,
                verification_code TEXT,
                verification_code_expires TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_oauth_user BOOLEAN DEFAULT 0
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err);
                reject(err);
                return;
            }
            
            // Create chat_rooms table
            db.run(`
                CREATE TABLE IF NOT EXISTS chat_rooms (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    room_type TEXT DEFAULT 'general',
                    created_by INTEGER,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(created_by) REFERENCES users(id)
                )
            `, (err) => {
                if (err) {
                    console.error('Error creating chat_rooms table:', err);
                    reject(err);
                    return;
                }
                
                // Create messages table
                db.run(`
                    CREATE TABLE IF NOT EXISTS messages (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        room_id INTEGER NOT NULL DEFAULT 1,
                        content TEXT NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(user_id) REFERENCES users(id),
                        FOREIGN KEY(room_id) REFERENCES chat_rooms(id)
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating messages table:', err);
                        reject(err);
                        return;
                    }
                    
                    // Create chat_room_participants table
                    db.run(`
                        CREATE TABLE IF NOT EXISTS chat_room_participants (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            room_id INTEGER NOT NULL,
                            user_id INTEGER NOT NULL,
                            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY(room_id) REFERENCES chat_rooms(id),
                            FOREIGN KEY(user_id) REFERENCES users(id),
                            UNIQUE(room_id, user_id)
                        )
                    `, (err) => {
                        if (err) {
                            console.error('Error creating chat_room_participants table:', err);
                            reject(err);
                            return;
                        }
                        
                        // Insert default general room if it doesn't exist
                        db.run(`
                            INSERT OR IGNORE INTO chat_rooms (id, name, room_type) 
                            VALUES (1, 'General Chat', 'general')
                        `, (err) => {
                            if (err) {
                                console.error('Error inserting default room:', err);
                                reject(err);
                                return;
                            }
                            
                            console.log('Database initialized successfully');
                            resolve();
                        });
                    });
                });
            });
        });
    });
}

// Query function for SQLite
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        if (sql.trim().toLowerCase().startsWith('select')) {
            db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ rows });
                }
            });
        } else {
            db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ 
                        rows: [{ id: this.lastID }],
                        rowCount: this.changes 
                    });
                }
            });
        }
    });
}

module.exports = { query, initializeDatabase, db };
