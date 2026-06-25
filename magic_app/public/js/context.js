export function getTimeContext(childName = '') {
  const now = new Date();
  const hour = now.getHours();
  const day = now.toLocaleDateString('ru-RU', { weekday: 'long' });
  const date = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  let greeting = '';
  let partOfDay = '';

  if (hour >= 6 && hour < 12) {
    greeting = 'Доброе утро';
    partOfDay = 'morning';
  } else if (hour >= 12 && hour < 17) {
    greeting = 'Добрый день';
    partOfDay = 'day';
  } else if (hour >= 17 && hour < 21) {
    greeting = 'Добрый вечер';
    partOfDay = 'evening';
  } else {
    greeting = 'Доброй ночи';
    partOfDay = 'night';
  }

  const name = childName || 'друг';
  return {
    greeting: `${greeting}, ${name}!`,
    time: `Сейчас ${time}`,
    day: `Сегодня ${day}, ${date}`,
    partOfDay,
    hour,
    dayOfWeek: now.getDay(),
    isWeekend: now.getDay() === 0 || now.getDay() === 6,
    isEvening: hour >= 20 || hour < 6,
    isMealTime: hour === 8 || hour === 13 || hour === 19
  };
}

export default { getTimeContext };
