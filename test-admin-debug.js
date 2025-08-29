const fetch = require('node-fetch');

const API_BASE = 'https://krackenx.onrender.com/api/admin';
const ADMIN_PASSWORD = '909the909';

async function testAdminDebug() {
    console.log('🔍 Детальная диагностика админ API...\n');

    // Тест 1: Проверка с правильным паролем и детальным логированием
    console.log('1️⃣ Тест с правильным паролем (детальная диагностика)...');
    try {
        console.log('   📤 Отправка запроса...');
        console.log('   📋 Headers:', {
            'Content-Type': 'application/json',
            'X-Admin-Password': ADMIN_PASSWORD
        });
        console.log('   📝 Body:', { message: 'Тест диагностики - ' + new Date().toISOString() });

        const response = await fetch(`${API_BASE}/send-support-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': ADMIN_PASSWORD
            },
            body: JSON.stringify({ 
                message: 'Тест диагностики - ' + new Date().toISOString()
            })
        });

        console.log(`   📊 Статус: ${response.status} ${response.statusText}`);
        console.log(`   📋 Response Headers:`, Object.fromEntries(response.headers.entries()));
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            const error = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log(`   ❌ Ошибка: ${JSON.stringify(error, null, 2)}`);
            
            // Если это 500 ошибка, попробуем получить больше деталей
            if (response.status === 500) {
                console.log('   🔍 Анализ 500 ошибки:');
                console.log('   💡 Возможные причины:');
                console.log('      - Проблемы с базой данных');
                console.log('      - Ошибки в коде сервера');
                console.log('      - Проблемы с переменными окружения');
                console.log('      - Ошибки при создании пользователя KrackenX Support');
            }
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
        console.log(`   🔍 Детали ошибки:`, error);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 2: Проверка других админ endpoints
    console.log('2️⃣ Тест других админ endpoints...');
    
    const endpoints = [
        { method: 'GET', path: '/logs', name: 'Получение логов' },
        { method: 'POST', path: '/clear-logs', name: 'Очистка логов', body: {} },
        { method: 'POST', path: '/delete-messages', name: 'Удаление сообщений', body: {} },
        { method: 'POST', path: '/delete-users', name: 'Удаление пользователей', body: {} }
    ];

    for (const endpoint of endpoints) {
        console.log(`   🔍 Тестирование: ${endpoint.name}`);
        try {
            const options = {
                method: endpoint.method,
                headers: {
                    'X-Admin-Password': ADMIN_PASSWORD
                }
            };

            if (endpoint.body) {
                options.headers['Content-Type'] = 'application/json';
                options.body = JSON.stringify(endpoint.body);
            }

            const response = await fetch(`${API_BASE}${endpoint.path}`, options);
            console.log(`      📊 Статус: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json();
                console.log(`      ✅ Успех: ${JSON.stringify(data, null, 2)}`);
            } else {
                const error = await response.json().catch(() => 'Не удалось прочитать ответ');
                console.log(`      ❌ Ошибка: ${JSON.stringify(error, null, 2)}`);
            }
        } catch (error) {
            console.log(`      ❌ Ошибка сети: ${error.message}`);
        }
        console.log('');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 3: Проверка health endpoints
    console.log('3️⃣ Тест health endpoints...');
    
    const healthEndpoints = [
        '/api',
        '/api/health',
        '/api/ping'
    ];

    for (const endpoint of healthEndpoints) {
        console.log(`   🔍 Тестирование: ${endpoint}`);
        try {
            const response = await fetch(`https://krackenx.onrender.com${endpoint}`);
            console.log(`      📊 Статус: ${response.status} ${response.statusText}`);
            
            if (response.ok) {
                const data = await response.json().catch(() => 'HTML ответ');
                console.log(`      ✅ Успех: ${JSON.stringify(data, null, 2)}`);
            } else {
                console.log(`      ❌ Ошибка: ${response.statusText}`);
            }
        } catch (error) {
            console.log(`      ❌ Ошибка сети: ${error.message}`);
        }
        console.log('');
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 4: Рекомендации
    console.log('4️⃣ Рекомендации по исправлению...');
    console.log('   💡 Если все админ endpoints возвращают 500:');
    console.log('      1. Проверьте логи сервера на Render');
    console.log('      2. Убедитесь, что переменная ADMIN_PASSWORD установлена');
    console.log('      3. Проверьте подключение к базе данных');
    console.log('      4. Убедитесь, что таблицы users и messages существуют');
    console.log('      5. Проверьте, что пользователь KrackenX Support может быть создан');
    console.log('');
    console.log('   🔧 Для проверки на Render:');
    console.log('      1. Зайдите в панель управления Render');
    console.log('      2. Выберите ваш сервис krackenx');
    console.log('      3. Перейдите в раздел "Logs"');
    console.log('      4. Посмотрите на ошибки при отправке админ запросов');
}

// Запуск тестов
testAdminDebug().catch(console.error);
