const { query } = require('../../utils/db.js');
const { success, badRequest, serverError } = require('../../utils/response.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { code, email } = req.body;

    // Normalize input (strip spaces and non-digits from code)
    const normalizedEmail = email ? String(email).trim() : null;
    const normalizedCode = String(code).replace(/\D/g, '').slice(0, 6);

    // Validation: must be exactly 6 digits
    if (!normalizedCode || normalizedCode.length !== 6) {
      return badRequest(res, 'Неверный код подтверждения');
    }

    let user;

    if (normalizedEmail) {
      // Primary: find by email first to produce clearer errors
      const byEmail = await query(
        `SELECT id, username, email, email_verified, verification_code, verification_code_expires 
         FROM users WHERE LOWER(email) = LOWER($1)`,
        [normalizedEmail]
      );

      if (byEmail.rows.length === 0) {
        return badRequest(res, 'Пользователь с таким email не найден');
      }

      const candidate = byEmail.rows[0];
      if (candidate.email_verified) {
        return badRequest(res, 'Email уже подтвержден');
      }
      if (String(candidate.verification_code || '').replace(/\D/g, '').slice(0, 6) !== normalizedCode) {
        return badRequest(res, 'Неверный код подтверждения');
      }
      user = candidate;
    } else {
      // Fallback: find by code only (legacy flow)
      const userResult = await query(
        `SELECT id, username, email, verification_code, verification_code_expires 
         FROM users 
         WHERE verification_code = $1 AND email_verified = false`,
        [normalizedCode]
      );

      if (userResult.rows.length === 0) {
        return badRequest(res, 'Неверный код подтверждения');
      }
      user = userResult.rows[0];
    }

    // Check if code is expired
    if (new Date() > new Date(user.verification_code_expires)) {
      return badRequest(res, 'Код подтверждения истек. Запросите новый код.');
    }

    // Verify email and clear verification code
    console.log('Verifying email for user:', { id: user.id, username: user.username, email: user.email });
    await query(
      `UPDATE users 
       SET email_verified = true, 
           verification_code = NULL, 
           verification_code_expires = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [user.id]
    );
    console.log('Email verified successfully for user:', user.id);

    // Add user to general chat room
    await query(
      'INSERT INTO chat_room_participants (room_id, user_id) VALUES ($1, $2) ON CONFLICT (room_id, user_id) DO NOTHING',
      [1, user.id]
    );

    return success(res, {
      message: 'Email успешно подтвержден',
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return serverError(res, 'Ошибка при подтверждении email');
  }
}
