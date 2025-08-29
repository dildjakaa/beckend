const fetch = require('node-fetch');

const API_BASE = 'https://krackenx.onrender.com/api/admin';

async function testAdminAuth() {
    console.log('🔐 Тестирование авторизации админ API...\n');

    // Тест 1: Без пароля
    console.log('1️⃣ Тест без пароля...');
    try {
        const response = await fetch(`${API_BASE}/send-support-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                message: 'Тест без пароля'
            })
        });

        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
            console.log('   ✅ Правильно: Получен статус 401 (Unauthorized)');
        } else if (response.status === 500) {
            const error = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ⚠️ Получен статус 500: ${JSON.stringify(error, null, 2)}`);
        } else {
            const data = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ❌ Неожиданный статус: ${JSON.stringify(data, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 2: С неправильным паролем
    console.log('2️⃣ Тест с неправильным паролем...');
    try {
        const response = await fetch(`${API_BASE}/send-support-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': 'wrongpassword'
            },
            body: JSON.stringify({ 
                message: 'Тест с неправильным паролем'
            })
        });

        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.status === 401) {
            console.log('   ✅ Правильно: Получен статус 401 (Unauthorized)');
        } else if (response.status === 500) {
            const error = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ⚠️ Получен статус 500: ${JSON.stringify(error, null, 2)}`);
        } else {
            const data = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ❌ Неожиданный статус: ${JSON.stringify(data, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 3: С правильным паролем (если знаем)
    console.log('3️⃣ Тест с правильным паролем...');
    try {
        const response = await fetch(`${API_BASE}/send-support-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': '909the909'
            },
            body: JSON.stringify({ 
                message: 'Тест с правильным паролем - ' + new Date().toISOString()
            })
        });

        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else if (response.status === 401) {
            console.log('   ❌ Неправильный пароль или переменная ADMIN_PASSWORD не установлена');
        } else if (response.status === 500) {
            const error = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ⚠️ Получен статус 500: ${JSON.stringify(error, null, 2)}`);
        } else {
            const data = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ❌ Неожиданный статус: ${JSON.stringify(data, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 4: Проверка переменной окружения
    console.log('4️⃣ Проверка переменной окружения ADMIN_PASSWORD...');
    console.log('   💡 Если все тесты возвращают 500, возможно переменная ADMIN_PASSWORD не установлена на сервере');
    console.log('   💡 Проверьте настройки Render: Environment Variables');
    console.log('   💡 Добавьте: ADMIN_PASSWORD = admin123 (или другой пароль)');
}

// Запуск тестов
testAdminAuth().catch(console.error);
