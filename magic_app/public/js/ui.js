// ========================================
// ui.js — UI КОМПОНЕНТЫ
// ========================================

import { getActiveChildName, updateStatsUI } from './core.js';

// ========================================
// ОБНОВЛЕНИЕ UI
// ========================================

export function updateUI() {
    // Обновляем имя ребенка
    const childNameLabel = document.getElementById('childNameLabel');
    if (childNameLabel) {
        childNameLabel.textContent = getActiveChildName();
    }
    
    // Обновляем статистику
    updateStatsUI();
    
    // Обновляем аватар
    updateAvatar();
}

function updateAvatar() {
    const avatar = document.getElementById('avatar');
    if (!avatar) return;
    
    const savedChar = localStorage.getItem('currentCharacter') || 'lucik';
    const avatarMap = {
        'lucik': '/assets/images/avatar.png',
        'kid1': '/assets/images/kid1.png',
        'kid2': '/assets/images/kid2.png'
    };
    
    avatar.style.backgroundImage = `url('${avatarMap[savedChar] || '/assets/images/avatar.png'}')`;
    avatar.style.backgroundSize = 'cover';
    avatar.style.backgroundPosition = 'center';
}

// ========================================
// УВЕДОМЛЕНИЯ
// ========================================

export function showNotification(message, type = 'info') {
    // Удаляем старые уведомления
    const oldNotifications = document.querySelectorAll('.custom-notification');
    oldNotifications.forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = 'custom-notification';
    
    const colors = {
        success: '#4CAF50',
        error: '#f44336',
        warning: '#ff9800',
        info: '#2196F3'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        animation: slideInRight 0.3s ease;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        font-size: 14px;
        max-width: 300px;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Добавляем анимацию
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========================================
// ЗАГРУЗЧИК
// ========================================

let loaderElement = null;

export function showLoader() {
    if (loaderElement) return;
    
    loaderElement = document.createElement('div');
    loaderElement.className = 'custom-loader';
    loaderElement.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10002;
    `;
    
    loaderElement.innerHTML = `
        <div style="background: white; padding: 20px; border-radius: 10px; text-align: center;">
            <div style="width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #667eea; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <p style="margin-top: 10px;">Загрузка...</p>
        </div>
    `;
    
    if (!document.querySelector('#loader-styles')) {
        const style = document.createElement('style');
        style.id = 'loader-styles';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(loaderElement);
}

export function hideLoader() {
    if (loaderElement) {
        loaderElement.remove();
        loaderElement = null;
    }
}

// ========================================
// МОДАЛЬНЫЕ ОКНА
// ========================================

export function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

export function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// ========================================
// ЭКСПОРТЫ
// ========================================

export default {
    updateUI,
    showNotification,
    showLoader,
    hideLoader,
    showModal,
    hideModal
};
