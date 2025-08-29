# Email функционал для Kracken

## Обзор

Этот документ описывает как настроить email функционал для вашего мессенджера Kracken. Поддержка GitHub OAuth удалена.

**🌐 Продакшн сервер**: https://krackenx.onrender.com

## 🚀 Возможности

<!-- GitHub OAuth раздел удален -->

### Email функционал
- ✅ Приветственные письма
- ✅ Сброс пароля
- ✅ Уведомления
- ✅ Логирование отправленных писем

## 📋 Требования

### База данных
- PostgreSQL (уже настроена)
- Выполнить миграцию: `node scripts/add-email-logs-migration.js`

### Переменные окружения
Добавьте в ваш `.env` файл:

```env
# JWT для токенов
JWT_SECRET=your_super_secret_jwt_key

# Email (Gmail пример)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Kracken <your_email@gmail.com>
```

<!-- Раздел про GitHub OAuth удален -->

### 1. Включение 2FA

1. Перейдите на [GitHub Developer Settings](https://github.com/settings/developers)
<!-- удалено -->

### 2. Настройка Email (Gmail)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=ваш_app_password
SMTP_FROM=Kracken <your_email@gmail.com>
```

## 📧 Настройка Email (Gmail)

### 1. Включение 2FA
1. Перейдите в [Google Account Settings](https://myaccount.google.com/security)
2. Включите двухфакторную аутентификацию

### 2. Создание App Password
1. В настройках безопасности найдите "App passwords"
2. Выберите "Mail" и "Other (Custom name)"
3. Введите название: "Kracken Messenger"
4. Скопируйте сгенерированный пароль

### 3. Настройка переменных окружения

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=ваш_app_password
SMTP_FROM=Kracken <your_email@gmail.com>
```

## 🚀 Запуск

### 1. Установка зависимостей

```bash
npm install
```

### 2. Выполнение миграции

```bash
node scripts/add-email-logs-migration.js
```

### 3. Запуск сервера

```bash
npm run dev
```

## 📡 API Endpoints

<!-- GitHub OAuth эндпоинты удалены -->

### Email
- `POST /api/email/send` - Отправка email

### Тестовые эндпоинты (для продакшн)
- `POST /api/test/email` - Тестовая отправка email
- `POST /api/test/oauth-register` - Тестовая регистрация OAuth пользователя
<!-- Удален endpoint теста GitHub OAuth -->

Пример использования email API:

```javascript
// Отправка приветственного письма
fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        template: 'welcome',
        to: 'user@example.com',
        data: { username: 'John' }
    })
});

// Отправка сброса пароля
fetch('/api/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        template: 'passwordReset',
        to: 'user@example.com',
        data: { resetLink: 'https://krackenx.onrender.com/reset?token=abc123' }
    })
});

// Тестирование OAuth конфигурации удалено

// Тестирование email отправки
fetch('https://krackenx.onrender.com/api/test/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        template: 'welcome',
        to: 'test@example.com',
        data: { username: 'TestUser' }
    })
})
.then(response => response.json())
.then(data => console.log('Email test result:', data));
```

## 🔒 Безопасность

<!-- Раздел безопасности OAuth удален -->

### Email безопасность
- ✅ Валидация email адресов
- ✅ Rate limiting на отправку
- ✅ Логирование всех отправок
- ✅ Защита от спама

## 📊 Мониторинг

### Логи email
Все отправленные письма логируются в таблицу `email_logs`:

```sql
SELECT * FROM email_logs ORDER BY sent_at DESC LIMIT 10;
```

<!-- Статистика OAuth удалена -->

## 🐛 Устранение неполадок

<!-- Траблшут GitHub OAuth удален -->

### Email не отправляется
1. Проверьте SMTP настройки
2. Убедитесь, что включена 2FA в Gmail
3. Используйте App Password, а не обычный пароль
4. Проверьте логи в таблице `email_logs`

### Тестирование email
```bash
# Проверка конфигурации
node -e "
const { verifyEmailConfig } = require('./utils/email');
verifyEmailConfig().then(console.log);
"
```

## 📈 Производительность

### PostgreSQL нагрузка
- **Email**: ~1 запрос на отправку
- **Логи**: ~1 запрос на письмо

### Масштабируемость
- PostgreSQL легко потянет **миллионы пользователей**
- Email отправка: **1000+ писем в час** (зависит от SMTP провайдера)
<!-- OAuth масштабируемость удалена -->

## 💡 Рекомендации

### Для продакшена
1. Используйте отдельный email домен
2. Настройте SPF/DKIM записи
3. Используйте Redis для кэширования
4. Настройте мониторинг

### Для разработки
1. Используйте Mailtrap для тестирования
<!-- Локальные GitHub OAuth настройки удалены -->
3. Отладочные логи

## 🔄 Обновления

### Добавление новых email шаблонов
1. Добавьте шаблон в `utils/email.js`
2. Обновите API endpoint
3. Протестируйте

<!-- Добавление других OAuth провайдеров удалено -->

---

**PostgreSQL отлично справляется с этими задачами!** 🚀
