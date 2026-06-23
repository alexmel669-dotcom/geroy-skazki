// ========================================
// analytics.js — АНАЛИТИКА И ЛОГГИРОВАНИЕ
// ========================================

export function trackEvent(eventName, eventData) {
  console.log(`📊 Event: ${eventName}`, eventData);

  const event = {
    name: eventName,
    data: eventData,
    timestamp: Date.now(),
    url: typeof window !== 'undefined' ? window.location.href : ''
  };

  try {
    const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
    events.push(event);
    while (events.length > 200) events.shift();
    localStorage.setItem('analytics_events', JSON.stringify(events));
  } catch (e) {
    console.warn('Failed to save analytics event:', e);
  }
}

export function logError(errorPlace, errorMessage) {
  console.error(`❌ Error in ${errorPlace}:`, errorMessage);

  try {
    const errors = JSON.parse(localStorage.getItem('error_log') || '[]');
    errors.push({
      place: errorPlace,
      message: errorMessage,
      timestamp: Date.now(),
      url: window.location.href
    });
    while (errors.length > 100) errors.shift();
    localStorage.setItem('error_log', JSON.stringify(errors));
  } catch (e) {
    console.warn('Failed to save error log:', e);
  }
}

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
  } catch (e) {
    return { totalEvents: 0, totalErrors: 0 };
  }
}

export function clearAnalytics() {
  localStorage.removeItem('analytics_events');
  localStorage.removeItem('error_log');
  console.log('Analytics cleared');
}

export default { trackEvent, logError, getAnalyticsStats, clearAnalytics };
