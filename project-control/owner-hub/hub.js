const names=['Главная','Агенты','Изменения','Моя проверка','Паспорт проекта','Серверы и расходы','Согласования'];
const $=s=>document.querySelector(s), section=$('section'), form=$('form');
let page=0,state;
function el(tag,text,parent){const e=document.createElement(tag);e.textContent=text;parent.append(e);return e}
names.forEach((n,i)=>{el('button',n,$('nav')).onclick=()=>{page=i;draw()}});
function card(title,body){const a=el('article','',section);el('h2',title,a);el('pre',body,a);return a}
const task=$('#task'), promptBox=$('#prompt');
task.oninput=()=>{
 $('#generate').disabled=!task.value.trim();
 $('#order').hidden=true;
 $('#copyStatus').textContent='';
};
$('#generate').onclick=()=>{
 promptBox.value=`Владелец поставил задачу: ${task.value.trim()}

Прочитай правила в PROJECT_PASSPORT.md и AGENTS.md в корне проекта. Выполни задачу в её границах.
Записывай реальные действия через CLI панели из папки project-control/owner-hub:
1. В начале вызови python hub.py log start --task "Название задачи" --desc "Первое действие". Сохрани выданный ID запуска.
2. По ходу работы вызывай python hub.py log progress --run ID --desc "Что сделано".
3. После проверки вызови python hub.py log finish --run ID --desc "Результат проверки".
Если найдёшь баг или противоречие паспорту, запиши python hub.py log error --run ID --desc "Что обнаружено". Это завершит запуск.`;
 $('#order').hidden=false;
};
$('#copy').onclick=async()=>{
 try{
  await navigator.clipboard.writeText(promptBox.value);
  $('#copyStatus').textContent='Скопировано';
 }catch{
  promptBox.focus();promptBox.select();
  $('#copyStatus').textContent='Нажмите Ctrl+C, чтобы скопировать выделенный наряд.';
 }
};
let approvalView=null;
const localTime=value=>new Date(value).toLocaleTimeString('ru-RU',{hour12:false});
let lastUpdate=null;
function drawHome(s){
 const panel=el('article','',section);
 el('h2','Готовность к релизу',panel);
 const checks=s.release_checks;
 if(checks?.length){
  const done=checks.filter(item=>item.done).length;
  const summary='Выполнено '+done+' из '+checks.length+' проверок';
  el('p',summary,panel);
  const bar=el('progress','',panel);
  bar.max=checks.length;bar.value=done;bar.setAttribute('aria-label',summary);
  const list=el('ul','',panel);list.className='checks';
  for(const item of checks){
   const row=el('li','',list);
   el('strong',item.done?'Выполнено · ':item.blocked?'Заблокировано · ':'Ожидает · ',row);
   row.append(item.label.replaceAll('`',''));
  }
 }else el('p',checks?'В паспорте пока нет отмеченных проверок.':'Паспорт проекта недоступен.',panel);
 el('small','Источник: отметки в PROJECT_PASSPORT.md',panel);
 card('Текущая версия кода панели',(s.message||'Название версии недоступно')+'\nНомер версии: '+s.sha);
 const categories={PR:'Запросы на изменения',Issues:'Задачи проекта',Actions:'Автоматические проверки'};
 const statuses={open:'Открыто',closed:'Закрыто',success:'Успешно',failure:'Ошибка',in_progress:'В работе',queued:'В очереди',completed:'Завершено',cancelled:'Отменено',skipped:'Пропущено',neutral:'Без оценки',timed_out:'Время истекло',action_required:'Требуется действие',waiting:'Ожидает',pending:'Ожидает',requested:'Запрошено'};
 for(const [key,title] of Object.entries(categories)){
  const group=s.github[key],box=el('article','',section);
  el('h2',title,box);
  if(group?.status!=='CONNECTED'){el('p','Данные GitHub недоступны',box);continue}
  el('small','GitHub · проверено в '+localTime(group.time),box);
  if(!group.rows.length) el('p','Записей в выборке нет',box);
  for(const row of group.rows){
   const line=el('div','',box);
   el('a','№ '+row.id+' · '+(statuses[row.status]||'Статус не определён'),line).href=row.url;
   if(row.sha) el('small',' · версия '+row.sha.slice(0,7),line);
  }
 }
}
function draw(){
 const version=page===6 && state ? JSON.stringify([state.sha,state.message,state.approved_at,state.approval_description]) : null;
 if(version && approvalView===version) return;
 approvalView=version;
 $('#dispatch').hidden=page!==1;
 const clock=$('#agent-clock');clock.hidden=page!==1;
 clock.textContent=lastUpdate?'Последнее обновление: '+localTime(lastUpdate):'Ожидаем данные';
 document.querySelectorAll('nav button').forEach((b,i)=>b.setAttribute('aria-current',i===page));
 $('h1').textContent=names[page];section.replaceChildren();form.hidden=page!==3;
 if(!state){$('#meta').textContent='NOT_CONNECTED · локальный сервер';form.hidden=true;return}
 const s=state;$('#meta').textContent='Проверено в '+localTime(s.time)+(page===0?'':' · Версия панели '+s.sha);
 if(page===0) drawHome(s);
 if(page===1){
  if(!s.events.length) card('Журнал агента','Записей пока нет');
  const labels={start:'Начало',progress:'В работе',finish:'Завершено',error:'Ошибка'};
  const groups=new Map();
  for(const e of s.events){
   if(!groups.has(e.run)){
    const stale=['start','progress'].includes(e.action)&&Date.now()-Date.parse(e.stamp)>900000;
    const panel=el('article','',section);
    el('small',(e.source==='synthetic'?'Тест':'Рабочая задача')+' · '+e.agent+' · '+labels[e.action]+(stale?' · Давно нет событий':''),panel);
    if(!stale && ['start','progress'].includes(e.action)) el('span','В работе прямо сейчас',panel).className='active-run';
    el('h2',e.task,panel);
    el('small','SQLite · запуск '+e.run,panel);
    groups.set(e.run,panel);
   }
   const panel=el('div','',groups.get(e.run));
   panel.className='event event-'+e.action;
   el('strong',labels[e.action]+' · '+e.agent,panel);
   el('p',e.description,panel);
   el('small',e.stamp+' · '+e.branch+' · SHA '+e.sha,panel);
  }
 }
 if(page===2){card(s.changes_source,s.changes_path);card('Файлы рабочего дерева',s.files.join('\n')||(s.diff==='NOT_CONNECTED'?'NOT_CONNECTED':'Нет зарегистрированных изменений'));card('Реальные изменения',s.diff||'Нет изменений для показа')}
 if(page===3){card('Тестовая версия приложения','PREVIEW_UNAVAILABLE · изолированная версия приложения не зарегистрирована.');if(!form.sha.value)form.sha.value=s.sha;for(const n of s.notes)card('Замечание · '+n.stamp,n.body+'\nSQLite · '+n.sha)}
 if(page===4){
  const p=s.passport;
  if(!p) card('Паспорт проекта','Перезапустите сервер панели, чтобы загрузить паспорт.');
  else card(p.source,p.status==='OK'?(p.text||'Файл пуст'):p.status);
 }
 if(page===5){
  const infra=s.infrastructure;
  el('p','Источник · infrastructure.json',section);
  if(!infra) card('Инфраструктура','Перезапустите сервер панели');
  else if(infra.status!=='OK') card('Инфраструктура',infra.status);
  else if(!Object.keys(infra.items).length) card('Расходы','Записей пока нет');
  else for(const [service,cost] of Object.entries(infra.items)) card(service,cost);
 }
 if(page===6){
  if(s.message==null){card('Текущая версия','NOT_VERIFIED');return}
  const panel=el('article','',section);
  panel.className='approval';
  el('h2','Версия: '+(s.message||'Без сообщения'),panel);
  el('small','SHA '+s.sha,panel);
  if(s.approved_at) el('p','Одобрено · '+s.approved_at.replace('T',' '),panel);
  if(s.approval_description) el('p',s.approval_description,panel);
  else {
   const label=el('label','Что именно одобряем (по-русски)?',panel);
   const input=el('textarea','',label);
   input.maxLength=2000;
   const button=el('button',s.approved_at?'Добавить описание':'Одобрить эту версию',panel);
   button.disabled=true;
   input.oninput=()=>{button.disabled=!input.value.trim()};
   button.onclick=async()=>{
    button.disabled=true;
    try {
     const r=await fetch('/approvals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:s.sha,description:input.value.trim()})});
     if(!r.ok) throw Error(r.status===409?'Версия изменилась. Проверьте новый коммит.':'Не удалось сохранить решение.');
     await refresh();
    } catch(error){button.disabled=false;window.alert(error.message);await refresh()}
   };
  }
 }
}
let loading=false;
async function refresh(){
 if(loading) return;
 loading=true;
 try{
  const r=await fetch('/state',{cache:'no-store'});
  if(!r.ok) throw Error();
  state=await r.json();
  lastUpdate=Date.now();
 }catch{state=null}
 finally{loading=false;draw()}
}
form.onsubmit=async e=>{e.preventDefault();try{const r=await fetch('/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(new FormData(form)))});
 if(!r.ok)throw Error();form.body.value='';$('output').textContent='Сохранено';await refresh()}catch{$('output').textContent='Ошибка сохранения. Проверьте SHA и подключение.'}};
refresh();setInterval(refresh,2000);
