const { query } = require('../../utils/db.js');
const { comparePassword } = require('../../utils/hash.js');
const { success, badRequest, unauthorized, serverError } = require('../../utils/response.js');
const jwt = require('jsonwebtoken');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, email, password } = req.body;
    
    console.log('Login attempt:', { username, email, hasPassword: !!password });

    // Validate input
    if ((!username && !email) || !password) {
      console.log('Login validation failed: missing fields');
      return badRequest(res, 'Имя пользователя или email и пароль обязательны');
    }

    // Find user
    const lookupBy = username ? 'username' : 'email';
    const value = username || email;
    console.log('Looking up user by:', lookupBy, 'value:', value);
    
    const userResult = await query(
      `SELECT id, username, password_hash, avatar_url, email, email_verified, created_at, last_seen, is_oauth_user FROM users WHERE ${lookupBy} = $1`,
      [value]
    );

    if (userResult.rows.length === 0) {
      console.log('User not found');
      return unauthorized(res, 'Неверное имя пользователя или пароль');
    }

    const user = userResult.rows[0];
    console.log('User found:', { id: user.id, username: user.username, email: user.email, emailVerified: user.email_verified, isOAuth: user.is_oauth_user });

    // Check if email is verified (for non-OAuth users)
    if (user.email && !user.email_verified && !user.is_oauth_user) {
      console.log('Email not verified');
      return unauthorized(res, 'Пожалуйста, подтвердите ваш email перед входом');
    }

    // Verify password
    console.log('Comparing passwords:', { inputPassword: password, storedHash: user.password_hash });
    const passwordMatch = comparePassword(password, user.password_hash);
    console.log('Password match result:', passwordMatch);
    
    if (!passwordMatch) {
      console.log('Password verification failed');
      return unauthorized(res, 'Неверное имя пользователя или пароль');
    }

    // Update last seen
    await query(
      'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Update avatar URL if not set (for backward compatibility)
    if (!user.avatar_url) {
      const avatarSeed = (user.username || '').toString().toLowerCase();
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}&backgroundColor=6366f1`;
      await query(
        'UPDATE users SET avatar_url = $1 WHERE id = $2',
        [avatarUrl, user.id]
      );
      user.avatar_url = avatarUrl;
    }

    // Ensure user is in general chat room (room_id = 1)
    await query(
      'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
      [1, user.id]
    );

    // Issue JWT token for client to store and use over sockets
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return success(res, { 
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return serverError(res, 'Ошибка при входе');
  }
}
