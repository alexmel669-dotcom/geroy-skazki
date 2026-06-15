// ========================================
// analytics.js — АНАЛИТИКА И ЛОГГИРОВАНИЕ
// ========================================

/**
 * Отслеживание событий
 * @param {string} eventName - Название события
 * @param {any} eventData - Данные события
 */
export function trackEvent(eventName, eventData) {
    console.log(`📊 Event: ${eventName}`, eventData);
    
    // Сохраняем в localStorage для статистики
    try {
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        events.push({
            name: eventName,
            data: eventData,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        
        // Оставляем только последние 200 событий
        while (events.length > 200) {
            events.shift();
        }
        
        localStorage.setItem('analytics_events', JSON.stringify(events));
    } catch(e) {
        console.warn('Failed to save analytics event:', e);
    }
    
    // Если есть серверная аналитика - отправляем туда
    sendToServerAnalytics(eventName, eventData);
}

/**
 * Логирование ошибок
 * @param {string} errorPlace - Место возникновения ошибки
 * @param {string} errorMessage - Сообщение об ошибке
 */
export function logError(errorPlace, errorMessage) {
    console.error(`❌ Error in ${errorPlace}:`, errorMessage);
    
    try {
        const errors = JSON.parse(localStorage.getItem('error_log') || '[]');
        errors.push({
            place: errorPlace,
            message: errorMessage,
            timestamp: Date.now(),
            url: window.location.href,
            userAgent: navigator.userAgent
        });
        
        // Оставляем только последние 100 ошибок
        while (errors.length > 100) {
            errors.shift();
        }
        
        localStorage.setItem('error_log', JSON.stringify(errors));
    } catch(e) {
        console.warn('Failed to save error log:', e);
    }
    
    // Опционально: отправляем ошибку на сервер
    sendErrorToServer(errorPlace, errorMessage);
}

/**
 * Отправка события на сервер (опционально)
 * @param {string} eventName 
 * @param {any} eventData 
 */
function sendToServerAnalytics(eventName, eventData) {
    // Если есть API для аналитики - раскомментировать
    /*
    try {
        fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventName, data: eventData }),
            keepalive: true
        }).catch(e => console.warn('Analytics send failed:', e));
    } catch(e) {}
    */
}

/**
 * Отправка ошибки на сервер (опционально)
 * @param {string} place 
 * @param {string} message 
 */
function sendErrorToServer(place, message) {
    // Если есть API для ошибок - раскомментировать
    /*
    try {
        fetch('/api/error', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place, message, timestamp: Date.now() }),
            keepalive: true
        }).catch(e => console.warn('Error report failed:', e));
    } catch(e) {}
    */
}

/**
 * Получение статистики событий
 * @returns {Object}
 */
export function getAnalyticsStats() {
    try {
        const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
        const errors = JSON.parse(localStorage.getItem('error_log') || '[]');
        
        return {
            totalEvents: events.length,
            totalErrors: errors.length,
            lastEvent: events[events.length - 1] || null,
            lastError: errors[errors.length - 1] || null
        };
    } catch(e) {
        return { totalEvents: 0, totalErrors: 0 };
    }
}

/**
 * Очистка аналитики
 */
export function clearAnalytics() {
    localStorage.removeItem('analytics_events');
    localStorage.removeItem('error_log');
    console.log('Analytics cleared');
}

// Экспорт по умолчанию для совместимости
export default {
    trackEvent,
    logError,
    getAnalyticsStats,
    clearAnalytics
};
