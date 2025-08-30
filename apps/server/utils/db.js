const { Pool } = require('pg');

// Global connection pool and boot-time migration
let pool;
let bootMigrationPromise;

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
  } catch (err) {
    // Log but rethrow so callers see failure and can act accordingly
    console.error('Boot migration error:', err);
    throw err;
  }
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'password'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'backend1_8r17'}`,
      max: parseInt(process.env.DB_POOL_MAX || '5', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    pool.on('error', (err) => {
      console.error('Database pool error:', err);
    });

    // Kick off boot migrations once, using the same pool
    bootMigrationPromise = runBootMigrations(pool);
  }

  return pool;
}

// Export query function for easy use
async function query(text, params) {
  const client = getPool();
  // Ensure migrations completed before any query
  if (bootMigrationPromise) {
    await bootMigrationPromise.catch((e) => {
      // Surface the error to the caller to avoid silent failures
      throw e;
    });
  }
  try {
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  }
}

module.exports = { query, getPool };
