#!/usr/bin/env node

/**
 * Тест локального сервера
 */

const LOCAL_SERVER = 'krackenx.onrender.com';

async function testLocalServer() {
    console.log('🧪 Тестирование локального сервера:', LOCAL_SERVER);
    console.log('=' .repeat(50));

    // Тест 1: Health endpoint
    console.log('\n1️⃣ Тестирование health endpoint...');
    try {
        const response = await fetch(`${LOCAL_SERVER}/api/health`);
        console.log('   Статус:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Ответ:', data);
        } else {
            console.log('   ❌ Ошибка HTTP');
        }
    } catch (error) {
        console.log('   ❌ Ошибка сети:', error.message);
        console.log('   💡 Убедитесь, что сервер запущен: cd apps/server && npm start');
        return;
    }

    // Тест 2: Admin logs endpoint
    console.log('\n2️⃣ Тестирование admin logs endpoint...');
    try {
        const response = await fetch(`${LOCAL_SERVER}/api/admin/logs`);
        console.log('   Статус:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Ответ:', data);
        } else {
            console.log('   ❌ Ошибка HTTP');
        }
    } catch (error) {
        console.log('   ❌ Ошибка сети:', error.message);
    }

    // Тест 3: Admin delete messages endpoint
    console.log('\n3️⃣ Тестирование admin delete messages endpoint...');
    try {
        const response = await fetch(`${LOCAL_SERVER}/api/admin/delete-messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({})
        });
        console.log('   Статус:', response.status, response.statusText);
        
        if (response.ok) {
            const data = await response.json();
            console.log('   ✅ Ответ:', data);
        } else {
            const data = await response.json().catch(() => 'Не удалось прочитать ответ');
            console.log('   ❌ Ошибка HTTP:', data);
        }
    } catch (error) {
        console.log('   ❌ Ошибка сети:', error.message);
    }

    // Тест 4: Админ панель
    console.log('\n4️⃣ Тестирование админ панели...');
    try {
        const response = await fetch(`${LOCAL_SERVER}/admin`);
        console.log('   Статус:', response.status, response.statusText);
        
        if (response.ok) {
            console.log('   ✅ Админ панель доступна');
        } else {
            console.log('   ❌ Ошибка HTTP');
        }
    } catch (error) {
        console.log('   ❌ Ошибка сети:', error.message);
    }

    console.log('\n' + '=' .repeat(50));
    console.log('🎯 Тестирование завершено!');
}

// Запускаем тест
testLocalServer().catch(console.error);
