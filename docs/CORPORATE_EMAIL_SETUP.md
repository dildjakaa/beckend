# Настройка корпоративного email и GitHub OAuth для Kracken

## 🚀 Быстрый старт

### 1. Автоматическая настройка email

Запустите скрипт настройки:

```bash
cd apps/server
node scripts/setup-corporate-email.js
```

Следуйте инструкциям в скрипте для настройки вашего корпоративного email.

### 2. Ручная настройка

Если предпочитаете ручную настройку, создайте файл `.env` в папке `apps/server/`:

```env
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://krackenx.onrender.com/api/auth/github/callback

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here

# Email Configuration (Corporate Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_corporate_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=Kracken <your_corporate_email@gmail.com>

# Frontend URL
FRONTEND_URL=https://krackenx.onrender.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://username:password@localhost:5432/kracken_db

# Server Configuration
PORT=3000
NODE_ENV=development
```

## 📧 Настройка корпоративного email

### Шаг 1: Включение двухфакторной аутентификации

1. Перейдите в [Google Account Settings](https://myaccount.google.com/security)
2. Найдите "2-Step Verification" и включите его
3. Следуйте инструкциям для настройки

### Шаг 2: Создание App Password

1. В настройках безопасности найдите "App passwords"
2. Нажмите "Create new app password"
3. Выберите "Mail" и введите название: "Kracken Messenger"
4. Скопируйте сгенерированный 16-символьный пароль

### Шаг 3: Настройка переменных окружения

В файле `.env` замените:

```env
SMTP_USER=your_corporate_email@gmail.com
SMTP_PASS=ваш_16_символьный_app_password
SMTP_FROM=Kracken <your_corporate_email@gmail.com>
```

## 🔐 Настройка GitHub OAuth

### Шаг 1: Создание GitHub OAuth App

1. Перейдите на [GitHub Developer Settings](https://github.com/settings/developers)
2. Нажмите "New OAuth App"
3. Заполните форму:
   - **Application name**: Kracken Messenger
   - **Homepage URL**: `https://krackenx.onrender.com` (для продакшена)
- **Authorization callback URL**: `https://krackenx.onrender.com/api/auth/github/callback`
4. Нажмите "Register application"
5. Скопируйте `Client ID` и `Client Secret`

### Шаг 2: Настройка переменных окружения

В файле `.env` замените:

```env
GITHUB_CLIENT_ID=ваш_client_id
GITHUB_CLIENT_SECRET=ваш_client_secret
```

### Шаг 3: Генерация JWT секрета

Создайте случайный JWT секрет:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

И замените в `.env`:

```env
JWT_SECRET=сгенерированный_секрет
```

## 🧪 Тестирование

### Тест email конфигурации

```bash
curl -X POST https://krackenx.onrender.com/api/test/email \
  -H "Content-Type: application/json" \
  -d '{
    "template": "test",
    "to": "test@example.com"
  }'
```

### Тест GitHub OAuth конфигурации

```bash
curl https://krackenx.onrender.com/api/test/github-oauth
```

### Тест полного OAuth flow

1. Откройте в браузере: `https://krackenx.onrender.com/api/auth/github`
2. Авторизуйтесь через GitHub
3. Проверьте, что вы перенаправлены обратно с токеном

## 📋 Проверка работоспособности

### 1. Проверка email отправки

После настройки email должен работать автоматически:

- ✅ Приветственные письма для новых пользователей
- ✅ Письма подтверждения email
- ✅ Письма сброса пароля
- ✅ Уведомления

### 2. Проверка GitHub OAuth

- ✅ Регистрация через GitHub
- ✅ Автоматическое получение email и аватара
- ✅ Создание JWT токена
- ✅ Добавление в общий чат

## 🔧 Устранение неполадок

### Email не отправляется

1. **Проверьте SMTP настройки**:
   ```bash
   curl -X POST https://krackenx.onrender.com/api/test/email \
     -H "Content-Type: application/json" \
     -d '{"template": "test", "to": "your@email.com"}'
   ```

2. **Убедитесь, что включена 2FA** в Google аккаунте

3. **Используйте App Password**, а не обычный пароль

4. **Проверьте логи сервера** на наличие ошибок

### GitHub OAuth не работает

1. **Проверьте конфигурацию**:
   ```bash
   curl https://krackenx.onrender.com/api/test/github-oauth
   ```

2. **Убедитесь, что callback URL совпадает** с настройками в GitHub

3. **Проверьте правильность Client ID и Secret**

4. **Проверьте логи сервера** на наличие ошибок

### Ошибки базы данных

1. **Выполните миграции**:
   ```bash
   npm run migrate-db
   ```

2. **Проверьте подключение к базе данных**

3. **Убедитесь, что таблицы созданы**

## 🚀 Продакшн настройка

### Для продакшна измените:

```env
GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/github/callback
FRONTEND_URL=https://yourdomain.com
NODE_ENV=production
```

### Настройка домена в GitHub OAuth App

1. Обновите Homepage URL на ваш домен
2. Обновите Authorization callback URL
3. Перезапустите сервер

## 📊 Мониторинг

### Логи email отправки

Все отправленные письма логируются в консоль сервера.

### Статистика OAuth

```sql
SELECT 
    is_oauth_user,
    COUNT(*) as user_count
FROM users 
GROUP BY is_oauth_user;
```

## 💡 Рекомендации

### Безопасность

1. **Никогда не коммитьте `.env` файл** в git
2. **Используйте разные JWT секреты** для разработки и продакшна
3. **Регулярно обновляйте App Password**
4. **Используйте HTTPS** в продакшне

### Производительность

1. **Настройте кэширование** для GitHub API
2. **Используйте очереди** для отправки email
3. **Мониторьте лимиты** GitHub API

---

**🎉 Готово!** Ваш Kracken Messenger теперь настроен для работы с корпоративным email и GitHub OAuth!
