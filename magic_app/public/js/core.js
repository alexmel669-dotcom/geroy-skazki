// ========================================
// main.js — ГЛАВНЫЙ ФАЙЛ ПРИЛОЖЕНИЯ
// ========================================

// Импортируем все из core.js
import { 
    initCore,
    getActiveChildName,
    updateStatsUI,
    cycleCharacter,
    setActiveChild,
    selectGuestMode,
    saveChildData,
    appState
} from './core.js';

// Импортируем из config.js
import { CONFIG, CHARACTERS, validateConfig } from './config.js';

// Импортируем из ui.js
import { updateUI, showNotification } from './ui.js';

// ========================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ========================================

// Ждем загрузки DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📱 DOM loaded, initializing app...');
        initializeApp();
    });
} else {
    console.log('📱 DOM already loaded, initializing app...');
    initializeApp();
}

// ========================================
// ОСНОВНАЯ ИНИЦИАЛИЗАЦИЯ
// ========================================

function initializeApp() {
    console.log('🚀 Initializing Main App');
    
    // Запускаем ядро
    initCore();
    
    // Настраиваем дополнительные обработчики
    setupAdditionalHandlers();
    
    // Загружаем сохраненные данные
    loadSavedData();
    
    console.log('✅ App initialized successfully');
}

// ========================================
// ДОПОЛНИТЕЛЬНЫЕ ОБРАБОТЧИКИ
// ========================================

function setupAdditionalHandlers() {
    // Кнопка выбора ребенка (если есть)
    const selectChildBtn = document.getElementById('selectChildBtn');
    if (selectChildBtn) {
        selectChildBtn.onclick = () => {
            const modal = document.getElementById('childSelectModal');
            if (modal) modal.style.display = 'flex';
        };
    }
    
    // Закрытие модального окна по клику вне
    const modal = document.getElementById('childSelectModal');
    if (modal) {
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };
    }
    
    // Обработка ошибок глобально
    window.addEventListener('error', (e) => {
        console.error('Global error:', e.error);
        showNotification('Произошла ошибка, попробуйте еще раз', 'error');
    });
    
    // Обработка непойманных промисов
    window.addEventListener('unhandledrejection', (e) => {
        console.error('Unhandled promise rejection:', e.reason);
        showNotification('Ошибка: ' + (e.reason?.message || 'Неизвестная ошибка'), 'error');
    });
}

// ========================================
// ЗАГРУЗКА СОХРАНЕННЫХ ДАННЫХ
// ========================================

function loadSavedData() {
    try {
        // Загружаем последнего выбранного персонажа
        const savedChar = localStorage.getItem('currentCharacter');
        if (savedChar && CHARACTERS[savedChar]) {
            console.log('Loaded saved character:', savedChar);
        }
        
        // Загружаем статистику
        const stats = localStorage.getItem('stats_guest');
        if (stats) {
            console.log('Loaded saved stats');
        }
        
        // Обновляем интерфейс
        updateUI();
        
    } catch (e) {
        console.error('Error loading saved data:', e);
    }
}

// ========================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ HTML
// ========================================

// Делаем функции доступными глобально для onclick в HTML
if (typeof window !== 'undefined') {
    window.selectGuestMode = selectGuestMode;
    window.cycleCharacter = () => cycleCharacter(1);
    window.showChildSelectModal = () => {
        const modal = document.getElementById('childSelectModal');
        if (modal) modal.style.display = 'flex';
    };
    window.getActiveChildName = getActiveChildName;
    window.updateStatsUI = updateStatsUI;
}

// ========================================
// ЭКСПОРТЫ
// ========================================

export { initializeApp, setupAdditionalHandlers, loadSavedData };
export default { initializeApp, setupAdditionalHandlers, loadSavedData };
