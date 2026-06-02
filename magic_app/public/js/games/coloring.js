import { showModal } from '../ui.js';
import { updateAchievement } from '../achievements.js';
import { sendAnalytics } from '../analytics.js';

export function startColoringGame() {
  const container = document.createElement('div');
  container.className = 'game-overlay';
  container.setAttribute('aria-label', 'Игра Раскраска');
  
  const title = document.createElement('h2');
  title.textContent = '🎨 Раскрась Люцика';
  title.style.color = 'white';
  
  const canvas = document.createElement('canvas');
  canvas.width = 400;
  canvas.height = 400;
  canvas.style.cssText = `
    background: white;
    border-radius: 20px;
    cursor: crosshair;
    max-width: 90%;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
  `;
  
  const ctx = canvas.getContext('2d');
  
  // Рисуем контур Люцика
  drawLucikOutline(ctx, canvas.width, canvas.height);
  
  let currentColor = '#ff4081';
  let isDrawing = false;
  let hasDrawn = false;
  let brushSize = 15;
  
  // Палитра цветов
  const colors = ['#ff4081','#4CAF50','#00d2ff','#ffd700','#9b59b6','#ff9f4a','#795548','#000000'];
  
  const colorBar = document.createElement('div');
  colorBar.style.cssText = `
    display: flex;
    gap: 10px;
    margin: 15px 0;
    flex-wrap: wrap;
    justify-content: center;
    padding: 10px;
    background: rgba(0,0,0,0.3);
    border-radius: 20px;
  `;
  
  colors.forEach(color => {
    const btn = document.createElement('button');
    btn.className = 'color-btn';
    btn.style.cssText = `
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: ${color};
      border: 3px solid ${color === currentColor ? 'white' : 'transparent'};
      cursor: pointer;
      transition: transform 0.2s;
    `;
    
    btn.onclick = () => {
      currentColor = color;
      Array.from(colorBar.children).forEach(b => {
        b.style.border = '3px solid transparent';
        b.style.transform = 'scale(1)';
      });
      btn.style.border = '3px solid white';
      btn.style.transform = 'scale(1.2)';
    };
    
    if (color === currentColor) {
      btn.style.border = '3px solid white';
      btn.style.transform = 'scale(1.2)';
    }
    
    colorBar.appendChild(btn);
  });
  
  // Размер кисти
  const brushControl = document.createElement('div');
  brushControl.style.cssText = 'margin:10px 0;color:white;';
  brushControl.innerHTML = `
    <label>Размер кисти: 
      <input type="range" min="5" max="30" value="15" style="vertical-align:middle;">
      <span>${brushSize}px</span>
    </label>
  `;
  
  const brushInput = brushControl.querySelector('input');
  brushInput.oninput = () => {
    brushSize = parseInt(brushInput.value);
    brushControl.querySelector('span').textContent = brushSize + 'px';
  };
  
  // Обработчики рисования
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };
  
  const startDrawing = (e) => {
    e.preventDefault();
    isDrawing = true;
    hasDrawn = true;
    const pos = getPos(e);
    drawDot(pos.x, pos.y);
  };
  
  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    drawDot(pos.x, pos.y);
  };
  
  const stopDrawing = () => {
    isDrawing = false;
  };
  
  function drawDot(x, y) {
    ctx.fillStyle = currentColor;
    ctx.beginPath();
    ctx.arc(x, y, brushSize, 0, Math.PI * 2);
    ctx.fill();
  }
  
  // Мышь
  canvas.onmousedown = startDrawing;
  canvas.onmousemove = draw;
  canvas.onmouseup = stopDrawing;
  canvas.onmouseleave = stopDrawing;
  
  // Тач
  canvas.ontouchstart = startDrawing;
  canvas.ontouchmove = draw;
  canvas.ontouchend = stopDrawing;
  
  // Кнопки действий
  const actionsBar = document.createElement('div');
  actionsBar.style.cssText = 'display:flex;gap:10px;margin:10px 0;flex-wrap:wrap;justify-content:center;';
  
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🧹 Очистить';
  clearBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 20px;
    background: #e67e22;
    color: white;
    border: none;
    cursor: pointer;
  `;
  clearBtn.onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawLucikOutline(ctx, canvas.width, canvas.height);
  };
  
  const doneBtn = document.createElement('button');
  doneBtn.textContent = '✅ Готово!';
  doneBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 20px;
    background: #4CAF50;
    color: white;
    border: none;
    cursor: pointer;
  `;
  doneBtn.onclick = () => {
    if (!hasDrawn) {
      showModal('Ой!', 'Сначала порисуй немного! 🎨');
      return;
    }
    
    updateAchievement('artist');
    sendAnalytics('coloring_completed');
    
    // Сохраняем рисунок
    const dataUrl = canvas.toDataURL();
    const drawings = JSON.parse(localStorage.getItem('drawings') || '[]');
    drawings.push({
      data: dataUrl,
      date: new Date().toISOString()
    });
    
    if (drawings.length > 10) drawings.shift();
    localStorage.setItem('drawings', JSON.stringify(drawings));
    
    showModal('Отлично!', '🎨 Какая красота! Люцику очень нравится!');
    container.remove();
  };
  
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    padding: 10px 20px;
    border-radius: 20px;
    background: #ff4081;
    color: white;
    border: none;
    cursor: pointer;
  `;
  closeBtn.onclick = () => container.remove();
  
  actionsBar.appendChild(clearBtn);
  actionsBar.appendChild(doneBtn);
  actionsBar.appendChild(closeBtn);
  
  container.appendChild(title);
  container.appendChild(canvas);
  container.appendChild(colorBar);
  container.appendChild(brushControl);
  container.appendChild(actionsBar);
  document.body.appendChild(container);
  
  sendAnalytics('coloring_game_started');
}

function drawLucikOutline(ctx, width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  // Голова
  ctx.beginPath();
  ctx.arc(centerX, centerY - 20, 80, 0, Math.PI * 2);
  ctx.stroke();
  
  // Уши
  ctx.beginPath();
  ctx.moveTo(centerX - 60, centerY - 70);
  ctx.lineTo(centerX - 45, centerY - 95);
  ctx.lineTo(centerX - 30, centerY - 65);
  ctx.moveTo(centerX + 60, centerY - 70);
  ctx.lineTo(centerX + 45, centerY - 95);
  ctx.lineTo(centerX + 30, centerY - 65);
  ctx.stroke();
  
  // Глаза
  ctx.beginPath();
  ctx.arc(centerX - 30, centerY - 35, 12, 0, Math.PI * 2);
  ctx.arc(centerX + 30, centerY - 35, 12, 0, Math.PI * 2);
  ctx.stroke();
  
  // Зрачки
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(centerX - 30, centerY - 35, 5, 0, Math.PI * 2);
  ctx.arc(centerX + 30, centerY - 35, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Нос
  ctx.strokeStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY - 15);
  ctx.lineTo(centerX - 10, centerY - 5);
  ctx.lineTo(centerX + 10, centerY - 5);
  ctx.closePath();
  ctx.stroke();
  
  // Рот
  ctx.beginPath();
  ctx.arc(centerX, centerY, 15, 0.1, Math.PI - 0.1);
  ctx.stroke();
  
  // Усы
  ctx.beginPath();
  ctx.moveTo(centerX - 25, centerY - 10);
  ctx.lineTo(centerX - 60, centerY - 15);
  ctx.moveTo(centerX - 25, centerY - 5);
  ctx.lineTo(centerX - 60, centerY);
  ctx.moveTo(centerX + 25, centerY - 10);
  ctx.lineTo(centerX + 60, centerY - 15);
  ctx.moveTo(centerX + 25, centerY - 5);
  ctx.lineTo(centerX + 60, centerY);
  ctx.stroke();
  
  // Тело
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + 100, 60, 70, 0, 0, Math.PI * 2);
  ctx.stroke();
  
  // Лапы
  ctx.beginPath();
  ctx.ellipse(centerX - 40, centerY + 150, 20, 30, -0.2, 0, Math.PI * 2);
  ctx.ellipse(centerX + 40, centerY + 150, 20, 30, 0.2, 0, Math.PI * 2);
  ctx.stroke();
}
