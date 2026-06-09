// ========================================
// core.js — ЯДРО ПРИЛОЖЕНИЯ «ГЕРОЙ СКАЗОК»
// Версия: 4.0.3 FIX
// ========================================

import { CONFIG, CHARACTERS, validateConfig } from './config.js';

import {
  generateResponse,
  detectFear,
  detectAlertWords,
  detectPersonalData,
  setCharacter,
  getCharacter,
  addToContext,
  clearContext
} from './ai.js';

import {
  startRecording,
  stopRecording,
  playAudioFromUrl,
  isRecording
} from './mic.js';

import { synthesizeSpeech } from './audio.js';

import {
  checkAchievements,
  showAchievement
} from './achievements.js';

import {
  trackEvent,
  logError
} from './analytics.js';

import {
  initSecurity,
  checkBadWords,
  sanitizeInput
} from './security.js';


// ========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ
// ========================================

let activeChildIndex = -1;
let isProcessing = false;
let characterCycleIndex = 0;

const characterIds = Object.keys(CHARACTERS);


// экспорт состояния
export const appState = {

  get activeChildIndex() {
    return activeChildIndex;
  },

  set activeChildIndex(value) {
    activeChildIndex = value;
  },


  get isProcessing() {
    return isProcessing;
  },

  set isProcessing(value) {
    isProcessing = value;
  },


  get characterCycleIndex() {
    return characterCycleIndex;
  },

  set characterCycleIndex(value) {
    characterCycleIndex = value;
  },


  characterIds

};


// совместимость

export const getCurrentChild = getActiveChild;
export const getCurrentChildName = getActiveChildName;
export const getCurrentChildIndex = getActiveChildIndex;
export const saveHistory = saveToChildHistory;
export const updateStats = updateStatsDisplay;
export const processVoice = processAudio;



// ========================================
// ИНИЦИАЛИЗАЦИЯ
// ========================================

export function initCore() {

  validateConfig();

  initSecurity();

  initUI();

  // FIX:
  // раньше обработчики кнопок не запускались
  initEventListeners();

  loadState();

  checkChildSelection();

  updateStatsDisplay();


  console.log(
    `🟢 Герой Сказок v${CONFIG.APP_VERSION} запущен`
  );


  console.log(
    `👶 Активный ребёнок: ${getActiveChildName()}`
  );


  console.log(
    `🎭 Персонаж: ${getCharacter()}`
  );

}



// ========================================
// ДЕТИ
// ========================================


export function getChildren() {

  try {

    return JSON.parse(
      localStorage.getItem('children') || '[]'
    );

  } catch(e) {

    console.error(
      '❌ Ошибка чтения children:',
      e
    );

    return [];

  }

}



export function getActiveChildIndex() {


  if(activeChildIndex >= 0) {
    return activeChildIndex;
  }


  const saved =
    localStorage.getItem(
      'activeChildIndex'
    );


  if(saved !== null) {

    activeChildIndex =
      parseInt(saved);


    if(Number.isNaN(activeChildIndex)) {
      activeChildIndex = -1;
    }


    return activeChildIndex;

  }


  return -1;

}




export function getActiveChildName() {


  const children = getChildren();


  const child =
    children[getActiveChildIndex()];


  return child
    ? child.name
    : 'Гость';

}




export function getActiveChild() {


  const children = getChildren();


  return (
    children[getActiveChildIndex()]
    || null
  );

}




export function setActiveChild(index) {


  activeChildIndex = index;


  localStorage.setItem(
    'activeChildIndex',
    String(index)
  );


  const children = getChildren();

  const child = children[index];


  const nameLabel =
    document.getElementById(
      'childNameLabel'
    );


  const avatar =
    document.getElementById(
      'avatar'
    );



  if(child) {


    if(nameLabel) {

      nameLabel.textContent =
        `${child.name}, ${child.age} лет`;

    }



    if(avatar) {


      const avatarMap = {

        kid1:
        'assets/images/kid1.png',

        kid2:
        'assets/images/kid2.png',

        lucik:
        'assets/images/avatar.png'

      };



      avatar.style.backgroundImage =
        `url('${avatarMap[child.avatarRole] ||
        'assets/images/avatar.png'}')`;

    }


  } else {


    if(nameLabel) {

      nameLabel.textContent =
        'Гость';

    }


    if(avatar) {

      avatar.style.backgroundImage =
        "url('assets/images/avatar.png')";

    }

  }



  trackEvent(
    'child_select',
    child ? child.name : 'guest'
  );

}





