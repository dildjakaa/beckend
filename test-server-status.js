#!/usr/bin/env node

/**
 * Тест статуса сервера и API endpoints
 */

const fetch = require('node-fetch');

async function testServerStatus() {
    console.log('🔍 Проверка статуса сервера...\n');

    const baseUrl = 'https://krackenx.onrender.com';

    // Тест 1: Основной endpoint
    console.log('1️⃣ Тестирование основного endpoint...');
    try {
        const response = await fetch(`${baseUrl}/api`);
        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            console.log(`   ❌ Ошибка: ${response.statusText}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 2: Health endpoint
    console.log('2️⃣ Тестирование health endpoint...');
    try {
        const response = await fetch(`${baseUrl}/api/health`);
        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            console.log(`   ❌ Ошибка: ${response.statusText}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 3: Ping endpoint
    console.log('3️⃣ Тестирование ping endpoint...');
    try {
        const response = await fetch(`${baseUrl}/api/ping`);
        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`   ✅ Успех: ${JSON.stringify(data, null, 2)}`);
        } else {
            console.log(`   ❌ Ошибка: ${response.statusText}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }

    console.log('\n' + '='.repeat(50) + '\n');

    // Тест 4: Главная страница
    console.log('4️⃣ Тестирование главной страницы...');
    try {
        const response = await fetch(`${baseUrl}/`);
        console.log(`   Статус: ${response.status} ${response.statusText}`);
        
        if (response.ok) {
            const text = await response.text();
            console.log(`   ✅ Успех: Страница загружена (${text.length} символов)`);
            if (text.includes('Kracken')) {
                console.log('   ✅ Содержит "Kracken" - правильная страница');
            }
        } else {
            console.log(`   ❌ Ошибка: ${response.statusText}`);
        }
    } catch (error) {
        console.log(`   ❌ Ошибка сети: ${error.message}`);
    }
}

// Запуск тестов
testServerStatus().catch(console.error);
