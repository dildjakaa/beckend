const { query } = require('./apps/server/utils/db.js');

async function testDatabaseConnection() {
    console.log('🗄️ Тестирование подключения к базе данных...\n');

    try {
        // Тест 1: Простой запрос
        console.log('1️⃣ Тест простого запроса...');
        const result = await query('SELECT NOW() as current_time');
        console.log(`   ✅ Успех: ${result.rows[0].current_time}`);
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
        return;
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 2: Проверка таблицы users
    console.log('2️⃣ Тест таблицы users...');
    try {
        const result = await query('SELECT COUNT(*) as user_count FROM users');
        console.log(`   ✅ Успех: ${result.rows[0].user_count} пользователей в базе`);
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 3: Проверка таблицы messages
    console.log('3️⃣ Тест таблицы messages...');
    try {
        const result = await query('SELECT COUNT(*) as message_count FROM messages');
        console.log(`   ✅ Успех: ${result.rows[0].message_count} сообщений в базе`);
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 4: Проверка пользователя KrackenX Support
    console.log('4️⃣ Тест пользователя KrackenX Support...');
    try {
        const result = await query('SELECT id, username, is_oauth_user, email_verified FROM users WHERE username = $1', ['KrackenX Support']);
        if (result.rows.length > 0) {
            const user = result.rows[0];
            console.log(`   ✅ Пользователь найден: ID=${user.id}, username=${user.username}, is_oauth_user=${user.is_oauth_user}, email_verified=${user.email_verified}`);
        } else {
            console.log('   ⚠️ Пользователь KrackenX Support не найден');
        }
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 5: Попытка создать пользователя KrackenX Support
    console.log('5️⃣ Тест создания пользователя KrackenX Support...');
    try {
        const result = await query(
            'INSERT INTO users (username, is_oauth_user, email_verified) VALUES ($1, $2, $3) ON CONFLICT (username) DO UPDATE SET is_oauth_user = $2, email_verified = $3 RETURNING id, username',
            ['KrackenX Support', true, true]
        );
        console.log(`   ✅ Успех: ${result.rows[0].username} с ID ${result.rows[0].id}`);
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 6: Попытка вставить тестовое сообщение
    console.log('6️⃣ Тест вставки сообщения...');
    try {
        // Сначала получим ID пользователя KrackenX Support
        const userResult = await query('SELECT id FROM users WHERE username = $1', ['KrackenX Support']);
        if (userResult.rows.length > 0) {
            const userId = userResult.rows[0].id;
            const messageResult = await query(
                'INSERT INTO messages (user_id, room_id, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING id',
                [userId, 1, 'Тестовое сообщение от поддержки', new Date()]
            );
            console.log(`   ✅ Успех: Сообщение вставлено с ID ${messageResult.rows[0].id}`);
            
            // Удалим тестовое сообщение
            await query('DELETE FROM messages WHERE id = $1', [messageResult.rows[0].id]);
            console.log('   ✅ Тестовое сообщение удалено');
        } else {
            console.log('   ❌ Пользователь KrackenX Support не найден для теста');
        }
    } catch (error) {
        console.log(`   ❌ Ошибка: ${error.message}`);
    }
}

// Запуск тестов
testDatabaseConnection().catch(console.error);
