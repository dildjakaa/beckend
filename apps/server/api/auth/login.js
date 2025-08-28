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

    // Validate input
    if ((!username && !email) || !password) {
      return badRequest(res, 'Имя пользователя или email и пароль обязательны');
    }

    // Find user
    const lookupBy = username ? 'username' : 'email';
    const value = username || email;
    const userResult = await query(
      `SELECT id, username, password_hash, avatar_url, email, email_verified, created_at, last_seen, is_oauth_user FROM users WHERE ${lookupBy} = $1`,
      [value]
    );

    if (userResult.rows.length === 0) {
      return unauthorized(res, 'Неверное имя пользователя или пароль');
    }

    const user = userResult.rows[0];

    // Check if email is verified (for non-OAuth users)
    if (user.email && !user.email_verified && !user.is_oauth_user) {
      return unauthorized(res, 'Пожалуйста, подтвердите ваш email перед входом');
    }

    // Verify password
    if (!comparePassword(password, user.password_hash)) {
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

    return success(res, { token });

  } catch (error) {
    console.error('Login error:', error);
    return serverError(res, 'Ошибка при входе');
  }
}
