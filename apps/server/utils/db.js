const { Pool } = require('pg');

// Global connection pool and boot-time migration
let pool;
let bootMigrationPromise;
let dbAvailable = false;

async function runBootMigrations(client) {
  try {
    // Ensure base users table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT,
        email VARCHAR(255) UNIQUE,
        github_id VARCHAR(255) UNIQUE,
        avatar_url TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        verification_code VARCHAR(10),
        verification_code_expires TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_oauth_user BOOLEAN DEFAULT FALSE
      )
    `);

    // Ensure required columns exist (idempotent)
    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS verification_code VARCHAR(10),
      ADD COLUMN IF NOT EXISTS verification_code_expires TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS is_oauth_user BOOLEAN DEFAULT FALSE
    `);
    
    dbAvailable = true;
    console.log('✅ Database connection and migrations successful');
  } catch (err) {
    // Log but don't rethrow - we'll handle this gracefully
    console.error('Boot migration error:', err);
    dbAvailable = false;
    console.log('⚠️ Database unavailable, some features will be limited');
  }
}

function getPool() {
  if (!pool) {
    try {
      pool = new Pool({
        connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'backend1_8r17'}`,
        max: parseInt(process.env.DB_POOL_MAX || '5', 10),
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 15000,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      });

      pool.on('error', (err) => {
        console.error('Database pool error:', err);
        dbAvailable = false;
      });

      // Kick off boot migrations once, using the same pool
      bootMigrationPromise = runBootMigrations(pool);
    } catch (err) {
      console.error('Failed to create database pool:', err);
      dbAvailable = false;
    }
  }

  return pool;
}

// Export query function for easy use
async function query(text, params) {
  if (!dbAvailable) {
    console.warn('Database unavailable, query skipped:', text);
    // Return a mock result to prevent crashes
    return { rows: [], rowCount: 0 };
  }
  
  const client = getPool();
  if (!client) {
    console.warn('No database pool available, query skipped:', text);
    return { rows: [], rowCount: 0 };
  }
  
  // Ensure migrations completed before any query
  if (bootMigrationPromise) {
    try {
      await bootMigrationPromise;
    } catch (e) {
      console.warn('Database migrations failed, continuing with limited functionality');
      dbAvailable = false;
      return { rows: [], rowCount: 0 };
    }
  }
  
  try {
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err);
    // Don't throw - return empty result to prevent crashes
    return { rows: [], rowCount: 0 };
  }
}

// Check if database is available
function isDatabaseAvailable() {
  return dbAvailable;
}

module.exports = { query, getPool, isDatabaseAvailable };