export function showChildSelectModal() {


  const children = getChildren();



  if(children.length === 1) {

    setActiveChild(0);
    return;

  }



  if(children.length === 0) {

    setActiveChild(-1);
    return;

  }



  const modal =
    document.getElementById(
      'childSelectModal'
    );


  const list =
    document.getElementById(
      'childSelectList'
    );



  if(!modal || !list) {
    return;
  }



  list.innerHTML =
    children.map((child,i)=>{


      const emoji =
        child.avatarRole === 'kid1'
        ? '👧'
        :
        child.avatarRole === 'kid2'
        ? '👦'
        :
        '🐱';



      return `

<button class="modal-btn child-select-btn"
data-index="${i}">

${emoji}

<b>${sanitizeInput(child.name)}</b>

</button>

`;

    }).join('');



  modal.style.display='flex';



  document
  .querySelectorAll('.child-select-btn')
  .forEach(btn=>{


    btn.onclick=()=>{


      const index =
        parseInt(
          btn.dataset.index
        );


      modal.style.display='none';


      setActiveChild(index);


      updateStatsDisplay();


    };


  });


}




export function selectGuestMode(){

  const modal =
    document.getElementById(
      'childSelectModal'
    );


  if(modal) {
    modal.style.display='none';
  }


  setActiveChild(-1);


  updateStatsDisplay();

}



function checkChildSelection(){


  const saved =
    getActiveChildIndex();


  const children =
    getChildren();



  if(children.length > 1 && saved === -1){

    showChildSelectModal();

  }

  else if(children.length === 1 && saved === -1){

    setActiveChild(0);

  }

  else if(saved >= children.length){

    setActiveChild(-1);

  }

  else if(saved >= 0){

    setActiveChild(saved);

  }


}




// ========================================
// СТАТИСТИКА
// ========================================


export function getChildStatsKey(){


  const child =
    getActiveChild();



  // FIX:
  // имя больше не ломает сохранения

  return child
    ? `stats_${child.id ||
       child.name.trim().toLowerCase()}`
    :
      'stats_guest';


}
// ========================================
// СТАТИСТИКА (продолжение)
// ========================================


export function getChildStats(){


  const key =
    getChildStatsKey();


  try {


    const data =
      JSON.parse(
        localStorage.getItem(key) || 'null'
      );


    if(data) {
      return data;
    }


  } catch(e) {

    console.error(
      '❌ Ошибка чтения статистики:',
      e
    );

  }



  return {


    totalStories:0,

    totalGames:0,

    history:[],

    fearStats:{
      ...CONFIG.DEFAULT_FEAR_STATS
    },

    lastActive:
      new Date().toISOString()


  };


}





export function saveChildStats(stats){


  const key =
    getChildStatsKey();



  try {


    let json =
      JSON.stringify(stats);



    // FIX:
    // раньше мог быть бесконечный вызов saveChildStats()

    while(
      json.length >
      CONFIG.MAX_LOCAL_STORAGE_SIZE
    ){

      if(stats.history.length === 0){
        break;
      }


      stats.history.shift();


      json =
        JSON.stringify(stats);

    }



    localStorage.setItem(
      key,
      json
    );


  } catch(e){


    console.error(
      '❌ Ошибка сохранения статистики:',
      e
    );


    logError(
      'save_stats',
      e.message
    );


  }


}





export function saveToChildHistory(entry){


  if(
    !entry ||
    !entry.text
  ){
    return;
  }



  const stats =
    getChildStats();



  stats.history.push({


    role:
      entry.role || 'unknown',


    text:
      entry.text,


    timestamp:
      entry.timestamp ||
      Date.now(),


    characterName:
      entry.characterName ||
      null,


    childName:
      entry.childName ||
      getActiveChildName(),


    alerted:
      entry.alerted ||
      false,


    alertWords:
      entry.alertWords ||
      []


  });




  if(
    stats.history.length >
    CONFIG.MAX_HISTORY
  ){

    stats.history =
      stats.history.slice(
        -CONFIG.MAX_HISTORY
      );

  }



  stats.lastActive =
    new Date().toISOString();



  saveChildStats(stats);



  syncGlobalHistory(entry);


}






function syncGlobalHistory(entry){


  try {


    const history =
      JSON.parse(
        localStorage.getItem('history')
        || '[]'
      );



    history.push({


      role:
        entry.role,


      text:
        entry.text,


      timestamp:
        entry.timestamp ||
        Date.now()


    });




    localStorage.setItem(
      'history',
      JSON.stringify(
        history.slice(
          -CONFIG.MAX_HISTORY
        )
      )
    );



  }catch(e){


    console.warn(
      '⚠️ Ошибка синхронизации:',
      e
    );


  }


}






