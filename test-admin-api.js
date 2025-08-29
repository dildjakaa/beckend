#!/usr/bin/env node

/**
 * Тестовый скрипт для проверки админ API endpoints
 * Запуск: node test-admin-api.js
 */

const fetch = require('node-fetch');

const API_BASE = 'https://krackenx.onrender.com/api/admin';
const ADMIN_PASSWORD = '909the909'; // Используйте тот же пароль, что и в .env

async function testAdminAPI() {
    console.log('🧪 Тестирование админ API...\n');

    // Тест 1: Отправка сообщения поддержки
    console.log('1️⃣ Тестирование отправки сообщения поддержки...');
    try {
        const response = await fetch(`${API_BASE}/send-support-message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Password': ADMIN_PASSWORD
            },
            body: JSON.stringify({ 
                message: 'Тестовое сообщение от поддержки - ' + new Date().toISOString()
            })
        });

        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            const error = await response.json();
            console.log(`   ❌ Ошибка: ${JSON.stringify(error, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 2: Получение логов
    console.log('2️⃣ Тестирование получения логов...');
    try {
        const response = await fetch(`${API_BASE}/logs`, {
            method: 'GET',
            headers: {
                'X-Admin-Password': ADMIN_PASSWORD
            }
        });

        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            const error = await response.json();
            console.log(`   ❌ Ошибка: ${JSON.stringify(error, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 3: Проверка без пароля (должно вернуть 401)
    console.log('3️⃣ Тестирование без пароля (ожидается 401)...');
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
        } else {
            const data = await response.json();
            console.log(`   ❌ Неожиданный ответ: ${JSON.stringify(data, null, 2)}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }
}

// Запуск тестов
testAdminAPI().catch(console.error);
