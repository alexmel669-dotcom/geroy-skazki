// В карточку передаются только числа и режим. Canvas эпизода и профиль здесь не используются.
export function challengeUrl(seed) {
  return 'https://geroy-skazki.ru/app.html?challenge=' + seed;
}

async function loadArt(filename) {
  const image = new Image();
  image.src = 'assets/images/' + filename;
  await image.decode();
  return image;
}

export async function createRunnerCard({ meters, stars, seed, story = false }) {
  const [forest, lucik] = await Promise.all([loadArt('world-forest.png'), loadArt('lucik-run-1.png')]);
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#102b28';
  ctx.fillRect(0, 0, 1080, 1920);
  ctx.drawImage(forest, -180, 0, 1440, 1440);
  const shade = ctx.createLinearGradient(0, 0, 0, 1920);
  shade.addColorStop(0, 'rgba(4, 26, 23, .94)');
  shade.addColorStop(.28, 'rgba(4, 26, 23, .12)');
  shade.addColorStop(.46, 'rgba(4, 26, 23, .04)');
  shade.addColorStop(.74, '#102b28');
  shade.addColorStop(1, '#081e1c');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, 1080, 1920);

  function text(value, y, size, color, weight = 700, x = 540, width = 940) {
    ctx.textAlign = 'center';
    ctx.fillStyle = color;
    ctx.font = weight + ' ' + size + 'px "Trebuchet MS", sans-serif';
    ctx.fillText(value, x, y, width);
  }
  ctx.strokeStyle = '#e9d79a';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, 1008, 1848);
  text('ГЕРОЙ СКАЗОК', 166, 38, '#ffdf85');
  text(story ? 'Сюжетный забег' : 'Быстрый забег', 318, 105, '#fff9e8', 800);
  ctx.save();
  ctx.shadowColor = 'rgba(16,31,23,.48)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 18;
  ctx.drawImage(lucik, 90, 475, 900, 900);
  ctx.restore();
  text('Герой', 1270, 52, '#fff9e8');
  ctx.fillStyle = '#aaa780';
  ctx.fillRect(118, 1334, 844, 2);
  text(String(Math.floor(meters)), 1504, 122, '#fff9e8', 800, 315, 390);
  text(String(Math.floor(stars)), 1504, 122, '#ffda78', 800, 765, 390);
  text('МЕТРЫ', 1568, 32, '#ddede0', 700, 315);
  text('ЗВЁЗДЫ', 1568, 32, '#ffda78', 700, 765);
  if (story) text('Вызов другу · Быстрый забег', 1700, 37, '#ddede0');
  text('Трасса ' + seed, 1790, 52, '#ffdf85');
  return new Promise((resolve, reject) => canvas.toBlob(blob => {
    if (blob) resolve(blob);
    else reject(new Error('Не удалось создать PNG'));
  }, 'image/png'));
}

export async function previewRunnerCard(result) {
  if (document.querySelector('dialog.runner-card-preview')) return;
  const dialog = document.createElement('dialog');
  dialog.className = 'runner-card-preview';
  dialog.setAttribute('aria-label', 'Предпросмотр карточки');
  dialog.innerHTML = `<button type="button" class="runner-card-close" aria-label="Закрыть">×</button>
    <p role="status">Готовим карточку…</p><img hidden alt="Карточка результата забега">
    <div class="runner-card-actions" hidden><a class="runner-btn primary" download>Скачать PNG</a>
    <button type="button" class="runner-btn share" hidden>Отправить PNG…</button>
    <a class="runner-btn secondary" target="_blank" rel="noopener noreferrer">Ссылка в ВК</a></div>`;
  document.body.append(dialog);
  let objectUrl;
  dialog.addEventListener('close', () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    dialog.remove();
  }, { once: true });
  dialog.querySelector('.runner-card-close').onclick = () => dialog.close();
  dialog.showModal();
  const status = dialog.querySelector('[role=status]');
  try {
    const blob = await createRunnerCard(result);
    if (!dialog.open) return;
    objectUrl = URL.createObjectURL(blob);
    const img = dialog.querySelector('img');
    img.src = objectUrl;
    img.alt = 'Герой · ' + result.meters + ' м · Звёзды: ' + result.stars + ' · Трасса ' + result.seed;
    img.hidden = false;
    const actions = dialog.querySelector('.runner-card-actions');
    const save = actions.querySelector('[download]');
    save.href = objectUrl;
    save.download = 'lucik-' + result.seed + '.png';
    const vk = new URL('https://vk.com/share.php');
    vk.searchParams.set('url', challengeUrl(result.seed));
    vk.searchParams.set('title', img.alt);
    actions.querySelector('[target]').href = vk.href;
    const file = new File([blob], save.download, { type: 'image/png' });
    const send = actions.querySelector('button');
    if (navigator.canShare?.({ files: [file] })) {
      send.hidden = false;
      send.onclick = async () => {
        try { await navigator.share({ files: [file], title: 'Герой Сказок' }); }
        catch (error) {
          if (error.name !== 'AbortError') status.textContent = 'Сохраните PNG и прикрепите к публикации.';
        }
      };
    }
    status.textContent = 'Для публикации в ВК прикрепите сохранённый PNG к ссылке.';
    actions.hidden = false;
  } catch {
    status.textContent = 'Не удалось подготовить карточку. Закройте окно и попробуйте ещё раз.';
  }
}

export function addResultActions(container, result) {
  const actions = document.createElement('div');
  actions.className = 'runner-social-actions';
  actions.innerHTML = `<button type="button" class="runner-btn share">📸 Поделиться</button>
    <button type="button" class="runner-btn primary">Бросить вызов другу</button>
    <p role="status"></p><input type="text" aria-label="Ссылка на трассу" readonly hidden>`;
  container.append(actions);
  actions.querySelector('.share').onclick = () => previewRunnerCard(result);
  actions.querySelector('.primary').onclick = async () => {
    const link = challengeUrl(result.seed);
    const status = actions.querySelector('[role=status]');
    const field = actions.querySelector('input');
    try {
      await navigator.clipboard.writeText(link);
      field.hidden = true;
      status.textContent = 'Ссылка скопирована! Отправь её другу';
    } catch {
      field.value = link;
      field.hidden = false;
      field.focus();
      field.select();
      status.textContent = 'Скопируйте ссылку вручную.';
    }
  };
}