export function updateFearStats(fears){


  if(
    !fears ||
    fears.length===0
  ){
    return;
  }



  const stats =
    getChildStats();




  fears.forEach(fear=>{


    if(
      stats.fearStats[fear] !== undefined
    ){

      stats.fearStats[fear] =
        (stats.fearStats[fear] || 0)
        +1;

    }


  });



  saveChildStats(stats);



  try{


    const global =
      JSON.parse(
        localStorage.getItem('fearStats')
        || '{}'
      );



    fears.forEach(fear=>{


      global[fear] =
        (global[fear] || 0)
        +1;


    });



    localStorage.setItem(
      'fearStats',
      JSON.stringify(global)
    );



  }catch(e){


    console.warn(
      '⚠️ Ошибка страхов',
      e
    );

  }


}





export function incrementStories(){


  const stats =
    getChildStats();



  stats.totalStories =
    (stats.totalStories || 0)
    +1;



  saveChildStats(stats);



  const total =
    parseInt(
      localStorage.getItem('totalStories')
      || '0'
    )
    +1;



  localStorage.setItem(
    'totalStories',
    String(total)
  );



  updateStatsDisplay();


}





export function incrementGames(){


  const stats =
    getChildStats();



  stats.totalGames =
    (stats.totalGames || 0)
    +1;



  saveChildStats(stats);



  const total =
    parseInt(
      localStorage.getItem('totalGames')
      || '0'
    )
    +1;



  localStorage.setItem(
    'totalGames',
    String(total)
  );



  updateStatsDisplay();


}







// ========================================
// UI
// ========================================


function initUI(){


  const avatar =
    document.getElementById('avatar');



  if(avatar){


    avatar.onclick =
      ()=>cycleCharacter(1);


  }






  const parentBtn =
    document.getElementById('parentBtn');



  if(parentBtn){


    parentBtn.onclick =
      ()=>{

        window.location.href =
          '/parent.html';

      };


  }





  const logoutBtn =
    document.getElementById('logoutBtn');



  if(logoutBtn){


    if(
      localStorage.getItem('userToken')
    ){

      logoutBtn.style.display='flex';

    }



    logoutBtn.onclick =
      logout;


  }


}






function initEventListeners(){


  const micBtn =
    document.getElementById('micBtn');



  if(micBtn){


    micBtn.onclick =
      handleMicClick;



    let timer;



    micBtn.onmousedown =
      ()=>{

        timer=setTimeout(
          handleLongPress,
          1500
        );

      };



    micBtn.onmouseup =
      ()=>clearTimeout(timer);



    micBtn.onmouseleave =
      ()=>clearTimeout(timer);


  }



  const gamesBtn =
    document.getElementById('gamesBtn');



  if(gamesBtn){


    gamesBtn.onclick = ()=>{


      incrementGames();


      launchFishGame();


    };


  }



}
// ========================================
// ЗАГРУЗКА СОСТОЯНИЯ
// ========================================


function loadState(){


  const saved =
    localStorage.getItem(
      'currentCharacter'
    )
    || 'lucik';



  setCharacter(saved);



  characterCycleIndex =
    characterIds.indexOf(saved);



  if(characterCycleIndex < 0){

    characterCycleIndex = 0;

  }



  const avatar =
    document.getElementById('avatar');



  if(avatar){


    const char =
      CHARACTERS[saved]
      ||
      CHARACTERS.lucik;



    avatar.style.backgroundImage =
      `url('${char.icon}')`;

  }


}







// ========================================
// СТАТИСТИКА UI
// ========================================


export function updateStatsDisplay(){


  const stats =
    getChildStats();



  const mood =
    document.getElementById(
      'moodFill'
    );


  const hunger =
    document.getElementById(
      'hungerFill'
    );


  const energy =
    document.getElementById(
      'energyFill'
    );


  const bravery =
    document.getElementById(
      'braveryFill'
    );



  if(mood)
    mood.style.width='70%';



  if(hunger)
    hunger.style.width='60%';



  if(energy)
    energy.style.width='50%';




  if(bravery){


    const value =
      Math.min(
        100,
        (stats.totalStories || 0) * 10
        +
        (stats.totalGames || 0) * 5
      );



    bravery.style.width =
      Math.max(5,value)
      + '%';

  }


}







// ========================================
// СМЕНА ПЕРСОНАЖА
// ========================================


