const { query } = require('../../utils/db.js');
const { success, badRequest, unauthorized, serverError } = require('../../utils/response.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, code } = req.body;

    // Normalize input (email trimmed, code digits-only)
    const normalizedEmail = email ? String(email).trim() : '';
    const normalizedCode = String(code).replace(/\D/g, '').slice(0, 6);

    if (!normalizedEmail || !normalizedCode || normalizedCode.length !== 6) {
      return badRequest(res, 'Неверные данные');
    }

    // Find user by email and code
    const userResult = await query(
      `SELECT id, username, email, email_verified, verification_code, verification_code_expires 
       FROM users WHERE LOWER(email) = LOWER($1) AND verification_code = $2`,
      [normalizedEmail, normalizedCode]
    );

    if (userResult.rows.length === 0) {
      return unauthorized(res, 'Неверный код подтверждения');
    }

    const user = userResult.rows[0];

    // Check if code is expired
    if (!user.verification_code_expires || new Date() > new Date(user.verification_code_expires)) {
      return unauthorized(res, 'Код подтверждения истек. Запросите новый код.');
    }

    // Mark email verified if not yet, and clear code
    await query(
      `UPDATE users 
       SET email_verified = true, 
           verification_code = NULL, 
           verification_code_expires = NULL, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );

    // Ensure user is in general room
    await query(
      'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
      [1, user.id]
    );

    // Issue JWT token for login-by-email flow
    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    return success(res, { message: 'Email подтвержден', token });
  } catch (error) {
    console.error('Login email verify error:', error);
    return serverError(res, 'Ошибка при подтверждении email');
  }
}


