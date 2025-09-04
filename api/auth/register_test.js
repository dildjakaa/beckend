const { query } = require('../../utils/db_test.js');
const bcrypt = require('bcrypt');
const { sendVerificationEmail } = require('../../utils/email.js');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, email, password, tosAccepted } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ success: false, error: 'Все поля обязательны для заполнения' });
    }

    if (!tosAccepted) {
      return res.status(400).json({ success: false, error: 'Прими условия соглашения и политику конфиденциальности' });
    }

    if (username.length < 3) {
      return res.status(400).json({ success: false, error: 'Имя пользователя должно содержать минимум 3 символа' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'Пароль должен содержать минимум 6 символов' });
    }

    if (!email.includes('@')) {
      return res.status(400).json({ success: false, error: 'Пожалуйста, введите корректный email' });
    }

    // Check if username already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE username = ?',
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Пользователь с таким именем уже существует' });
    }

    // Check if email already exists
    const existingEmail = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingEmail.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'Пользователь с таким email уже существует' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Create user with email_verified = false
    const newUser = await query(
      `INSERT INTO users (username, email, password_hash, email_verified, verification_code, verification_code_expires) 
       VALUES (?, ?, ?, 0, ?, datetime('now', '+15 minutes'))`,
      [username, email, hashedPassword, verificationCode]
    );

    // Send verification email
    try {
      await sendVerificationEmail(email, username, verificationCode);
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Delete the user if email sending fails
      await query('DELETE FROM users WHERE id = ?', [newUser.rows[0].id]);
      return res.status(500).json({ success: false, error: 'Ошибка при отправке email. Попробуйте позже.' });
    }

    return res.json({
      success: true,
      message: 'Код подтверждения отправлен на ваш email',
      userId: newUser.rows[0].id
    });

  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, error: 'Ошибка при регистрации' });
  }
};