export function cycleCharacter(
  direction = 1
){


  let attempts = 0;



  while(attempts < characterIds.length){



    characterCycleIndex =
      (
        characterCycleIndex
        +
        direction
        +
        characterIds.length
      )
      %
      characterIds.length;




    const charId =
      characterIds[
        characterCycleIndex
      ];



    const char =
      CHARACTERS[charId];



    // FIX:
    // защита от битого конфига

    if(!char){

      attempts++;
      continue;

    }




    if(
      char.premium
      &&
      !isPremiumUser()
    ){

      attempts++;
      continue;

    }





    setCharacter(charId);



    localStorage.setItem(
      'currentCharacter',
      charId
    );



    clearContext();



    const avatar =
      document.getElementById(
        'avatar'
      );



    if(avatar){


      avatar.style.backgroundImage =
        `url('${char.icon}')`;



      avatar.style.transform =
        'scale(.85)';



      setTimeout(()=>{


        avatar.style.transform =
          'scale(1)';


      },150);


    }




    trackEvent(
      'character_change',
      charId
    );


    console.log(
      '🎭 Персонаж:',
      char.name
    );


    return;


  }



}






function isPremiumUser(){


  const email =
    localStorage.getItem(
      'userEmail'
    )
    || '';



  if(
    email === 'alexmel669@gmail.com'
    &&
    localStorage.getItem('devUnlocked')
    ===
    '13'
  ){

    return true;

  }



  return (
    localStorage.getItem('premium')
    ===
    'true'
  );


}







// ========================================
// МИКРОФОН
// ========================================


async function handleMicClick(){


  if(isProcessing)
    return;



  const mic =
    document.getElementById(
      'micBtn'
    );



  const avatar =
    document.getElementById(
      'avatar'
    );




  if(isRecording()){


    mic.classList.remove(
      'recording'
    );


    isProcessing=true;



    try{


      const blob =
        await stopRecording();



      if(blob && blob.size){

        await processAudio(blob);

      }



    }catch(e){


      logError(
        'recording',
        e.message
      );


    }finally{


      isProcessing=false;


      if(avatar){

        avatar.classList.remove(
          'listening'
        );


      }


    }




  }else{


    try{


      await startRecording();



      mic.classList.add(
        'recording'
      );


      mic.textContent='⏺️';



      if(avatar)
        avatar.classList.add(
          'listening'
        );



    }catch(e){


      alert(
        '🎤 Нет доступа к микрофону'
      );


      logError(
        'mic',
        e.message
      );


    }


  }


}








async function processAudio(blob){



  const avatar =
    document.getElementById(
      'avatar'
    );



  try{


    const text =
      await recognizeSpeech(blob);




    if(!text){

      await synthesizeSpeech(
        'Я не расслышал. Повтори?',
        getCharacter()
      );

      return;

    }





    if(checkBadWords(text)){


      await synthesizeSpeech(
        'Давай говорить добрые слова!',
        getCharacter()
      );


      return;


    }





    saveToChildHistory({

      role:'child',

      text,

      timestamp:Date.now()

    });




    addToContext(
      'child',
      text
    );




    const fears =
      detectFear(text);



    if(fears.length){

      updateFearStats(fears);

    }




    const reply =
      await generateResponse(text);




    saveToChildHistory({

      role:'bot',

      text:reply,

      timestamp:Date.now(),

      characterName:
        CHARACTERS[getCharacter()]
        ?.name

    });




    addToContext(
      'bot',
      reply
    );




    await synthesizeSpeech(
      reply,
      getCharacter()
    );



    if(reply.length > 200){

      incrementStories();

    }



    checkAchievements();



  }catch(e){


    console.error(
      e
    );


    await synthesizeSpeech(
      'Что-то сломалось. Попробуем ещё раз?',
      getCharacter()
    );


  }finally{


    if(avatar){

      avatar.classList.remove(
        'talking',
        'listening'
      );

    }


  }


}
// ========================================
// РАСПОЗНАВАНИЕ РЕЧИ
// ========================================


async function recognizeSpeech(blob){


  try{


    const base64 =
      await blobToBase64(blob);



    const controller =
      new AbortController();



    const timeout =
      setTimeout(
        ()=>controller.abort(),
        CONFIG.AUDIO_TIMEOUT
      );



    const response =
      await fetch(
        '/api/speech-to-text',
        {

          method:'POST',

          headers:{
            'Content-Type':
            'application/json'
          },

          body:
          JSON.stringify({
            audio:base64
          }),

          signal:
          controller.signal

        }
      );



    clearTimeout(timeout);



    if(response.ok){


      const data =
        await response.json();



      if(data.text){

        return data.text;

      }

    }



  }catch(e){


    console.warn(
      'STT сервер недоступен',
      e.message
    );


  }



  return await browserSpeechRecognition();


}






async function browserSpeechRecognition(){


  return new Promise(resolve=>{


    const SpeechRecognition =
      window.SpeechRecognition
      ||
      window.webkitSpeechRecognition;



    if(!SpeechRecognition){

      resolve('');

      return;

    }




    const recognition =
      new SpeechRecognition();



    recognition.lang =
      'ru-RU';



    recognition.interimResults =
      false;



    recognition.maxAlternatives =
      1;




    let finished=false;




    recognition.onresult =
      e=>{


        if(finished)
          return;



        finished=true;



        resolve(
          e.results[0][0].transcript
        );


      };




    recognition.onerror =
      ()=>{


        if(!finished){

          finished=true;

          resolve('');

        }

      };




    recognition.onend =
      ()=>{


        if(!finished){

          finished=true;

          resolve('');

        }

      };




    try{

      recognition.start();

    }catch(e){

      resolve('');

    }




    setTimeout(()=>{


      if(!finished){

        finished=true;

        recognition.stop();

        resolve('');

      }


    },
    CONFIG.AUDIO_TIMEOUT);



  });


}







function blobToBase64(blob){


  return new Promise(
    (resolve,reject)=>{


      const reader =
        new FileReader();



      reader.onloadend =
        ()=>{


          resolve(
            reader.result
            .split(',')[1]
            || ''
          );


        };



      reader.onerror =
        reject;



      reader.readAsDataURL(blob);


    }
  );


}







// ========================================
// ИГРА
// ========================================


export function launchFishGame(){


  const old =
    document.querySelector(
      '.game-overlay'
    );


  if(old)
    old.remove();




  const overlay =
    document.createElement('div');



  overlay.className =
    'game-overlay';



  overlay.innerHTML = `

<div class="fish-game">

<h2>🎣 Поймай рыбку!</h2>

<div id="fishGameArea"></div>

<div>
🐟 Счёт:
<span id="fishScore">0</span>
</div>

<div>
⏱️
<span id="fishTimer">30</span>
сек
</div>


<button id="fishCloseBtn">
Закрыть
</button>


</div>

`;



  document.body.appendChild(
    overlay
  );




  let score=0;

  let time=30;

  let active=true;



  let fishSpawnInterval=null;



  const area =
    document.getElementById(
      'fishGameArea'
    );



  const scoreEl =
    document.getElementById(
      'fishScore'
    );



  const timerEl =
    document.getElementById(
      'fishTimer'
    );





  const timer =
    setInterval(()=>{


      time--;


      if(timerEl)
        timerEl.textContent=time;



      if(time<=0)
        finish();


    },1000);







  function finish(){


    if(!active)
      return;



    active=false;



    clearInterval(timer);



    // FIX:
    // теперь переменная уже существует

    if(fishSpawnInterval){

      clearInterval(
        fishSpawnInterval
      );

    }




    trackEvent(
      'fish_end',
      String(score)
    );


  }







  function createFish(){


    if(!active)
      return;



    const fish =
      document.createElement('div');



    fish.textContent =
      ['🐟','🐠','🐡']
      [
        Math.floor(
          Math.random()*3
        )
      ];



    fish.style.position =
      'absolute';



    fish.style.left =
      Math.random()*250+'px';



    fish.style.top =
      Math.random()*350+'px';



    fish.style.fontSize =
      '32px';




    fish.onclick =
      ()=>{


        if(!active)
          return;



        score++;



        scoreEl.textContent =
          score;



        fish.remove();



      };



    area.appendChild(
      fish
    );


    setTimeout(()=>{

      if(fish.parentNode)
        fish.remove();

    },5000);



  }






  for(let i=0;i<3;i++)
    createFish();




  fishSpawnInterval =
    setInterval(
      createFish,
      1500
    );






  document
  .getElementById(
    'fishCloseBtn'
  )
  .onclick =
  ()=>{


    active=false;


    clearInterval(timer);


    clearInterval(
      fishSpawnInterval
    );


    overlay.remove();


  };



}








// ========================================
// LOGOUT
// ========================================


function logout(){


  localStorage.removeItem(
    'userToken'
  );


  localStorage.removeItem(
    'userEmail'
  );


  localStorage.removeItem(
    'activeChildIndex'
  );


  clearContext();



  window.location.href =
    '/login.html';


}







// ========================================
// GLOBAL EXPORT
// ========================================


if(typeof window !== 'undefined'){


  window.selectGuestMode =
    selectGuestMode;



  window.cycleCharacter =
    cycleCharacter;



  window.setActiveChild =
    setActiveChild;



  window.getActiveChildName =
    getActiveChildName;



  window.saveToChildHistory =
    saveToChildHistory;



}
