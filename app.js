/* ══════════════════════════════════════
   app.js — НейроПуть — Full redesign
══════════════════════════════════════ */

// ── Polza AI API ──────────────────────────────────────────────────
const OR_KEY   = 'pza_3PUB_A3dUwE9lsjj70C6kcs9SCwVQG6Y';
const OR_URL   = 'https://polza.ai/api/v1/chat/completions';
const OR_MODEL = 'google/gemini-3.1-flash-lite-preview';

async function gemini(systemPrompt, userText) {
  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OR_KEY
      },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userText }
        ],
        temperature: 0.5,
        max_tokens: 2500
      })
    });
    if (!res.ok) {
      const err = await res.json();
      console.error('Polza AI error:', err);
      return 'Ошибка API: ' + (err?.error?.message || res.status);
    }
    const data = await res.json();
    console.log('Polza AI response:', data);
    const text = data?.choices?.[0]?.message?.content;
    if (!text) {
      console.error('Пустой ответ:', JSON.stringify(data));
      return 'AI не вернул текст. Проверь консоль (F12).';
    }
    return text;
  } catch(e) {
    console.error('Fetch error:', e);
    return 'Сетевая ошибка: ' + e.message;
  }
}

// ── AI с изображением (vision) ────────────────────────────────────
async function geminiVision(systemPrompt, userText, base64, mimeType) {
  try {
    const res = await fetch(OR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OR_KEY
      },
      body: JSON.stringify({
        model: OR_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            { type: 'text', text: userText }
          ]}
        ],
        temperature: 0.5,
        max_tokens: 2500
      })
    });
    if (!res.ok) {
      const err = await res.json();
      return 'Ошибка API: ' + (err?.error?.message || res.status);
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content || 'AI не вернул текст.';
  } catch(e) {
    return 'Сетевая ошибка: ' + e.message;
  }
}

// ── Рендер математики через KaTeX ────────────────────────────────────
// Конвертирует простой текст вида "v_0 + a*t^2" в красивые символы
function renderMath(str) {
  if (!str || typeof str !== 'string') return esc(str || '');

  // Заменяем понятные человеку паттерны на LaTeX
  let s = str;

  // Дроби: a/b → \frac{a}{b} — только простые, типа 1/2, s/t, F/m
  s = s.replace(/([A-Za-zА-Яа-яёЁ0-9_]+)\s*\/\s*([A-Za-zА-Яа-яёЁ0-9_]+)/g, (m, a, b) => {
    // Не трогаем единицы типа "м/с", "Дж/кг" — они короткие кириллические
    if (/[А-Яа-яёЁ]/.test(a) || /[А-Яа-яёЁ]/.test(b)) return m;
    return `\\frac{${a}}{${b}}`;
  });

  // Степени: x^2 → x^{2}, v^2 → v^{2}
  s = s.replace(/\^(\d+)/g, '^{$1}');

  // Нижние индексы: v_0 → v_{0}, a_0 → a_{0}
  s = s.replace(/_(\w)/g, '_{$1}');

  // Умножение: a*b → a \cdot b  (но не для e*10 чтобы не сломать числа)
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');

  // sqrt(x) → \sqrt{x}
  s = s.replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}');

  // Попытка рендера через KaTeX
  try {
    if (typeof katex !== 'undefined') {
      return katex.renderToString(s, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
        strict: false
      });
    }
  } catch(e) {
    // если KaTeX ещё не загружен — fallback
  }
  return `<span class="sol-math-fallback">${esc(str)}</span>`;
}

// ── Версия для display-mode (формула на отдельной строке) ─────────────
function renderMathDisplay(str) {
  if (!str || typeof str !== 'string') return esc(str || '');

  let s = str;
  s = s.replace(/([A-Za-zА-Яа-яёЁ0-9_]+)\s*\/\s*([A-Za-zА-Яа-яёЁ0-9_]+)/g, (m, a, b) => {
    if (/[А-Яа-яёЁ]/.test(a) || /[А-Яа-яёЁ]/.test(b)) return m;
    return `\\frac{${a}}{${b}}`;
  });
  s = s.replace(/\^(\d+)/g, '^{$1}');
  s = s.replace(/_(\w)/g, '_{$1}');
  s = s.replace(/\s*\*\s*/g, ' \\cdot ');
  s = s.replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}');

  try {
    if (typeof katex !== 'undefined') {
      return katex.renderToString(s, {
        throwOnError: false,
        displayMode: true,
        output: 'html',
        strict: false
      });
    }
  } catch(e) {}
  return `<span class="sol-math-fallback">${esc(str)}</span>`;
}

// ── Читаем файл как текст или base64 ─────────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result.split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = reject;
    r.readAsText(file, 'UTF-8');
  });
}

// ── State ──────────────────────────────────────────────────────────
let currentUser   = null;
let tutorMode     = 'mentor';
let chatBusy      = false;
let tutorIdx      = 0;
let currentLesson = null;
let sessStart     = null;
let sessTimer     = null;
let duelTimer     = null;
let duelState     = null;
let solveMode     = 'answer';
let selectedClass = null;
let matChatBusy   = false;
let matContext    = null;
let currentProjectId = null;

// ── DB helpers ────────────────────────────────────────────────────
function DB_get(k)    { try { return JSON.parse(localStorage.getItem(k)); } catch(e) { return null; } }
function DB_set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
function allUsers()   { return DB_get('np_users') || {}; }
function saveUsers(u) { DB_set('np_users', u); }
function saveMe()     { const u = allUsers(); u[currentUser.email] = currentUser; saveUsers(u); }

// ── Boot ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const DEV_EMAIL = 'maxim@dev.local';
  const users = allUsers();
  if (!users[DEV_EMAIL]) {
    users[DEV_EMAIL] = {
      name: 'Максим', sname: '', email: DEV_EMAIL, pass: btoa('devpass'),
      goal: 'ege', createdAt: Date.now(), subject: 'physics', perception: 'visual',
      level: 'mid', diagScore: 3, progress: {},
      duelStats: { total: 0, wins: 0, losses: 0, rating: 0 },
      duelHistory: [], streak: 5, lastLogin: null,
      activity: [Date.now()], totalTasks: 0, correctTasks: 0,
      selectedClass: null,
    };
    saveUsers(users);
  }
  currentUser = users[DEV_EMAIL];
  DB_set('np_session', DEV_EMAIL);
  bootDashboard();
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => { s.classList.remove('active'); s.style.display = 'none'; });
  const target = document.getElementById('s-' + id);
  if (!target) return;
  target.style.display = 'block';
  requestAnimationFrame(() => requestAnimationFrame(() => target.classList.add('active')));
}

function setDate() {
  const el = document.getElementById('h-date');
  if (el) el.textContent = new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});
}

// ══════════════════════════════════════
// AUTH
// ══════════════════════════════════════
function switchAuth(mode) {
  document.querySelectorAll('.at-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById('form-' + mode).classList.add('active');
  const tabs = document.querySelectorAll('.at-btn');
  if (mode === 'login') tabs[0].classList.add('active');
  else tabs[1].classList.add('active');
}

function doLogin() {
  const email = document.getElementById('li-email').value.trim();
  const pass  = document.getElementById('li-pass').value;
  const err   = document.getElementById('li-err');
  err.textContent = '';
  if (!email || !pass) { err.textContent = 'Заполни все поля'; return; }
  const users = allUsers();
  const user  = users[email];
  if (!user) { err.textContent = 'Пользователь не найден'; return; }
  if (user.pass !== btoa(pass)) { err.textContent = 'Неверный пароль'; return; }
  currentUser = user;
  DB_set('np_session', email);
  bootDashboard();
}

function doRegister() {
  const name  = document.getElementById('ri-name').value.trim();
  const email = document.getElementById('ri-email').value.trim();
  const pass  = document.getElementById('ri-pass').value;
  const err   = document.getElementById('ri-err');
  err.textContent = '';
  if (!name || !email || !pass) { err.textContent = 'Заполни все поля'; return; }
  if (pass.length < 6) { err.textContent = 'Пароль минимум 6 символов'; return; }
  if (!/\S+@\S+\.\S+/.test(email)) { err.textContent = 'Некорректный email'; return; }
  const users = allUsers();
  if (users[email]) { err.textContent = 'Этот email уже зарегистрирован'; return; }
  const newUser = {
    name, sname: '', email, pass: btoa(pass), goal: 'ege',
    createdAt: Date.now(), subject: null, perception: null,
    level: null, diagScore: 0, progress: {},
    duelStats: {total:0,wins:0,losses:0,rating:0},
    duelHistory: [], streak: 0, lastLogin: null,
    activity: [], totalTasks: 0, correctTasks: 0,
    selectedClass: null,
  };
  users[email] = newUser;
  saveUsers(users);
  currentUser = newUser;
  DB_set('np_session', email);
  showScreen('ob');
  obGo(1);
}

function logout() {
  DB_set('np_session', null);
  currentUser = null;
  showScreen('auth');
}

// ══════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════
let ob_subject = null, ob_perc = null, diagAnswers = [];

function obGo(step) {
  document.querySelectorAll('.ob-step').forEach(s => s.classList.remove('active'));
  const stepEl = document.getElementById('ob' + step);
  if (stepEl) { void stepEl.offsetWidth; stepEl.classList.add('active'); }
  if (step === 3) buildDiag();
}

function pickSubject(card) {
  if (card.classList.contains('sc-locked')) return;
  document.querySelectorAll('.subj-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  ob_subject = card.dataset.s;
  document.getElementById('ob1-next').disabled = false;
}

function pickPerc(card) {
  document.querySelectorAll('.perc-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  ob_perc = card.dataset.p;
  document.getElementById('ob2-next').disabled = false;
}

let diagDone = 0;
function buildDiag() {
  diagAnswers = new Array(DIAG_QS.length).fill(null);
  diagDone = 0;
  const wrap = document.getElementById('diag-container');
  wrap.innerHTML = '';
  DIAG_QS.forEach((q, qi) => {
    const div = document.createElement('div');
    div.className = 'diag-q';
    div.style.animationDelay = (qi * .07) + 's';
    div.innerHTML = `
      <div class="diag-q-num">Вопрос ${qi+1} из ${DIAG_QS.length}</div>
      <div class="diag-q-text">${q.text}</div>
      <div class="diag-opts" id="dq-${qi}">
        ${q.opts.map((o,oi)=>`<button class="diag-opt" onclick="answerDiag(${qi},${oi})">${o}</button>`).join('')}
      </div>
      <div class="diag-fb" id="dfb-${qi}"></div>
    `;
    wrap.appendChild(div);
  });
  document.getElementById('diag-submit-row').style.display = 'none';
}

function answerDiag(qi, oi) {
  const q = DIAG_QS[qi];
  const opts = document.getElementById('dq-' + qi);
  const fb   = document.getElementById('dfb-' + qi);
  if (diagAnswers[qi] !== null) return;
  opts.querySelectorAll('.diag-opt').forEach(b => b.disabled = true);
  const correct = oi === q.correct;
  opts.querySelectorAll('.diag-opt')[oi].classList.add(correct ? 'correct' : 'wrong');
  if (!correct) opts.querySelectorAll('.diag-opt')[q.correct].classList.add('correct');
  fb.textContent = correct ? 'Верно!' : 'Ответ неверный';
  fb.className = 'diag-fb ' + (correct ? 'ok' : 'err');
  diagAnswers[qi] = oi;
  diagDone++;
  if (diagDone === DIAG_QS.length) document.getElementById('diag-submit-row').style.display = 'flex';
}

function finishDiag() {
  if (!ob_subject) { toast('Выбери предмет на шаге 1'); obGo(1); return; }
  if (!ob_perc)    { toast('Выбери тип восприятия на шаге 2'); obGo(2); return; }
  const score = diagAnswers.filter((a,i) => a !== null && a === DIAG_QS[i].correct).length;
  let level = 'base';
  if (score >= 4) level = 'hard';
  else if (score >= 2) level = 'mid';
  currentUser.subject    = ob_subject;
  currentUser.perception = ob_perc;
  currentUser.level      = level;
  currentUser.diagScore  = score;
  currentUser.progress   = {};
  currentUser.streak     = 1;
  currentUser.lastLogin  = today();
  currentUser.activity   = [Date.now()];
  saveMe();
  toast(`Уровень определён: ${levelName(level)} (${score}/5)`);
  bootDashboard();
}

function levelName(l) {
  return l === 'hard' ? 'Продвинутый' : l === 'mid' ? 'Средний' : 'Начальный';
}
function today() { return new Date().toDateString(); }

// ══════════════════════════════════════
// DASHBOARD BOOT
// ══════════════════════════════════════
function bootDashboard() {
  if (!currentUser.subject) { showScreen('ob'); obGo(1); return; }
  updateStreak();
  showScreen('dash');
  setDate();
  document.getElementById('sb-av').textContent = currentUser.name[0].toUpperCase();
  document.getElementById('sb-nm').textContent = currentUser.name;
  const hDate = document.getElementById('h-date');
  if (hDate) hDate.textContent = new Date().toLocaleDateString('ru-RU',{weekday:'long',day:'numeric',month:'long'});

  selectedClass = currentUser.selectedClass || null;

  renderHome();
  renderLeaderboard();
  renderDuelStats();
  renderProfile();
  initTutor();
  renderSavedTasks();
  goTab('home', document.querySelector('[data-t=home]'));
  setTimeout(runHomeGreeting, 150);
}

function updateStreak() {
  const u = currentUser;
  const t = today();
  if (u.lastLogin === t) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  if (u.lastLogin === yesterday.toDateString()) u.streak = (u.streak||0) + 1;
  else u.streak = 1;
  u.lastLogin = t;
  u.activity = [...(u.activity||[]), Date.now()].slice(-50);
  saveMe();
}

// ══════════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════════
function goTab(name, link) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById('t-' + name);
  if (tabEl) { void tabEl.offsetWidth; tabEl.classList.add('active'); }
  document.querySelectorAll('.sn').forEach(s => s.classList.remove('active'));
  const target = link || document.querySelector('[data-t=' + name + ']');
  if (target) target.classList.add('active');
  syncMobileNav(name);
  if (name === 'learn') { hideLearnSections(); renderLessonsTab(); }
  if (name === 'profile') renderProfile();
  if (name === 'duels') renderDuelStats();
  if (name === 'projects') renderProjects();
  if (name === 'tutor') { if (!activeChatId) activeChatId = 'chat_' + Date.now(); renderChatHistory(); }
  // Показываем/скрываем подветку "Мои проекты" в сайдбаре
  const subLink = document.getElementById('sn-projects-sub');
  if (subLink) {
    subLink.classList.toggle('visible', name === 'learn' || name === 'projects');
  }
  if (name === 'home') setTimeout(runHomeGreeting, 50);
}

// ══════════════════════════════════════
// HOME
// ══════════════════════════════════════
function renderHome() {
  const u = currentUser;
  const lessonsDone = Object.values(u.progress||{}).filter(p=>p.done).length;
  const acc = u.totalTasks > 0 ? Math.round((u.correctTasks / u.totalTasks)*100) : null;

  const kl = document.getElementById('k-lessons');
  const kt = document.getElementById('k-tasks');
  const ks = document.getElementById('k-streak');
  const kr = document.getElementById('k-rating');
  if (kl) kl.textContent = lessonsDone;
  if (kt) kt.textContent = u.totalTasks || 0;
  if (ks) ks.textContent = u.streak || 0;
  if (kr) kr.textContent = u.duelStats?.rating || 0;
}

// ══════════════════════════════════════
// LESSONS — CLASSES + CHAPTERS
// ══════════════════════════════════════

// Physics by class data
const PHYSICS_BY_CLASS = {
  7: {
    label: '7 класс — Введение в физику',
    chapters: [
      {
        name: 'Физические явления и методы',
        glyph: '◎',
        lessons: [
          { id:'c7-1-1', title:'Что изучает физика', duration:15, blocks:[
            {type:'theory', title:'Физика как наука', text:'Физика — наука о природе, изучающая простейшие и наиболее общие закономерности природных явлений.'},
            {type:'formula', title:'Физическая величина', formula:'x = числовое значение × единица', hint:'Любая физическая величина имеет числовое значение и единицу измерения.'},
          ], questions:[
            {text:'Что изучает физика?', opts:['Только движение тел','Природные явления и их закономерности','Только химические реакции','Только живые организмы'], correct:1, expl:'Физика изучает природные явления и их закономерности.'},
          ]},
          { id:'c7-1-2', title:'Физические величины и измерения', duration:20, blocks:[
            {type:'theory', title:'Измерение', text:'Измерение — сравнение физической величины с однородной ей величиной, принятой за единицу.'},
            {type:'formula', title:'Погрешность', formula:'Δx = x_max − x_min / 2', hint:'Абсолютная погрешность измерения.'},
          ], questions:[
            {text:'Что такое эталон?', opts:['Любой прибор','Образцовая мера физической величины','Формула','Величина без единиц'], correct:1, expl:'Эталон — образцовая мера.'},
          ]},
        ]
      },
      {
        name: 'Строение вещества',
        glyph: '◉',
        lessons: [
          { id:'c7-2-1', title:'Молекулы и атомы', duration:18, blocks:[
            {type:'theory', title:'Атомно-молекулярное строение', text:'Все вещества состоят из атомов и молекул. Молекулы — мельчайшие частицы вещества, сохраняющие его химические свойства.'},
          ], questions:[
            {text:'Из чего состоят все вещества?', opts:['Из клеток','Из атомов и молекул','Из электронов только','Из фотонов'], correct:1, expl:'Все вещества состоят из атомов и молекул.'},
          ]},
          { id:'c7-2-2', title:'Диффузия. Взаимодействие молекул', duration:20, blocks:[
            {type:'theory', title:'Диффузия', text:'Диффузия — взаимное проникновение молекул одного вещества между молекулами другого.'},
            {type:'analogy', text:'Представь каплю чернил в воде — через время цвет распространяется равномерно. Это и есть диффузия.'},
          ], questions:[
            {text:'Что такое диффузия?', opts:['Сжатие газа','Взаимное проникновение молекул','Нагревание тела','Электрический ток'], correct:1, expl:'Диффузия — взаимное проникновение молекул.'},
          ]},
        ]
      },
    ]
  },
  8: {
    label: '8 класс — Тепловые явления',
    chapters: [
      {
        name: 'Тепловые явления',
        glyph: '∮',
        lessons: [
          { id:'c8-1-1', title:'Тепловое движение. Температура', duration:20, blocks:[
            {type:'theory', title:'Тепловое движение', text:'Хаотическое движение молекул называется тепловым. Температура характеризует среднюю кинетическую энергию молекул.'},
            {type:'formula', title:'Шкала Цельсия и Кельвина', formula:'T = t + 273 (К)', hint:'T — абсолютная температура, t — температура в Цельсиях.'},
          ], questions:[
            {text:'Что характеризует температура?', opts:['Массу тела','Скорость звука','Среднюю кинетическую энергию молекул','Объём тела'], correct:2, expl:'Температура — мера средней кинетической энергии молекул.'},
          ]},
          { id:'c8-1-2', title:'Внутренняя энергия. Виды теплообмена', duration:22, blocks:[
            {type:'theory', title:'Внутренняя энергия', text:'Внутренняя энергия — сумма кинетических и потенциальных энергий всех молекул тела.'},
            {type:'formula', title:'Количество теплоты', formula:'Q = cm(t₂ − t₁)', hint:'c — удельная теплоёмкость, m — масса, Δt — изменение температуры.'},
          ], questions:[
            {text:'Формула количества теплоты при нагревании?', opts:['Q = mv²/2','Q = cm·Δt','Q = mgh','Q = UI·t'], correct:1, expl:'Q = cm·Δt — основная формула теплообмена.'},
          ]},
        ]
      },
      {
        name: 'Электрические явления',
        glyph: '⚡',
        lessons: [
          { id:'c8-2-1', title:'Электрический заряд. Закон Кулона', duration:25, blocks:[
            {type:'theory', title:'Электрический заряд', text:'Электрический заряд — фундаментальное свойство частиц. Существуют положительные и отрицательные заряды.'},
            {type:'formula', title:'Закон Кулона', formula:'F = k·q₁·q₂/r²', hint:'k = 9·10⁹ Н·м²/Кл² — коэффициент пропорциональности.'},
          ], questions:[
            {text:'Закон Кулона описывает?', opts:['Движение тел','Силу взаимодействия зарядов','Нагревание тел','Преломление света'], correct:1, expl:'Закон Кулона — сила взаимодействия точечных зарядов.'},
          ]},
        ]
      },
    ]
  },
  9: {
    label: '9 класс — Законы Ньютона. Основы механики',
    chapters: PHYSICS.chapters  // use existing data for 9th grade
  },
  10: {
    label: '10 класс — Механика и молекулярная физика',
    chapters: [
      {
        name: 'Кинематика',
        glyph: '→',
        lessons: [
          { id:'c10-1-1', title:'Механическое движение. Кинематика', duration:25, blocks:[
            {type:'theory', title:'Механическое движение', text:'Механическое движение — изменение положения тела в пространстве относительно других тел с течением времени.'},
            {type:'formula', title:'Равномерное прямолинейное движение', formula:'x = x₀ + v·t', hint:'x₀ — начальная координата, v — скорость, t — время.'},
            {type:'formula', title:'Равноускоренное движение', formula:'v = v₀ + at\nx = x₀ + v₀t + at²/2', hint:'a — ускорение'},
          ], questions:[
            {text:'Формула пути при равноускоренном движении?', opts:['s = vt','s = v₀t + at²/2','s = at','s = v²/2a'], correct:1, expl:'s = v₀t + at²/2 — основная формула кинематики.'},
            {text:'Единица измерения ускорения?', opts:['м/с','м','м/с²','Н'], correct:2, expl:'Ускорение измеряется в м/с².'},
          ]},
          { id:'c10-1-2', title:'Движение по окружности', duration:20, blocks:[
            {type:'theory', title:'Период и частота', text:'Период T — время одного полного оборота. Частота ν = 1/T.'},
            {type:'formula', title:'Центростремительное ускорение', formula:'a = v²/R = ω²R', hint:'R — радиус окружности, v — линейная скорость, ω — угловая скорость.'},
          ], questions:[
            {text:'Что такое период обращения?', opts:['Скорость тела','Время одного полного оборота','Угловая скорость','Радиус орбиты'], correct:1, expl:'Период — время одного полного оборота.'},
          ]},
        ]
      },
      {
        name: 'Динамика',
        glyph: 'F',
        lessons: [
          { id:'c10-2-1', title:'Законы Ньютона', duration:28, blocks:[
            {type:'theory', title:'Первый закон Ньютона', text:'Тело сохраняет состояние покоя или равномерного прямолинейного движения, если на него не действуют силы или их равнодействующая равна нулю.'},
            {type:'formula', title:'Второй закон Ньютона', formula:'F = ma', hint:'F — сила (Н), m — масса (кг), a — ускорение (м/с²)'},
            {type:'formula', title:'Третий закон Ньютона', formula:'F₁₂ = −F₂₁', hint:'Силы действия и противодействия равны по модулю, противоположны по направлению.'},
            {type:'analogy', text:'Ракета движется вперёд потому, что газы выбрасываются назад — это третий закон Ньютона в действии.'},
          ], questions:[
            {text:'Второй закон Ньютона?', opts:['F = mv','F = ma','a = F/v','m = Fa'], correct:1, expl:'F = ma — второй закон Ньютона.'},
            {text:'Что такое инерция?', opts:['Сила притяжения','Свойство тела сохранять скорость','Ускорение тела','Масса тела'], correct:1, expl:'Инерция — свойство сохранять скорость движения.'},
          ]},
        ]
      },
    ]
  },
  11: {
    label: '11 класс — Электродинамика и оптика',
    chapters: [
      {
        name: 'Электромагнитное поле',
        glyph: '∮',
        lessons: [
          { id:'c11-1-1', title:'Закон электромагнитной индукции', duration:28, blocks:[
            {type:'theory', title:'Электромагнитная индукция', text:'Явление возникновения ЭДС в проводнике при изменении магнитного потока через поверхность, ограниченную этим проводником.'},
            {type:'formula', title:'Закон Фарадея', formula:'ε = −ΔΦ/Δt', hint:'ε — ЭДС индукции, ΔΦ — изменение магнитного потока.'},
          ], questions:[
            {text:'Что такое электромагнитная индукция?', opts:['Намагничивание железа','Возникновение ЭДС при изменении магнитного потока','Движение зарядов в вакууме','Трение тел'], correct:1, expl:'Явление возникновения ЭДС при изменении магнитного потока.'},
          ]},
          { id:'c11-1-2', title:'Переменный ток. Трансформаторы', duration:24, blocks:[
            {type:'theory', title:'Переменный ток', text:'Переменный ток периодически меняет направление и величину.'},
            {type:'formula', title:'Трансформатор', formula:'U₁/U₂ = n₁/n₂', hint:'n — число витков обмотки.'},
          ], questions:[
            {text:'Принцип действия трансформатора основан на?', opts:['Законе Ома','Электромагнитной индукции','Законе Кулона','Законе Архимеда'], correct:1, expl:'Трансформатор работает на принципе электромагнитной индукции.'},
          ]},
        ]
      },
      {
        name: 'Оптика',
        glyph: '◈',
        lessons: [
          { id:'c11-2-1', title:'Законы геометрической оптики', duration:22, blocks:[
            {type:'theory', title:'Законы отражения и преломления', text:'Угол отражения равен углу падения. При преломлении выполняется закон Снеллиуса.'},
            {type:'formula', title:'Закон преломления (Снеллиус)', formula:'n₁·sin α = n₂·sin β', hint:'n — показатель преломления среды.'},
            {type:'formula', title:'Формула тонкой линзы', formula:'1/f = 1/d₀ + 1/dᵢ', hint:'f — фокусное расстояние, d₀ — расстояние до предмета, dᵢ — до изображения.'},
          ], questions:[
            {text:'Закон Снеллиуса описывает?', opts:['Отражение света','Преломление света','Дифракцию','Интерференцию'], correct:1, expl:'Закон Снеллиуса — закон преломления света.'},
          ]},
        ]
      },
    ]
  }
};

let currentPhysicsData = null;

function renderLessonsTab() {
  const u = currentUser;
  if (!selectedClass) {
    document.getElementById('class-selector').style.display = 'block';
    document.getElementById('lessons-shell').style.display = 'none';
    return;
  }
  document.getElementById('class-selector').style.display = 'none';
  document.getElementById('lessons-shell').style.display = 'grid';
  currentPhysicsData = PHYSICS_BY_CLASS[selectedClass];
  renderChapters();
}

function selectClass(btn, classNum) {
  selectedClass = classNum;
  currentUser.selectedClass = classNum;
  saveMe();

  document.querySelectorAll('.cs-btn').forEach(b => b.classList.remove('selected'));
  if (btn) btn.classList.add('selected');
  else {
    const btns = document.querySelectorAll('.cs-btn');
    btns.forEach(b => { if (parseInt(b.textContent) === classNum) b.classList.add('selected'); });
  }
  renderLessonsTab();
}

function renderChapters() {
  const u   = currentUser;
  const col = document.getElementById('chapters-col');
  col.innerHTML = '';

  if (!currentPhysicsData) return;

  currentPhysicsData.chapters.forEach((ch, ci) => {
    const block = document.createElement('div');
    block.className = 'chapter-block';
    const doneLessons = ch.lessons.filter(l=>(u.progress||{})[l.id]?.done).length;
    block.innerHTML = `
      <div class="ch-head" onclick="toggleChapter(this)">
        <span class="ch-name">${ch.glyph} ${ch.name}</span>
        <span class="ch-count">${doneLessons}/${ch.lessons.length}</span>
      </div>
      <div class="ch-lessons" style="display:none">
        ${ch.lessons.map((ls, li) => {
          const p    = (u.progress||{})[ls.id];
          const done = p && p.done;
          return `
            <div class="lesson-row ${done?'lr-done':''}" id="lr-${ci}-${li}"
              onclick="openLesson(${ci},${li}); document.querySelectorAll('.lesson-row').forEach(r=>r.classList.remove('lr-active')); this.classList.add('lr-active')">
              <div class="lr-icon">${done ? '✓' : ch.glyph}</div>
              <div class="lr-info">
                <div class="lr-title">${ls.title}</div>
                <div class="lr-meta">${ls.duration} мин</div>
              </div>
              <div class="lr-status ${done ? 'done' : ''}">${done ? 'Пройден' : ''}</div>
            </div>`;
        }).join('')}
      </div>
    `;
    col.appendChild(block);
  });

  const first = col.querySelector('.ch-head');
  if (first) toggleChapter(first);
}

function toggleChapter(head) {
  const lessons = head.nextElementSibling;
  lessons.style.display = lessons.style.display === 'none' ? 'block' : 'none';
}

// ══════════════════════════════════════
// INLINE LESSON
// ══════════════════════════════════════
function openLesson(ci, li) {
  if (!currentPhysicsData) return;
  const ch = currentPhysicsData.chapters[ci];
  if (!ch) return;
  const ls = ch.lessons[li];
  if (!ls) return;
  currentLesson = { ci, li, answered: new Set(), correctCount: 0 };

  document.getElementById('il-breadcrumb').textContent = ch.name;
  document.getElementById('il-title').textContent      = ls.title;
  document.getElementById('il-prog').style.width       = '0%';
  document.getElementById('il-prog-txt').textContent   = '0% выполнено';
  document.getElementById('il-footer').style.display   = 'none';

  document.querySelectorAll('.lesson-row').forEach(r => r.classList.remove('lr-active'));

  const body = document.getElementById('il-body');
  body.innerHTML = '';

  (ls.blocks || []).forEach(b => {
    const d = document.createElement('div');
    d.className = 'cb';
    if (b.type === 'theory') {
      d.innerHTML = `<div class="cb-tag">Теория</div><h3>${b.title}</h3><p>${b.text}</p>`;
    } else if (b.type === 'formula') {
      d.innerHTML = `<div class="cb-tag">Формула</div><h3>${b.title}</h3>
        <div class="cb-formula">${b.formula}</div>
        ${b.hint ? `<div class="cb-hint">${b.hint}</div>` : ''}`;
    } else if (b.type === 'analogy') {
      d.innerHTML = `<div class="cb-analogy"><div class="cb-analogy-tag">Аналогия</div><p>${b.text}</p></div>`;
      d.style.cssText = 'background:transparent;border:none;padding:0';
    }
    body.appendChild(d);
  });

  (ls.questions || []).forEach((q, qi) => {
    const d = document.createElement('div');
    d.className = 'q-block';
    d.id = 'qb-' + qi;
    d.innerHTML = `
      <div class="q-tag">Задача ${qi+1} из ${ls.questions.length}</div>
      <div class="q-text">${q.text}</div>
      <div class="opts-grid" id="og-${qi}">
        ${q.opts.map((o,oi)=>`<button class="opt-btn" onclick="answerLesson(${qi},${oi})">${o}</button>`).join('')}
      </div>
      <div class="q-fb" id="qfb-${qi}"></div>
    `;
    body.appendChild(d);
  });

  sessStart = Date.now();
  clearInterval(sessTimer);

  document.getElementById('lv-placeholder').style.display = 'none';
  const panel = document.getElementById('inline-lesson');
  panel.style.display = 'flex';
  void panel.offsetWidth;
  panel.classList.add('il-open');
  document.getElementById('il-body').scrollTop = 0;
}

function answerLesson(qi, oi) {
  if (!currentPhysicsData || !currentLesson) return;
  const ls = currentPhysicsData.chapters[currentLesson.ci].lessons[currentLesson.li];
  const q  = ls.questions[qi];
  if (currentLesson.answered.has(qi)) return;

  const opts = document.getElementById('og-' + qi);
  const fb   = document.getElementById('qfb-' + qi);
  opts.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);

  const correct = oi === q.correct;
  opts.querySelectorAll('.opt-btn')[oi].classList.add(correct ? 'correct' : 'wrong');
  if (!correct) opts.querySelectorAll('.opt-btn')[q.correct].classList.add('correct');

  fb.textContent = correct ? ('Верно! ' + (q.expl||'')) : ('Неверно. ' + (q.expl||''));
  fb.className = 'q-fb ' + (correct ? 'ok' : 'fail');

  currentLesson.answered.add(qi);
  if (correct) currentLesson.correctCount++;
  currentUser.totalTasks   = (currentUser.totalTasks||0) + 1;
  currentUser.correctTasks = (currentUser.correctTasks||0) + (correct ? 1 : 0);

  const pct = Math.round((currentLesson.answered.size / ls.questions.length) * 100);
  document.getElementById('il-prog').style.width     = pct + '%';
  document.getElementById('il-prog-txt').textContent = pct + '% выполнено';

  if (currentLesson.answered.size === ls.questions.length) {
    document.getElementById('il-footer').style.display = 'flex';
  }
  saveMe();
}

function completeLesson() {
  if (!currentPhysicsData || !currentLesson) return;
  const ls = currentPhysicsData.chapters[currentLesson.ci].lessons[currentLesson.li];
  if (!currentUser.progress) currentUser.progress = {};
  currentUser.progress[ls.id] = { done:true, score:currentLesson.correctCount, answersTotal:ls.questions.length };
  saveMe();
  toast(`Урок завершён! ${currentLesson.correctCount}/${ls.questions.length} верных`);
  closeLesson();
  renderHome();
  renderChapters();
}

function closeLesson() {
  const panel = document.getElementById('inline-lesson');
  panel.classList.remove('il-open');
  panel.style.display = 'none';
  document.getElementById('lv-placeholder').style.display = 'flex';
  document.querySelectorAll('.lesson-row').forEach(r => r.classList.remove('lr-active'));
  currentLesson = null;
}

// ══════════════════════════════════════
// SOLVE TASK — 3 экрана
// ══════════════════════════════════════
function setSolveMode(mode, el) {
  solveMode = mode;
  document.querySelectorAll('.sv1-mode').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
}

function svShow(n) {
  for (let i = 1; i <= 3; i++) {
    const s = document.getElementById('sv-screen-' + i);
    if (s) s.style.display = i === n ? 'block' : 'none';
  }
}

// ── Экран 2: анимация шагов ──────────────────────
// Анимация НЕ привязана к реальному времени ответа:
// она идёт на фиксированных задержках, а когда API
// отвечает раньше — ждём, чтобы прошли все шаги.
let sv2Timer = null;
let sv2ApiReply = null;   // ответ API когда придёт
let sv2Done = false;      // флаг: анимация завершена
let sv2ApiDone = false;   // флаг: API ответил

function startSv2() {
  svShow(2);
  sv2ApiReply = null;
  sv2Done = false;
  sv2ApiDone = false;

  const steps = document.querySelectorAll('.sv2-step');
  const pctEl = document.getElementById('sv2-pct');
  const etaEl = document.getElementById('sv2-eta');
  steps.forEach(s => s.classList.remove('active','done'));
  let cur = 0;
  steps[0].classList.add('active');
  pctEl.textContent = '5%';
  etaEl.textContent = 'осталось ~00:28 секунд';

  // Задержки между шагами: суммарно ~28 сек
  const delays = [6000, 6000, 6000, 5000, 5000];

  function nextStep() {
    if (cur >= steps.length - 1) {
      // Последний шаг уже активен — завершаем анимацию
      sv2Done = true;
      pctEl.textContent = '100%';
      etaEl.textContent = 'Готово!';
      steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
      // Если API уже ответил — переходим
      if (sv2ApiDone) showSv3(sv2ApiReply);
      return;
    }
    steps[cur].classList.remove('active');
    steps[cur].classList.add('done');
    cur++;
    steps[cur].classList.add('active');
    const pct = Math.round(((cur + 1) / steps.length) * 90);
    pctEl.textContent = pct + '%';
    const secsLeft = Math.round(delays.slice(cur).reduce((a,b)=>a+b,0) / 1000);
    const mm = String(Math.floor(secsLeft/60)).padStart(2,'0');
    const ss = String(secsLeft%60).padStart(2,'0');
    etaEl.textContent = `осталось ~${mm}:${ss} секунд`;
    sv2Timer = setTimeout(nextStep, delays[cur]);
  }

  sv2Timer = setTimeout(nextStep, delays[0]);
}

// Вызывается когда API ответил
function onApiReply(reply) {
  sv2ApiReply = reply;
  sv2ApiDone  = true;
  clearTimeout(sv2Timer);
  if (sv2Done) {
    showSv3(reply);
  } else {
    // Быстро досматриваем оставшиеся шаги (по 600мс)
    const steps = document.querySelectorAll('.sv2-step');
    const pctEl = document.getElementById('sv2-pct');
    const etaEl = document.getElementById('sv2-eta');
    let cur2 = Array.from(steps).findIndex(s => s.classList.contains('active'));
    if (cur2 < 0) cur2 = steps.length - 1;

    function quickFinish() {
      if (cur2 >= steps.length - 1) {
        steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
        pctEl.textContent = '100%';
        etaEl.textContent = 'Готово!';
        sv2Done = true;
        setTimeout(() => showSv3(reply), 400);
        return;
      }
      steps[cur2].classList.remove('active');
      steps[cur2].classList.add('done');
      cur2++;
      steps[cur2].classList.add('active');
      pctEl.textContent = Math.round(((cur2+1)/steps.length)*95) + '%';
      setTimeout(quickFinish, 500);
    }
    quickFinish();
  }
}

function showSv3(reply) {
  svShow(3);
  sv3AddMsg('<div class="sol-answer-wrap">' + renderSolveAnswer(reply) + '</div>', false);
  // Сохранить задачу
  saveSolvedTask(
    document.getElementById('solve-inp').value.trim(),
    reply
  );
  renderSavedTasks();
}

// ── История задач ────────────────────────────────
function getSavedTasks() {
  try { return JSON.parse(localStorage.getItem('solved_tasks') || '[]'); } catch { return []; }
}
function saveSolvedTask(question, reply) {
  if (!question) return;
  const tasks = getSavedTasks();
  tasks.unshift({ id: Date.now(), q: question.slice(0,120), r: reply, ts: new Date().toLocaleDateString('ru') });
  if (tasks.length > 50) tasks.pop();
  localStorage.setItem('solved_tasks', JSON.stringify(tasks));
}
function renderSavedTasks() {
  const tasks = getSavedTasks();
  const list  = document.getElementById('sv1-tasks-list');
  const empty = document.getElementById('sv1-tasks-empty');
  const cnt   = document.getElementById('sv1-tasks-count');
  if (!list) return;
  if (cnt) cnt.textContent = tasks.length;
  list.querySelectorAll('.sv1-task-item').forEach(e => e.remove());
  if (tasks.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';
  tasks.forEach(t => {
    const d = document.createElement('div');
    d.className = 'sv1-task-item';
    d.innerHTML = `<div class="sv1-ti-q">${esc(t.q)}</div><div class="sv1-ti-date">${t.ts}</div>`;
    d.onclick = () => {
      svShow(3);
      document.getElementById('sv3-messages').innerHTML = '';
      document.getElementById('sv3-task-bubble').textContent = t.q;
      sv3AddMsg(renderSolveAnswer(t.r), false);
      // Восстановить текст задачи
      const inp = document.getElementById('solve-inp');
      if (inp) inp.value = t.q;
    };
    list.appendChild(d);
  });
}
function openSavedTasks() { /* кнопка в хедере — просто скролл к панели на мобиле */ }

// ── Экран 3: сообщения ──────────────────────────
function sv3AddMsg(html, isUser) {
  const msgs = document.getElementById('sv3-messages');
  const d = document.createElement('div');
  d.className = isUser ? 'sv3-msg sv3-msg-user' : 'sv3-msg sv3-msg-bot';
  if (isUser) {
    d.innerHTML = `<div class="sv3-bbl">${esc(html)}</div>`;
  } else {
    d.innerHTML = `<div class="sv3-ai-av">AI</div><div class="sv3-bbl-bot">${html}</div>`;
  }
  msgs.appendChild(d);
  msgs.scrollTop = msgs.scrollHeight;
  return d;
}

// ── Конвертация текста формулы в KaTeX ──────────────────────────────
// Стратегия: math-часть через KaTeX, единицы измерения — отдельным <span>
// display=true означает только выравнивание, НЕ displayMode KaTeX
function toKatex(str, display) {
  if (!str) return '';
  const s = str.trim();

  // Словарь единиц измерения с их правильным написанием
  // Паттерн: пробел + кириллическое слово (возможно с /с, /с^2 и т.д.)
  // Разбиваем строку на сегменты: [math_текст] [пробел+единица] [math_текст] ...
  const parts = [];
  // Единица: пробел, затем кириллица + возможные латиница/цифры/слэш/степень
  // Примеры: " м/с", " м/с^2", " кг", " Н", " Дж", " с", " А", " Вт", " Ом"
  const unitRegex = /(\s+)([А-Яа-яёЁ][А-Яа-яёЁA-Za-z0-9]*(?:\/[А-Яа-яёЁA-Za-z0-9]+)?(?:\^[0-9]+)?)/g;
  let lastIdx = 0;
  let match;

  while ((match = unitRegex.exec(s)) !== null) {
    if (match.index > lastIdx) {
      parts.push({ type: 'math', text: s.slice(lastIdx, match.index) });
    }
    // Конвертируем ^2 → ² для отображения единицы
    const rawUnit = match[2];
    const supMap = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
    const prettyUnit = rawUnit.replace(/\^([0-9]+)/g, (_, n) => n.split('').map(d => supMap[d]||d).join(''));
    parts.push({ type: 'unit', text: prettyUnit });
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < s.length) {
    parts.push({ type: 'math', text: s.slice(lastIdx) });
  }
  if (parts.length === 0) {
    parts.push({ type: 'math', text: s });
  }

  // Преобразование math-сегмента в LaTeX
  function toLatex(raw) {
    let t = raw.trim();
    if (!t) return t;
    // нижние индексы: v_0 → v_{0}, v_avg → v_{avg}
    t = t.replace(/_([A-Za-z0-9]+)/g, '_{$1}');
    // автоиндекс одна буква + цифры: v0 → v_{0}
    t = t.replace(/\b([A-Za-z]{1,3})([0-9]+)\b/g, '$1_{$2}');
    // степени: x^2 → x^{2}
    t = t.replace(/\^([A-Za-z0-9]+)/g, '^{$1}');
    // умножение: a*b → a \cdot b
    t = t.replace(/\s*\*\s*/g, ' \\cdot ');
    // корень: sqrt(x) → \sqrt{x}
    t = t.replace(/sqrt\(([^)]+)\)/gi, '\\sqrt{$1}');
    // дроби только из латинских/цифровых частей: a/b → \frac{a}{b}
    t = t.replace(/([A-Za-z0-9_{}\^{}\\]+)\s*\/\s*([A-Za-z0-9_{}\^{}\\]+)/g,
      (m, a, b) => `\\frac{${a}}{${b}}`);
    return t;
  }

  let html = '';
  for (const p of parts) {
    if (p.type === 'unit') {
      html += `<span class="sol-unit">\u2009${esc(p.text)}</span>`;
    } else {
      const latex = toLatex(p.text);
      if (!latex.trim()) continue;
      try {
        if (typeof katex !== 'undefined') {
          html += katex.renderToString(latex, {
            throwOnError: false,
            displayMode: false,   // ВСЕГДА false — без displayMode, иначе красный текст
            output: 'html',
            strict: false
          });
        } else {
          html += `<span style="font-family:monospace">${esc(p.text)}</span>`;
        }
      } catch(e) {
        html += `<span style="font-family:monospace">${esc(p.text)}</span>`;
      }
    }
  }

  return html || esc(s);
}

// ── Форматирование значения с единицей (plain text, без KaTeX) ────────
// "2 м/с^2" → "2 м/с²",  "20м/с" → "20 м/с"
function formatUnit(val) {
  let s = val.trim();
  // пробел между числом и буквой если слиплись
  s = s.replace(/([0-9])([А-Яа-яёЁ])/g, '$1 $2');
  // степени ^1..^9 → Unicode надстрочные
  const supMap = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'};
  s = s.replace(/\^([0-9]+)/g, (_, n) => n.split('').map(d => supMap[d] || d).join(''));
  // убираем * заменяя на ·
  s = s.replace(/\s*\*\s*/g, ' · ');
  return s;
}

// ── Рендер строки данных из секции Дано/Найти/Ответ ──────────────────
// Формат: "v_0 = 0 м/с"  →  красивый v₀ = 0 м/с через KaTeX
function renderDataLine(line) {
  // Разбиваем по первому "="
  const eqM = line.match(/^([^=—–]+?)\s*=\s*(.+)$/);
  if (eqM) {
    const lhs = eqM[1].trim();
    const rhs = eqM[2].trim();
    // Рендерим обе части через KaTeX
    return `<div class="sol-data-row">${toKatex(lhs, false)}<span class="sol-data-eq">=</span>${toKatex(rhs, false)}</div>`;
  }

  // Строка вида "v — конечная скорость" (Найти)
  const dashM = line.match(/^([^—–\-]+?)\s*[—–\-]\s*(.+)$/);
  if (dashM) {
    const sym  = dashM[1].trim();
    const desc = dashM[2].trim();
    return `<div class="sol-data-row">${toKatex(sym, false)}<span class="sol-data-dash">—</span><span class="sol-data-val">${esc(desc)}</span></div>`;
  }

  // Просто строка — тоже через KaTeX
  return `<div class="sol-line">${toKatex(line, false)}</div>`;
}

// ── Inline KaTeX для обычного текста — рендерит v_0, t_1, a*t и т.д. ─
// Ищет паттерны типа "v_0", "t_1", "a*t^2", "м/с^2" и оборачивает в KaTeX
function autoKatex(line) {
  if (!line) return '';
  // Разбиваем строку на части: [обычный текст] [math-выражение] [обычный текст]...
  // Math-выражение: содержит _ ^ * и латинские буквы с цифрами
  // Паттерн: слово с подчёркиванием/степенью/умножением
  const mathPattern = /([A-Za-z]{1,4}[_\^][A-Za-z0-9]+(?:[_\^][A-Za-z0-9]+)*(?:\*[A-Za-z0-9_\^]+)*)/g;
  let result = '';
  let lastIdx = 0;
  let m;
  while ((m = mathPattern.exec(line)) !== null) {
    // текст до math-выражения — экранируем
    result += esc(line.slice(lastIdx, m.index));
    // math-выражение — через KaTeX
    result += toKatex(m[1], false);
    lastIdx = m.index + m[0].length;
  }
  result += esc(line.slice(lastIdx));
  return result || esc(line);
}

// ── Рендерер ответа (главный) ─────────────────────────────────────────
function renderSolveAnswer(text) {
  const lines   = text.split('\n');
  let html      = '';
  let secOpen   = false;
  let stepOpen  = false;
  let secKey    = '';
  const answerLines = [];

  function closeStep() {
    if (stepOpen) { html += '</div>'; stepOpen = false; }
  }
  function closeSection() {
    closeStep();
    if (secOpen) { html += '</div></div>'; secOpen = false; secKey = ''; }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // ── ЗАГОЛОВКИ РАЗДЕЛОВ ──────────────────────────────────────────
    // "1. Дано" / "2. Найти" / "3. Решение" / "4. Ответ"
    // или "ДАНО" / "НАЙТИ" / "РЕШЕНИЕ" / "ОТВЕТ"
    const secNum = line.match(/^(\d+)\.\s*(Дано|Найти|Решение|Ответ)\s*$/i);
    const secCap = !secNum && line.match(/^(ДАНО|НАЙТИ|РЕШЕНИЕ|ОТВЕТ)[:.]?\s*$/i);
    if (secNum || secCap) {
      closeSection();
      const rawName = secNum ? secNum[2] : secCap[1];
      const label = rawName.charAt(0).toUpperCase() + rawName.slice(1).toLowerCase();
      secKey = label.toLowerCase();

      // Секцию "Ответ" НЕ открываем — она строится вручную из answerLines после цикла
      if (secKey === 'ответ') continue;

      const num = secNum
        ? secNum[1]
        : {'дано':'1','найти':'2','решение':'3'}[secKey] || '';
      const delayMap = { 'дано':'0.05s', 'найти':'0.15s', 'решение':'0.28s' };
      const delay = delayMap[secKey] || '0s';
      html += `<div class="sol-section sol-section-anim" style="animation-delay:${delay}">`;
      html += `<div class="sol-head"><span class="sol-num">${num}.</span> ${label}</div>`;
      html += `<div class="sol-body">`;
      secOpen = true;
      continue;
    }

    // ── ШАГИ ────────────────────────────────────────────────────────
    // "Шаг 1: Название" / "Шаг 2. Название"
    const stepM = line.match(/^Шаг\s+(\d+)[.:]\s*(.*)$/i);
    if (stepM) {
      closeStep();
      const stepTitle = stepM[2] ? esc(stepM[2]) : '';
      html += `<div class="sol-step-title"><span class="sol-step-num">Шаг ${stepM[1]}.</span>${stepTitle ? ' ' + stepTitle : ''}</div>`;
      html += `<div class="sol-step-body">`;
      stepOpen = true;
      continue;
    }

    // ── ФОРМУЛА: разбиваем по " и " если AI склеил несколько ────────
    const fM = line.match(/^Формула:\s*(.+)$/i);
    if (fM) {
      // Разбиваем по " и " или " и\n" — на случай если AI написал две формулы в одну строку
      const parts = fM[1].split(/\s+и\s+/i);
      parts.forEach(part => {
        const p = part.trim();
        if (p) html += `<div class="sol-formula-wrap sol-formula-anim"><div class="sol-formula">${toKatex(p, false)}</div></div>`;
      });
      continue;
    }

    // ── ПОДСТАНОВКА: ────────────────────────────────────────────────
    const pM = line.match(/^Подстановка:\s*(.+)$/i);
    if (pM) {
      html += `<div class="sol-sub-wrap"><span class="sol-sub-lbl">Подстановка:</span> <span class="sol-sub-val sol-sub-math">${toKatex(pM[1], false)}</span></div>`;
      continue;
    }

    // ── РЕЗУЛЬТАТ: ──────────────────────────────────────────────────
    const rM = line.match(/^Результат:\s*(.+)$/i);
    if (rM) {
      html += `<div class="sol-result-wrap"><div class="sol-result sol-result-math sol-result-anim">${toKatex(rM[1], false)}</div></div>`;
      continue;
    }

    // ── ОТВЕТ: собираем все строки, рендерим после цикла ───────────
    if (secKey === 'ответ') {
      const clean = line.replace(/^Ответ:\s*/i, '').replace(/^[•·—–\-]\s+/, '');
      if (clean) answerLines.push(clean);
      continue;
    }

    // ── СТРОКИ В ДАНО / НАЙТИ — рендерим с KaTeX ────────────────────
    if (secKey === 'дано' || secKey === 'найти') {
      // Убираем ведущий буллет если есть
      const clean = line.replace(/^[•·—–\-]\s+/, '');
      html += renderDataLine(clean);
      continue;
    }

    // ── ОБЫЧНЫЙ ТЕКСТ — inline KaTeX для формул вида v_0, t_1 ───────
    html += `<div class="sol-line">${autoKatex(line)}</div>`;
  }

  // Закрываем всё что может быть открыто
  if (stepOpen) { html += '</div>'; stepOpen = false; }
  if (secOpen)  { html += '</div></div>'; secOpen = false; }

  // Вставляем секцию Ответ одной строкой через "; "
  if (answerLines.length > 0) {
    // Форматируем каждую строку: символ = значение единица
    const answerHtml = answerLines.map(line => {
      // Разбиваем по "=" — левая часть через KaTeX, правая — число + единица plain
      const eqM = line.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (eqM) {
        const lhs = toKatex(eqM[1].trim(), false);
        const rhs = toKatex(eqM[2].trim(), false);
        return `${lhs}<span class="sol-ans-eq"> = </span><span class="sol-ans-val">${rhs}</span>`;
      }
      return `<span>${esc(line)}</span>`;
    }).join('<span class="sol-ans-sep">; </span>');

    html += `
      <div class="sol-section sol-section-anim" style="animation-delay:0.42s">
        <div class="sol-head"><span class="sol-num">4.</span> Ответ</div>
        <div class="sol-body">
          <div class="sol-answer-inline sol-answer-anim">${answerHtml}</div>
        </div>
      </div>`;
  }

  return html || `<div class="sol-line">${esc(text)}</div>`;
}

// ── Свободный рендерер для followup ─────────────
function renderFreeText(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => l)
    .map(l => `<div class="rn-line">${esc(l)}</div>`)
    .join('');
}

function renderFollowupText(text) {
  return '<div class="rn-followup">' +
    text.split('\n')
      .map(l => l.trim())
      .filter(l => l)
      .map(l => {
        // если строка похожа на формулу (содержит = и буквы) — выделяем
        if (/^[A-Za-zА-Яа-яёЁ0-9_]+\s*=\s*.+$/.test(l) && l.length < 60) {
          return `<div class="rn-followup-formula">${esc(l)}</div>`;
        }
        return `<div class="rn-followup-line">${esc(l)}</div>`;
      })
      .join('') +
  '</div>';
}

// ── Главная функция решения ──────────────────────
async function doSolve() {
  const inp      = document.getElementById('solve-inp').value.trim();
  const imgInput = document.getElementById('solve-img-input');
  const imgThumb = document.getElementById('solve-img-thumb');
  const hasImage = imgThumb && imgThumb.src && imgThumb.src.length > 50;

  if (!inp && !hasImage) { toast('Введи задачу или прикрепи фото'); return; }

  // Подготовить экран 3
  const bubbleEl = document.getElementById('sv3-task-bubble');
  if (bubbleEl) {
    // Показываем полный текст (обрезка через высоту)
    bubbleEl.textContent = inp;
    bubbleEl.dataset.expanded = '0';
    // После рендера — замеряем и обрезаем до 2 строк
    requestAnimationFrame(() => {
      const lineH = parseFloat(getComputedStyle(bubbleEl).lineHeight);
      const padV  = parseFloat(getComputedStyle(bubbleEl).paddingTop) +
                    parseFloat(getComputedStyle(bubbleEl).paddingBottom);
      const collapsedH = Math.round(lineH * 2 + padV);
      bubbleEl.dataset.collapsedH = collapsedH;
      const needToggle = bubbleEl.scrollHeight > collapsedH + 4;
      bubbleEl.style.height = needToggle ? collapsedH + 'px' : 'auto';
      const toggleBtn = document.getElementById('sv3-bubble-toggle');
      if (toggleBtn) toggleBtn.style.display = needToggle ? 'block' : 'none';
    });
  }
  document.getElementById('sv3-messages').innerHTML = '';
  const qbtns = document.getElementById('sv3-quick-btns');
  if (qbtns) {
    qbtns.style.display = 'flex';
    qbtns.querySelectorAll('.sv3-qbtn').forEach(b => { b.style.opacity = '1'; b.disabled = false; });
  }

  const systemAnswer = `Ты опытный учитель физики для российских школьников. Ты решаешь любые задачи по школьной физике: механика, кинематика, динамика, статика, законы Ньютона, работа и энергия, мощность, импульс, колебания и волны, термодинамика, молекулярная физика, электростатика, постоянный ток, магнетизм, электромагнитная индукция, оптика, квантовая физика, ядерная физика, астрофизика.

Реши задачу СТРОГО по этому шаблону — без единого отклонения:

1. Дано
символ = числовое_значение единица
символ = числовое_значение единица
(каждая величина на отдельной строке, без тире, без буллетов, без двоеточий внутри строки)

2. Найти
что_ищем — краткое описание
(каждая искомая величина на отдельной строке, без нумерации, без тире)

3. Решение
Одно-два предложения: какой закон или принцип лежит в основе решения и почему.
Если нужна общая формула до шагов — напиши каждую формулу на ОТДЕЛЬНОЙ строке:
Формула: формула обычным текстом
Формула: вторая формула обычным текстом
(НИКОГДА не пиши две формулы в одну строку через "и", "и " или любой другой разделитель)
Шаг 1: Название действия
Одно предложение: что именно делаем на этом шаге.
Формула: буква = выражение обычным текстом
Подстановка: буква = числа * числа / числа
Результат: буква = значение единица
Шаг 2: Название следующего действия (только если нужен)
Одно предложение пояснения.
Формула: ...
Подстановка: ...
Результат: ...
(шагов может быть от 1 до 6 — столько, сколько реально нужно для этой задачи)

4. Ответ
символ = значение единица
символ = значение единица
(каждая найденная величина на отдельной строке в формате "символ = значение единица", например: a = 1.11 м/с^2)
(никаких слов "Ответ:", никакого пояснительного предложения — только строки с равенствами)

ЖЁСТКИЕ ПРАВИЛА — нарушение делает ответ неправильным:
— Начинать строго с "1. Дано" — никаких вводных слов до этого
— Никаких * ** # ## _ ~ \` и любого markdown-форматирования
— Формулы и величины пиши в ASCII-формате:
  — нижние индексы ОБЯЗАТЕЛЬНО через подчёркивание: v_0, a_0, x_1, F_12, v_avg, v_max (никогда не пиши v0 или a0 без подчёркивания)
  — степени через ^: t^2, r^2, v^2
  — умножение через *: a*t, m*g, F*d
  — дроби через /: s/t, F/m, U/R
  — корень как: sqrt(x), sqrt(2*g*h)
— Единицы измерения пиши русскими буквами ВСЕГДА через пробел от числа: 20 м/с, 2 м/с^2, 100 Н, 50 Дж — никогда слитно: 20м/с — это ошибка
— НЕ используй Unicode надстрочные символы: ², ³, ₀, ₁ — только ^ и _
— Примеры правильного написания: v_0 = 5 м/с, a = 2 м/с^2, F = m*a, s = v_0*t + a*t^2/2
— Формулы, Подстановка, Результат — каждый с новой строки с этим точным словом и двоеточием
— Никаких вводных фраз: Здравствуйте, Конечно, Давайте, Отличный вопрос, Хорошо
— В разделе "4. Ответ" — только строки вида "символ = значение единица", одна на строку, без пояснений, без слова "Ответ:", без нумерации
— Язык: только русский`;

  const systemGuide = `Ты опытный тьютор по физике для российских школьников. Твоя задача — помочь ученику решить задачу самостоятельно через наводящие вопросы. Ты знаешь весь школьный курс физики: механика, термодинамика, электродинамика, оптика, квантовая и ядерная физика.

Ответь строго по этому шаблону:

1. Дано
символ = значение единица
(каждая величина на отдельной строке)

2. Найти
что_ищем — краткое описание

3. Решение
Раздел физики: (одна строка — укажи точный раздел)
Подсказка: (одно-два предложения — на какой закон или принцип обратить внимание, без раскрытия ответа)
Вопрос: (один конкретный вопрос ученику — какую формулу применить или какой следующий шаг сделать)

ЖЁСТКИЕ ПРАВИЛА:
— Никаких * ** # ## _ ~ markdown
— Формулы и величины пиши в ASCII-формате:
  — нижние индексы ОБЯЗАТЕЛЬНО через подчёркивание: v_0, a_0, x_1, F_12, v_avg, v_max (никогда не пиши v0 или a0 без подчёркивания)
  — степени через ^: t^2, r^2, v^2
  — умножение через *: a*t, m*g, F*d
  — дроби через /: s/t, F/m, U/R
  — корень как: sqrt(x), sqrt(2*g*h)
— Единицы измерения пиши русскими буквами ВСЕГДА через пробел от числа: 20 м/с, 2 м/с^2, 100 Н, 50 Дж — никогда слитно: 20м/с — это ошибка
— НЕ используй Unicode надстрочные символы: ², ³, ₀, ₁ — только ^ и _
— Примеры правильного написания: v_0 = 5 м/с, a = 2 м/с^2, F = m*a, s = v_0*t + a*t^2/2
— Не давай числовой ответ — только направление
— Никаких вводных фраз
— Начинать строго с "1. Дано"
— Язык: только русский`;

  const system = solveMode === 'answer' ? systemAnswer : systemGuide;

  // Запускаем анимацию
  startSv2();

  // Запрос к API
  try {
    let reply;
    if (hasImage && imgInput.files && imgInput.files[0]) {
      const file   = imgInput.files[0];
      const base64 = await readFileAsBase64(file);
      reply = await geminiVision(system, inp || 'Реши задачу на изображении.', base64, file.type);
    } else {
      reply = await gemini(system, inp);
    }
    onApiReply(reply);
  } catch(e) {
    onApiReply('Ошибка соединения с AI. Проверь подключение.');
  }
}

// ── Уточняющие вопросы (свободный текст) ────────
async function doSolveFollowup(question, btn) {
  if (btn) { btn.style.opacity = '0.4'; btn.disabled = true; }
  const taskText = document.getElementById('solve-inp').value.trim();
  sv3AddMsg(question, true);

  const loader = sv3AddMsg('<span class="sv3-typing-dots"><span>.</span><span>.</span><span>.</span></span>', false);

  const system = `Ты опытный учитель физики для российских школьников. Ученик уже получил решение задачи и задаёт уточняющий вопрос. Охватываешь весь школьный курс: механика, термодинамика, электродинамика, оптика, квантовая физика.

Отвечай коротко и по делу — 2-4 предложения. Объясняй как живой учитель, не как учебник.
Если поясняешь формулу — напиши её на отдельной строке обычным текстом.
Если нужно показать вычисление — напиши его на отдельной строке.
Формулы пиши в простом ASCII-формате: дроби как a/b, степени как x^2, индексы как v_0, умножение как *, корень как sqrt(x). Единицы измерения пиши русскими буквами: м/с, м/с^2, Н, Дж, кг. НЕ используй надстрочные Unicode символы (², ³, ₀) — только ^ и _. Никаких * ** # ## _ ~ markdown. Никаких вводных фраз.
Язык: только русский.`;
  const msg = taskText
    ? `Исходная задача: ${taskText}\n\nВопрос ученика: ${question}`
    : `Вопрос ученика по физике: ${question}`;

  try {
    const reply = await gemini(system, msg);
    loader.remove();
    sv3AddMsg(renderFollowupText(reply), false);
  } catch(e) {
    loader.remove();
    sv3AddMsg('<div class="rn-line">Ошибка соединения с AI.</div>', false);
  }
}

async function doSolveCustomQ() {
  const inp = document.getElementById('sv3-inp');
  const q   = inp?.value.trim();
  if (!q) return;
  inp.value = '';
  await doSolveFollowup(q, null);
}

function toggleTaskBubble() {
  const bubble = document.getElementById('sv3-task-bubble');
  const btn    = document.getElementById('sv3-bubble-toggle');
  if (!bubble || !btn) return;
  if (bubble.dataset.expanded === '1') {
    // Скрыть — возвращаем к collapsed высоте
    bubble.style.height = bubble.dataset.collapsedH + 'px';
    bubble.dataset.expanded = '0';
    btn.textContent = 'Показать полностью';
  } else {
    // Показать полностью
    bubble.style.height = bubble.scrollHeight + 'px';
    bubble.dataset.expanded = '1';
    btn.textContent = 'Скрыть';
  }
}

function clearSolve() {
  svShow(1);
  document.getElementById('solve-inp').value = '';
  const bubble = document.getElementById('sv3-task-bubble');
  const btn    = document.getElementById('sv3-bubble-toggle');
  if (bubble) {
    bubble.style.height = '';
    bubble.dataset.expanded = '0';
    bubble.textContent = '';
  }
  if (btn) {
    btn.textContent = 'Показать полностью';
    btn.style.display = 'none';
  }
  const msgs = document.getElementById('sv3-messages');
  if (msgs) msgs.innerHTML = '';
  const qbtns = document.getElementById('sv3-quick-btns');
  if (qbtns) {
    qbtns.style.display = 'flex';
    qbtns.querySelectorAll('.sv3-qbtn').forEach(b => { b.style.opacity = '1'; b.disabled = false; });
  }
  removeSolveImage();
}

function triggerSolveImage() {
  document.getElementById('solve-img-input').click();
}

function onSolveImagePicked(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    document.getElementById('solve-img-thumb').src = e.target.result;
    document.getElementById('solve-img-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function removeSolveImage() {
  document.getElementById('solve-img-preview').style.display = 'none';
  document.getElementById('solve-img-thumb').src = '';
  document.getElementById('solve-img-input').value = '';
}

// ══════════════════════════════════════
// MATERIAL
// ══════════════════════════════════════
function triggerDirectUpload() {
  document.getElementById('mat-file').click();
}

function triggerMatUpload() {
  document.getElementById('mat-file').click();
}
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('mat-file');
  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const file = this.files[0];
        matContext = { type: 'file', name: file.name, file: file };
        openMatWorkspaceFlow(`📄 ${file.name}`);
      }
    });
  }
});

function openMatLink() {
  const row = document.getElementById('mat-link-row');
  if (row) { row.style.display = 'flex'; document.getElementById('mat-link-val').focus(); }
}
function cancelMatLink() {
  const row = document.getElementById('mat-link-row');
  if (row) row.style.display = 'none';
  document.getElementById('mat-link-val').value = '';
}
// Получаем метаданные YouTube через oEmbed (без CORS, без ключа)
async function fetchYouTubeMeta(videoId) {
  const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('oEmbed ' + res.status);
  return await res.json(); // { title, author_name, thumbnail_url }
}

// Получаем субтитры через Supadata API (бесплатно, без ключа, без CORS)
async function fetchYouTubeTranscript(videoId) {
  try {
    const res = await fetch(`/.netlify/functions/transcript?videoId=${videoId}`);
    if (!res.ok) { console.warn('[Transcript] Function returned', res.status); return null; }
    const data = await res.json();
    if (data.transcript) {
      if (data.lines && matContext) matContext.transcriptLines = data.lines;
      console.log('[Transcript] OK, lang:', data.language, 'chars:', data.transcript.length);
      return data.transcript;
    }
    console.warn('[Transcript] Empty:', data.error);
    return null;
  } catch(e) {
    console.warn('[Transcript] Failed:', e.message);
    return null;
  }
}

async function submitMatLink() {
  const val = document.getElementById('mat-link-val').value.trim();
  if (!val) { toast('Введи ссылку'); return; }
  cancelMatLink();

  let ytId = null;
  try {
    const u = new URL(val);
    if (u.hostname.includes('youtube.com')) ytId = u.searchParams.get('v');
    else if (u.hostname.includes('youtu.be')) ytId = u.pathname.slice(1).split('?')[0];
  } catch(e) {}

  if (!ytId) { toast('Поддерживаются только YouTube-ссылки'); return; }

  const ytSteps = [
    'Подключение к YouTube',
    'Получение данных видео',
    'Загрузка метаданных',
    'Анализ названия и темы',
    'Извлечение ключевых понятий',
    'Формирование структуры',
    'Генерация конспекта'
  ];
  ytSteps.forEach((txt, i) => {
    const el = document.getElementById('mpr-txt-' + i);
    if (el) el.textContent = txt;
  });

  matContext = { type: 'youtube', url: val, ytId, title: null, channel: null, transcript: null, transcriptLines: null };

  // Сначала загружаем метаданные и субтитры — потом запускаем воркспейс
  const [meta, transcript] = await Promise.allSettled([
    fetchYouTubeMeta(ytId),
    fetchYouTubeTranscript(ytId)
  ]);

  if (meta.status === 'fulfilled') {
    matContext.title   = meta.value.title       || null;
    matContext.channel = meta.value.author_name || null;
    console.log('[YT] Meta loaded:', matContext.title, '/', matContext.channel);
  } else {
    console.warn('[YT] oEmbed failed:', meta.reason?.message);
  }

  if (transcript.status === 'fulfilled' && transcript.value) {
    matContext.transcript = transcript.value;
    console.log('[YT] Transcript loaded, length:', transcript.value.length);
  } else {
    console.warn('[YT] Transcript unavailable');
  }

  // Запускаем воркспейс только после того как данные загружены
  openMatWorkspaceFlow('▶ YouTube');
}
function openMatPhoto() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    if (inp.files[0]) {
      const file = inp.files[0];
      matContext = { type: 'photo', name: file.name, file: file };
      openMatWorkspaceFlow(`📷 ${file.name}`);
    }
  };
  inp.click();
}
function openMatAudio() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'audio/*,video/*';
  inp.onchange = () => {
    if (inp.files[0]) {
      matContext = { type: 'audio', name: inp.files[0].name };
      openMatWorkspaceFlow(`🎤 ${inp.files[0].name}`);
    }
  };
  inp.click();
}

// ══ MAT WORKSPACE ══════════════════════════════

function triggerDirectUpload() {
  document.getElementById('mat-file').click();
}

function openMatWorkspaceFlow(fileLabel) {
  const ov = document.getElementById('matws-ov');
  ov.style.display = 'flex';
  document.getElementById('matws-processing').style.display = 'flex';
  document.getElementById('matws-workspace').style.display  = 'none';
  document.getElementById('mat-chat-msgs').innerHTML = '';

  const steps     = document.querySelectorAll('.mpr-step');
  const totalSteps = steps.length;
  let cur = 0;
  const pctEl  = document.getElementById('mpr-pct');
  const fillEl = document.getElementById('mpr-topbar-fill');
  const etaEl  = document.getElementById('mpr-eta');
  steps.forEach(s => s.classList.remove('active','done'));

  function activateStep(i) {
    if (i > 0) { steps[i-1].classList.remove('active'); steps[i-1].classList.add('done'); }
    if (i < totalSteps) steps[i].classList.add('active');
    const pct = Math.round((i / totalSteps) * 100);
    pctEl.textContent  = pct + '%';
    fillEl.style.width = pct + '%';
    const secsLeft = Math.round((totalSteps - i) * 0.6);
    const mm = String(Math.floor(secsLeft / 60)).padStart(2,'0');
    const ss = String(secsLeft % 60).padStart(2,'0');
    etaEl.textContent = `осталось примерно ${mm}:${ss} минут`;
  }
  activateStep(0);

  const interval = setInterval(() => {
    cur++;
    if (cur >= totalSteps) {
      clearInterval(interval);
      steps.forEach(s => { s.classList.remove('active'); s.classList.add('done'); });
      pctEl.textContent  = '100%';
      fillEl.style.width = '100%';
      etaEl.textContent  = 'Готово!';
      setTimeout(() => openMatWorkspace(fileLabel), 400);
    } else {
      activateStep(cur);
    }
  }, 600);
}

function openMatWorkspace(fileLabel) {
  document.getElementById('matws-processing').style.display = 'none';
  document.getElementById('matws-workspace').style.display  = 'flex';

  const ctx = matContext;
  const isYT = ctx?.type === 'youtube';

  const cleanName = isYT
    ? (ctx.title || 'YouTube видео')
    : fileLabel.replace(/^[\u{1F4C4}\u{1F517}\u{1F4F7}\u{1F3A4}\u{1F517}]\s*/u, '');

  document.getElementById('matws-topbar-title').textContent = cleanName;
  document.getElementById('matws-summary-title').innerHTML  = `<span style="color:var(--tx2);font-size:13px">Определяем тему...</span>`;

  // Источники в сайдбаре
  const list = document.getElementById('matws-sources-list');
  if (list) {
    list.innerHTML = '';
    const item = document.createElement('div');
    item.className = 'matws-src-item';

    if (isYT) {
      item.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#cc0000"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.6A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 9.4.6 9.4.6s7.5 0 9.4-.6a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8z"/><polygon points="9.75,15.02 15.5,12 9.75,8.98" fill="white"/></svg>
        <span class="matws-src-name">${ctx.channel ? ctx.channel + ' · ' : ''}${(ctx.title || ctx.url).slice(0, 38)}…</span>
        <span class="matws-src-check">✓</span>
      `;
    } else {
      item.innerHTML = `
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="matws-src-name">${cleanName}</span>
        <span class="matws-src-check">✓</span>
      `;
    }
    list.appendChild(item);
    document.getElementById('matws-sb-count').textContent = '(1)';
  }

  const body = document.getElementById('matws-summary-body');
  body.innerHTML = '<p style="color:var(--tx2);font-size:13px">AI составляет конспект...</p>';

  const suggs = document.getElementById('mat-suggs');
  if (suggs) suggs.style.display = 'none';

  saveMatProject(cleanName);

  // ── Строим промпты ──────────────────────────────────────
  let titlePrompt, notePrompt;

  if (isYT) {
    const ytTitle      = ctx.title      || null;
    const ytChannel    = ctx.channel    || null;
    const ytUrl        = ctx.url;
    const ytId         = ctx.ytId;
    const ytTranscript = ctx.transcript || null;

    // Если есть субтитры — используем реальный текст
    const ytLines = ctx.transcriptLines || null;
    let transcriptBlock = '';
    if (ytTranscript) {
      if (ytLines && ytLines.length > 0) {
        const keyLines = [];
        let lastOffset = -30;
        ytLines.forEach(l => {
          if (l.offset - lastOffset >= 30) {
            keyLines.push(`[${Math.floor(l.offset/60)}:${String(l.offset%60).padStart(2,'0')}] (t=${l.offset}s) ${l.text}`);
            lastOffset = l.offset;
          }
        });
        transcriptBlock = `\n\nРЕАЛЬНЫЕ СУБТИТРЫ С ТАЙМКОДАМИ:\n"""\n${keyLines.slice(0, 80).join('\n')}\n"""\n\nПолный текст:\n${ytTranscript.slice(0, 8000)}`;
      } else {
        transcriptBlock = `\n\nРЕАЛЬНЫЕ СУБТИТРЫ ВИДЕО:\n"""\n${ytTranscript.slice(0, 12000)}\n"""`;
      }
    }

    const hasTranscript = !!ytTranscript;

    // Промпт для определения темы — берём из названия видео напрямую
    titlePrompt = ytTitle
      ? `Название YouTube-видео: "${ytTitle}"${ytChannel ? `, канал: "${ytChannel}"` : ''}.\nИз этого названия извлеки только учебную тему урока — убери лишнее (номер урока, имя учителя, пометки типа "осн", "доп", скобки). Напиши только чистое академическое название темы на русском языке. Без кавычек, без точек, одна строка.`
      : `URL YouTube-видео: ${ytUrl}. Определи тему и напиши короткое академическое название на русском языке. Только название.`;

    // Промпт для конспекта — с реальным транскриптом если есть
    const videoInfo = [
      ytTitle   ? `Название видео: "${ytTitle}"` : null,
      ytChannel ? `Канал: ${ytChannel}`          : null,
      `Ссылка: ${ytUrl}`,
    ].filter(Boolean).join('\n');

    // Строим список всех таймкодов для вставки прямо в текст
    let allTimecodes = '';
    if (ytLines && ytLines.length > 0) {
      allTimecodes = ytLines
        .filter((l, i) => i % 3 === 0) // каждая 3я строка чтобы не перегружать
        .slice(0, 120)
        .map(l => `t=${l.offset}s → "${l.text.slice(0, 60)}"`)
        .join('\n');
    }

    notePrompt = `Ты опытный преподаватель-методист. Твоя задача — создать детальный структурированный конспект урока на основе РЕАЛЬНЫХ субтитров видео.

ИНФОРМАЦИЯ О ВИДЕО:
${videoInfo}
${hasTranscript ? transcriptBlock : ''}
${allTimecodes ? `\nВСЕ ДОСТУПНЫЕ ТАЙМКОДЫ (используй их в тексте конспекта):\n${allTimecodes}` : ''}

ТРЕБОВАНИЯ К КОНСПЕКТУ:
1. Используй ТОЛЬКО реальный текст субтитров — не придумывай ничего от себя
2. Таймкоды вставляй прямо в текст везде где упоминается новая мысль или термин — не только в отдельном разделе
3. Каждый таймкод оформляй как кликабельную ссылку: <a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ М:СС</a>
4. Минимум 10–15 таймкодов по всему конспекту
5. Формулы пиши в LaTeX между $...$
6. Только HTML, без markdown, без \`\`\`html

Строго используй эту структуру:
<div class="ai-note">

  <div class="ai-note-section">
    <div class="ai-note-section-title">О чём этот урок</div>
    <p>2–3 предложения: главная тема, что узнает ученик, для какого класса/уровня.</p>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Содержание урока</div>
    <p>Подробный пересказ урока по смысловым блокам. После каждого нового смыслового блока или важной мысли ставь таймкод прямо в тексте: <a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ М:СС</a>. Минимум 8 таймкодов внутри этого раздела. Пиши развёрнуто — 200–300 слов.</p>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Ключевые моменты</div>
    <ul>
      <li><a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ М:СС</a> <strong>Название момента</strong> — краткое описание что происходит в этом фрагменте</li>
    </ul>
    <p style="font-size:11px;color:var(--tx2);margin-top:4px">↑ Нажми ▶ чтобы перейти к этому месту в видео</p>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Основные понятия</div>
    <ul>
      <li><strong>Термин</strong> — определение своими словами + <a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ где объясняется</a></li>
    </ul>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Формулы и законы</div>
    <p>Каждая формула на отдельной строке: $формула$ — пояснение + таймкод где разбирается</p>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Примеры и опыты из урока</div>
    <ul>
      <li><a class="yt-ts-link" href="https://www.youtube.com/watch?v=${ytId}&t=СЕКУНДЫs" target="_blank">▶ М:СС</a> <strong>Название опыта/примера</strong> — что показали и какой вывод</li>
    </ul>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Домашнее задание</div>
    <p>Если в видео упоминалось ДЗ — выпиши его точно. Если нет — напиши "не задавалось".</p>
  </div>

  <div class="ai-note-section">
    <div class="ai-note-section-title">Главное запомнить</div>
    <ul><li>Ключевой тезис урока одним предложением</li></ul>
  </div>

</div>
Отвечай ТОЛЬКО HTML. Без вступления и послесловия. На русском языке. Все таймкоды должны быть реальными секундами из субтитров.`;

  } else {
    // Обычный файл — старая логика
    const sources     = ctx?.sources || [];
    const sourcesList = sources.length > 0
      ? `\nДоступные источники:\n${sources.map(s => `[${s.index}] ${s.title} — ${s.url}`).join('\n')}`
      : '';
    const hasContent  = ctx?.type === 'link' && ctx?.content;
    const contentBlock = hasContent
      ? `\n\nМатериал:\n${ctx.content.slice(0, 10000)}`
      : '';
    const sourceLabel = hasContent ? `страницы ${ctx.url}` : `"${cleanName}"`;
    const citationGuide = sources.length > 0
      ? `\nГде берёшь информацию из источника — ставь метку [N] после факта.`
      : '';

    titlePrompt = `На основе ${sourceLabel}${contentBlock ? ' и её содержимого' : ''} напиши короткое академическое название темы на русском языке. Только название.${contentBlock}`;

    notePrompt = `Ты опытный учитель физики, готовящий учеников к ЕГЭ. Составь подробный конспект по теме: "TOPIC_PLACEHOLDER".${contentBlock}${sourcesList}${citationGuide}

Строго используй эту структуру (только HTML, без markdown, без \`\`\`html):
<div class="ai-note">
  <div class="ai-note-section"><div class="ai-note-section-title">Краткое содержание</div><p>2–3 предложения о теме.</p></div>
  <div class="ai-note-section"><div class="ai-note-section-title">Основные понятия</div><ul><li><strong>Термин</strong> — определение</li></ul></div>
  <div class="ai-note-section"><div class="ai-note-section-title">Формулы</div><p>Каждая формула на отдельной строке. Пиши в LaTeX между $...$, например: $F = k\\frac{q_1 q_2}{r^2}$</p></div>
  <div class="ai-note-section"><div class="ai-note-section-title">Задания ЕГЭ по этой теме</div><p>Типы задач в ЕГЭ (часть 1 и часть 2).</p></div>
  <div class="ai-note-section"><div class="ai-note-section-title">Главное запомнить</div><ul><li>Тезис</li></ul></div>
</div>
Отвечай только HTML. Без вступления и послесловия. На русском языке.`;
  }

  // ── Шаг 1: AI определяет название темы ──────────────────
  gemini('Отвечай одной строкой без кавычек, точек и лишних слов.', titlePrompt)
  .then(aiTitle => {
    const title = aiTitle.replace(/^["'«»\s]+|["'«»\s]+$/g, '').trim();
    document.getElementById('matws-topbar-title').textContent = title;
    document.getElementById('matws-summary-title').innerHTML  =
      `<strong style="font-size:18px;font-weight:800;color:var(--tx);font-family:var(--font-d);line-height:1.3">${title}</strong>`;

    // Подставляем реальный заголовок в промпт конспекта
    const finalNotePrompt = notePrompt.replace(/TOPIC_PLACEHOLDER/g, title);
    return gemini('Ты составляешь учебные конспекты в HTML формате. Отвечай только HTML без markdown.', finalNotePrompt);

  }).then(noteHtml => {
    let clean = noteHtml.replace(/```html|```/g, '').trim();

    // Рендерим LaTeX формулы через KaTeX: $...$
    clean = clean.replace(/\$([^$\n]+)\$/g, (match, formula) => {
      try {
        if (typeof katex !== 'undefined') {
          return katex.renderToString(formula, { throwOnError: false, displayMode: false, output: 'html', strict: false });
        }
      } catch(e) {}
      return `<code>${formula}</code>`;
    });

    body.innerHTML = clean;

    // ── Шаг 3: AI генерирует 4 вопроса по теме ──────────────
    const titleEl    = document.getElementById('matws-summary-title');
    const topicForQ  = titleEl?.querySelector('strong')?.textContent || cleanName;
    const qPrompt    = isYT
      ? `По теме "${topicForQ}" (YouTube-видео) придумай 4 вопроса для самопроверки ученика — разного уровня сложности. Верни строго JSON массив из 4 строк.`
      : `По теме "${topicForQ}" придумай 4 коротких вопроса для самопроверки. Верни строго JSON массив из 4 строк.`;
    return gemini('Ты генерируешь вопросы для самопроверки. Отвечай только JSON массивом строк без пояснений.', qPrompt);

  }).then(qJson => {
    try {
      const questions = JSON.parse(qJson.replace(/```json|```/g, '').trim());
      const suggs = document.getElementById('mat-suggs');
      if (suggs && Array.isArray(questions)) {
        suggs.innerHTML = questions.slice(0, 4).map(q =>
          `<button class="mat-sugg" onclick="doMatQ(this)">${q}</button>`
        ).join('');
        suggs.style.display = 'flex';
      }
    } catch(e) {
      const suggs = document.getElementById('mat-suggs');
      if (suggs) {
        suggs.innerHTML = `
          <button class="mat-sugg" onclick="doMatQ(this)">Кратко объясни тему</button>
          <button class="mat-sugg" onclick="doMatQ(this)">Составь план урока</button>
          <button class="mat-sugg" onclick="doMatQ(this)">Дай задачи для практики</button>
          <button class="mat-sugg" onclick="doMatQ(this)">Что спросят на ЕГЭ?</button>
        `;
        suggs.style.display = 'flex';
      }
    }
  }).catch(() => {
    body.innerHTML = `<p>Материал загружен. Задай вопрос в чате ниже.</p>`;
    const suggs = document.getElementById('mat-suggs');
    if (suggs) suggs.style.display = 'flex';
  });
}

function saveMatProject(name) {
  if (!currentUser) return;
  const projects = currentUser.matProjects || [];
  const emojis = ['📚','🔬','💡','🧪','⚡','🎯','📐','🌍','🧲','🔭'];
  const proj = {
    id: Date.now(),
    name,
    emoji: emojis[Math.floor(Math.random() * emojis.length)],
    date: new Date().toLocaleDateString('ru-RU', { day:'2-digit', month:'2-digit', year:'numeric' }),
    sources: 1,
  };
  projects.unshift(proj);
  currentUser.matProjects = projects.slice(0, 20);
  currentProjectId = proj.id;
  saveMe();
}

function closeMatWorkspace() {
  document.getElementById('matws-ov').style.display = 'none';
  matContext = null;
}

function startNewMatProject() {
  closeMatWorkspace();
  goTab('learn', document.querySelector('[data-t=learn]'));
}

function showMatChat(fileLabel) {
  openMatWorkspaceFlow(fileLabel);
}

function renderProjects() {
  const grid = document.getElementById('proj-grid');
  if (!grid) return;
  const searchVal = (document.getElementById('proj-search-inp')?.value || '').toLowerCase();
  const projects  = (currentUser.matProjects || []).filter(p =>
    !searchVal || p.name.toLowerCase().includes(searchVal)
  );
  grid.innerHTML = '';

  // Карточка «новый проект»
  const newCard = document.createElement('div');
  newCard.className = 'proj-card proj-card-new';
  newCard.onclick   = () => goTab('learn', document.querySelector('[data-t=learn]'));
  newCard.innerHTML = `<div class="proj-new-circle">+</div><div class="proj-new-lbl">Начать новый проект</div>`;
  grid.appendChild(newCard);

  // Карточки проектов
  projects.forEach(p => {
    const card = document.createElement('div');
    card.className = 'proj-card';
    card.innerHTML = `
      <div class="proj-card-emoji">${p.emoji}</div>
      <div class="proj-card-title">${p.name}</div>
      <div class="proj-card-meta">${p.date} · ${p.sources} источник${p.sources > 1 ? 'а' : ''}</div>
      <button class="proj-card-btn" onclick="event.stopPropagation(); reopenProject(${p.id})">Перейти в чат</button>
    `;
    grid.appendChild(card);
  });

  if (projects.length === 0 && !searchVal) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;font-family:var(--font);font-size:13px;color:var(--tx2);padding:20px 0';
    empty.textContent = 'Загрузи материал во вкладке «Изучить материал» — он появится здесь.';
    grid.appendChild(empty);
  }
}

function reopenProject(id) {
  const p = (currentUser.matProjects || []).find(x => x.id === id);
  if (!p) return;
  currentProjectId = id;
  const ov = document.getElementById('matws-ov');
  ov.style.display = 'flex';
  document.getElementById('matws-processing').style.display = 'none';
  document.getElementById('matws-workspace').style.display  = 'flex';
  document.getElementById('matws-topbar-title').textContent  = p.name;
  document.getElementById('matws-summary-title').textContent = p.name;
  document.getElementById('mat-chat-msgs').innerHTML = '';
  const suggs = document.getElementById('mat-suggs');
  if (suggs) suggs.style.display = 'flex';
  const list = document.getElementById('matws-sources-list');
  if (list) {
    list.innerHTML = `
      <div class="matws-src-item">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="matws-src-name">${p.name}</span>
        <span class="matws-src-check">✓</span>
      </div>`;
    document.getElementById('matws-sb-count').textContent = `(${p.sources})`;
  }
  const body = document.getElementById('matws-summary-body');
  body.innerHTML = `
    <p>Материал «<strong>${p.name}</strong>» был загружен ${p.date}.</p>
    <p>Задай вопрос или воспользуйся подсказками снизу.</p>
  `;
}

function toggleProjectSearch() {
  const inp = document.getElementById('proj-search-inp');
  if (!inp) return;
  const visible = inp.style.display !== 'none';
  inp.style.display = visible ? 'none' : 'block';
  if (!visible) inp.focus();
}

function addMatMsg(role, text) {
  const win = document.getElementById('mat-chat-msgs');
  if (!win) return;
  const suggs = document.getElementById('mat-suggs');
  if (suggs) suggs.style.display = 'none';
  const d = document.createElement('div');
  d.className = 'msg ' + role;

  let html = esc(text);

  if (role === 'bot') {
    // Citations [N] → кликабельные бейджи
    const sources = matContext?.sources || [];
    if (sources.length > 0) {
      html = html.replace(/\[(\d+)\]/g, (match, n) => {
        const src = sources.find(s => s.index === parseInt(n));
        if (!src) return match;
        return `<a class="ai-cite" href="${src.url}" target="_blank" title="${src.title}">${n}</a>`;
      });
    }
    // KaTeX: $...$ → рендер формул
    html = html.replace(/\$([^$\n]+)\$/g, (match, formula) => {
      try {
        if (typeof katex !== 'undefined') {
          return katex.renderToString(formula, { throwOnError: false, displayMode: false, output: 'html', strict: false });
        }
      } catch(e) {}
      return `<code>${formula}</code>`;
    });
    // Переносы строк
    html = html.replace(/\n/g, '<br>');
  }

  d.innerHTML = role === 'bot'
    ? `<div class="m-av">AI</div><div class="bbl">${html}</div>`
    : `<div class="bbl">${esc(text)}</div>`;
  win.appendChild(d);
  win.scrollTop = win.scrollHeight;
}

function doMatQ(btn) {
  document.getElementById('mat-inp').value = btn.textContent;
  sendMatChat();
}

async function sendMatChat() {
  const inp = document.getElementById('mat-inp');
  const txt = inp.value.trim();
  if (!txt || matChatBusy) return;
  inp.value = '';
  addMatMsg('user', txt);
  matChatBusy = true;

  const typingId = 'mat-typing-' + Date.now();
  addMatMsg('bot', '...', typingId);

  try {
    let reply;
    const ctx  = matContext;
    const name = ctx?.name || 'загруженный материал';

    if (ctx?.file && ctx.file.type.startsWith('image/')) {
      // Фото — отправляем как vision
      const base64 = await readFileAsBase64(ctx.file);
      const system = `Ты AI-ассистент по учёбе. Пользователь загрузил изображение материала: "${name}". Отвечай на вопросы по нему. Отвечай на русском языке.`;
      reply = await geminiVision(system, txt, base64, ctx.file.type);

    } else if (ctx?.file && (ctx.file.type === 'text/plain' || ctx.file.name.endsWith('.txt'))) {
      // Текстовый файл — читаем содержимое и передаём в контекст
      const content = await readFileAsText(ctx.file);
      const system  = `Ты AI-ассистент по учёбе. Пользователь загрузил текстовый файл "${name}". Содержимое файла:\n\n${content.slice(0, 8000)}\n\nОтвечай на вопросы по этому материалу. Отвечай на русском языке.`;
      reply = await gemini(system, txt);

    } else if (ctx?.type === 'youtube') {
      const topicTitle = document.getElementById('matws-summary-title')?.querySelector('strong')?.textContent || ctx.title || 'YouTube-видео';
      const videoInfo  = [
        ctx.title   ? `Название: "${ctx.title}"` : null,
        ctx.channel ? `Канал: ${ctx.channel}`    : null,
        `Ссылка: ${ctx.url}`,
      ].filter(Boolean).join('\n');

      const system = `Ты дружелюбный AI-тьютор по физике. Пользователь изучает тему "${topicTitle}" по YouTube-видео.

${videoInfo}

Отвечай на вопросы точно и подробно, опираясь на свои знания по данной теме.
Используй формулы в LaTeX: $формула$. Отвечай на русском языке.`;

      reply = await gemini(system, txt);
    } else {
      console.log('%c[Chat] Using file/generic context', 'color:#8B84A8');
      const system = `Ты дружелюбный AI-тьютор. Пользователь изучает материал по теме "${name}". Объясняй понятно, с примерами. Отвечай на русском языке.`;
      reply = await gemini(system, txt);
    }

    document.getElementById(typingId)?.remove();
    addMatMsg('bot', reply);
  } catch(e) {
    document.getElementById(typingId)?.remove();
    addMatMsg('bot', 'Ошибка соединения с AI.');
  }
  matChatBusy = false;
}

// ══════════════════════════════════════
// TUTOR
// ══════════════════════════════════════
function initTutor() {
  const win = document.getElementById('chat-win');
  win.innerHTML = '';
  // Стартовый экран — сообщения не показываем
  const welcome = document.getElementById('gpt-welcome');
  const chatArea = document.getElementById('gpt-chat-area');
  if (welcome) welcome.style.display = 'flex';
  if (chatArea) chatArea.style.display = 'none';
}

function setMode(el, mode) {
  document.querySelectorAll('.ts-mode').forEach(b => b.classList.remove('active'));
  document.getElementById('mode-' + mode).classList.add('active');
  tutorMode = mode;
  document.getElementById('t-mode-lbl').textContent =
    mode === 'strict' ? 'Строгий преподаватель · Прямые ответы' : 'Сократовский метод · Ментор';
}

// Chat history
let chatSessions = JSON.parse(localStorage.getItem('chatSessions') || '[]');
let activeChatId = null;

function saveChatSession() {
  const win = document.getElementById('chat-win');
  if (!win || !activeChatId) return;
  const msgs = [...win.querySelectorAll('.msg')].map(m => ({
    role: m.classList.contains('user') ? 'user' : 'bot',
    text: m.querySelector('.bbl')?.textContent || ''
  }));
  if (!msgs.length) return;
  const idx = chatSessions.findIndex(s => s.id === activeChatId);
  const title = msgs.find(m => m.role === 'user')?.text?.slice(0, 30) || 'Новый чат';
  if (idx >= 0) chatSessions[idx] = { id: activeChatId, title, msgs };
  else chatSessions.unshift({ id: activeChatId, title, msgs });
  localStorage.setItem('chatSessions', JSON.stringify(chatSessions.slice(0, 30)));
  renderChatHistory();
}

function renderChatHistory() {
  const list = document.getElementById('gpt-history-list');
  if (!list) return;
  list.innerHTML = '';
  chatSessions.forEach(s => {
    const d = document.createElement('div');
    d.className = 'gpt-hist-item' + (s.id === activeChatId ? ' active' : '');
    d.textContent = s.title;
    d.onclick = () => loadChatSession(s.id);
    list.appendChild(d);
  });
}

function loadChatSession(id) {
  saveChatSession();
  const s = chatSessions.find(c => c.id === id);
  if (!s) return;
  activeChatId = id;
  const win = document.getElementById('chat-win');
  win.innerHTML = '';
  s.msgs.forEach(m => addMsg(m.role, m.text));
  const welcome = document.getElementById('gpt-welcome');
  const chatArea = document.getElementById('gpt-chat-area');
  if (welcome && chatArea) {
    welcome.style.display = 'none';
    chatArea.style.display = 'flex';
  }
  document.getElementById('gpt-chat-title').textContent = s.title;
  renderChatHistory();
}

function startNewChat() {
  saveChatSession();
  activeChatId = 'chat_' + Date.now();
  document.getElementById('chat-win').innerHTML = '';
  const welcome = document.getElementById('gpt-welcome');
  const chatArea = document.getElementById('gpt-chat-area');
  if (welcome && chatArea) {
    welcome.style.display = 'flex';
    chatArea.style.display = 'none';
  }
  document.getElementById('gpt-chat-title').textContent = 'Чат';
  tutorIdx = 0;
  renderChatHistory();
}

function clearTutor() {
  document.getElementById('chat-win').innerHTML = '';
  const welcome = document.getElementById('gpt-welcome');
  const chatArea = document.getElementById('gpt-chat-area');
  if (welcome && chatArea) {
    welcome.style.display = 'flex';
    chatArea.style.display = 'none';
  }
  tutorIdx = 0;
}

function doQQ(btn) {
  document.getElementById('chat-inp').value = btn.textContent;
  sendChat();
}

async function sendChat() {
  const inp = document.getElementById('chat-inp');
  const txt = inp.value.trim();
  if (!txt || chatBusy) return;
  if (!activeChatId) activeChatId = 'chat_' + Date.now();
  inp.value = '';
  addMsg('user', txt);
  const qw = document.getElementById('quick-wrap');
  if (qw) qw.style.display = 'none';

  chatBusy = true;
  const typingId = 'typing-' + Date.now();
  addMsg('bot', '...', typingId);

  try {
    const u = currentUser;
    const levelMap = { base: 'начальный (7-8 класс)', mid: 'средний (9 класс)', hard: 'продвинутый (10-11 класс, ЕГЭ)' };
    const goalMap  = { ege: 'подготовка к ЕГЭ', oge: 'подготовка к ОГЭ', self: 'самообразование' };
    const system = `Ты AI-тьютор по физике для российских школьников. Знаешь весь курс физики 7-11 класс: кинематика, динамика, статика, законы Ньютона, работа и энергия, импульс, колебания и волны, термодинамика, молекулярная физика, электростатика, постоянный ток, закон Ома, магнетизм, электромагнитная индукция, оптика, квантовая физика, ядерные реакции.

Ученик: ${u.name}
Уровень: ${levelMap[u.level] || 'средний'}
Цель: ${goalMap[u.goal] || 'изучение физики'}
Стиль: ${tutorMode === 'strict'
  ? 'строгий преподаватель — краткие точные ответы, сразу формула и вычисление, без лирики'
  : 'дружелюбный ментор — объясняй через аналогии и примеры из жизни, задавай наводящие вопросы, помогай думать самостоятельно'}

Правила ответа:
— Никаких * ** # ## _ ~ markdown
— Формулы и величины пиши в ASCII-формате:
  — нижние индексы ОБЯЗАТЕЛЬНО через подчёркивание: v_0, a_0, x_1, F_12, v_avg, v_max (никогда не пиши v0 или a0 без подчёркивания)
  — степени через ^: t^2, r^2, v^2
  — умножение через *: a*t, m*g, F*d
  — дроби через /: s/t, F/m, U/R
  — корень как: sqrt(x), sqrt(2*g*h)
— Единицы измерения пиши русскими буквами ВСЕГДА через пробел от числа: 20 м/с, 2 м/с^2, 100 Н, 50 Дж — никогда слитно: 20м/с — это ошибка
— НЕ используй Unicode надстрочные символы: ², ³, ₀, ₁ — только ^ и _
— Примеры правильного написания: v_0 = 5 м/с, a = 2 м/с^2, F = m*a, s = v_0*t + a*t^2/2
— Никаких вводных фраз: Конечно, Отличный вопрос, Здравствуйте
— Если решаешь задачу — показывай шаги и подстановку чисел
— Язык: только русский`;
    const reply = await gemini(system, txt);
    document.getElementById(typingId)?.remove();
    addMsg('bot', reply);
    saveChatSession();
  } catch(e) {
    document.getElementById(typingId)?.remove();
    addMsg('bot', 'Ошибка соединения с AI. Проверь ключ API.');
  }
  chatBusy = false;
}

function addMsg(role, text, id) {
  // Переключаем в режим чата при первом сообщении
  const welcome = document.getElementById('gpt-welcome');
  const chatArea = document.getElementById('gpt-chat-area');
  if (welcome && chatArea) {
    welcome.style.display = 'none';
    chatArea.style.display = 'flex';
  }
  const win = document.getElementById('chat-win');
  const d   = document.createElement('div');
  d.className = 'msg ' + role;
  if (id) d.id = id;
  d.innerHTML = role === 'bot'
    ? `<div class="m-av">AI</div><div class="bbl">${esc(text)}</div>`
    : `<div class="bbl">${esc(text)}</div>`;
  win.appendChild(d);
  win.scrollTop = win.scrollHeight;
}

// ══════════════════════════════════════
// DUELS
// ══════════════════════════════════════
function renderLeaderboard() {
  const u    = currentUser;
  const list = document.getElementById('lb-list');
  list.innerHTML = '';
  const myRating = u.duelStats?.rating || 0;
  const all = [...FAKE_LB, { name: u.name + (u.sname ? ' ' + u.sname[0]+'.' : ''), r: myRating, color: '#7C6FE0', isMe: true }];
  all.sort((a,b) => b.r - a.r);
  all.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'lb-row' + (item.isMe ? ' lb-me' : '');
    const medals = ['🥇','🥈','🥉'];
    row.innerHTML = `
      <div class="lb-pos">${i < 3 ? medals[i] : i+1}</div>
      <div class="lb-av" style="background:${item.color||'#8B84A8'}">${item.name[0]}</div>
      <div class="lb-name">${item.name}${item.isMe ? ' (ты)' : ''}</div>
      <div class="lb-score">${item.r}</div>
    `;
    list.appendChild(row);
  });
}

function renderDuelStats() {
  renderLeaderboard();
  const d = currentUser.duelStats || {};
  document.getElementById('d-total').textContent   = d.total  || 0;
  document.getElementById('d-wins').textContent    = d.wins   || 0;
  document.getElementById('d-losses').textContent  = d.losses || 0;
  document.getElementById('d-rating').textContent  = d.rating || 0;
  const hist = document.getElementById('duel-history');
  const dh   = (currentUser.duelHistory || []).slice().reverse();
  if (!dh.length) { hist.innerHTML = '<div class="empty-note">Ещё не сыграно ни одной дуэли</div>'; return; }
  hist.innerHTML = dh.slice(0,5).map(h => `
    <div class="dh-item ${h.win?'win':'lose'}">
      <div class="dh-res">${h.win ? 'Победа' : 'Поражение'}</div>
      <div class="dh-opp">vs Бот</div>
      <div class="dh-sc">${h.my}:${h.opp}</div>
      <div class="dh-pts">${h.win ? '+'+h.pts : '-'+Math.abs(h.pts)}</div>
    </div>`).join('');
}

const TOTAL_DUEL_QS = 5;

function openArena() {
  duelState = { q:0, myPts:0, oppPts:0, timeLeft:20, pool: shuffleArr([...DUEL_POOL]).slice(0, TOTAL_DUEL_QS) };
  document.getElementById('a-my-av').textContent   = currentUser.name[0].toUpperCase();
  document.getElementById('a-my-name').textContent = currentUser.name;
  document.getElementById('a-my-sc').textContent   = 0;
  document.getElementById('a-opp-sc').textContent  = 0;
  document.getElementById('arena-progress-fill').style.width = '0%';
  document.getElementById('arena-result').style.display = 'none';
  document.getElementById('arena-box').style.display    = 'flex';
  const ov = document.getElementById('arena-ov');
  ov.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => ov.classList.add('open')));
  loadDuelQ();
}

function loadDuelQ() {
  if (duelState.q >= TOTAL_DUEL_QS) { endDuel(); return; }
  clearInterval(duelTimer);
  
  // Показываем "AI генерирует вопрос"
  const gen = document.getElementById('arena-generating');
  const qEl = document.getElementById('arena-q');
  const opts = document.getElementById('arena-opts');
  gen.classList.add('visible');
  qEl.textContent = '';
  opts.innerHTML  = '';
  
  // Имитация задержки генерации — 900ms
  setTimeout(() => {
    gen.classList.remove('visible');
    
    const q = duelState.pool[duelState.q];
    document.getElementById('a-qnum').textContent = `${duelState.q+1} / ${TOTAL_DUEL_QS}`;
    document.getElementById('arena-progress-fill').style.width = `${(duelState.q / TOTAL_DUEL_QS) * 100}%`;
    
    // Печатающий эффект вопроса
    let i = 0;
    const text = q.q;
    const typeInterval = setInterval(() => {
      qEl.textContent = text.slice(0, i);
      i++;
      if (i > text.length) clearInterval(typeInterval);
    }, 22);
    
    // Варианты ответов появляются после печати
    setTimeout(() => {
      q.opts.forEach((o, oi) => {
        const btn = document.createElement('button');
        btn.className   = 'a-opt';
        btn.textContent = o;
        btn.style.animation = `fadeUp .2s ease ${oi * 0.07}s both`;
        btn.onclick = () => pickDuel(btn, oi === q.ans);
        opts.appendChild(btn);
      });
    }, Math.min(text.length * 22 + 100, 800));
    
    // Таймер
    duelState.timeLeft = 20;
    updateClock(20, 20);
    document.getElementById('clk-num').textContent = 20;
    if (document.getElementById('clk-arc')) {
      document.getElementById('clk-arc').style.stroke = '#ffffff';
    }
    
    duelTimer = setInterval(() => {
      duelState.timeLeft--;
      document.getElementById('clk-num').textContent = duelState.timeLeft;
      updateClock(duelState.timeLeft, 20);
      if (duelState.timeLeft <= 5) document.getElementById('clk-arc').style.stroke = '#f87171';
      if (duelState.timeLeft <= 0) {
        clearInterval(duelTimer);
        oppAnswer();
        setTimeout(() => { duelState.q++; loadDuelQ(); }, 700);
      }
    }, 1000);
  }, 900);
}

function updateClock(cur, max) {
  const offset = 138.2 * (1 - cur/max);
  document.getElementById('clk-arc').style.strokeDashoffset = offset;
  document.getElementById('clk-arc').style.stroke = cur <= 5 ? '#f87171' : '#ffffff';
}

function pickDuel(btn, correct) {
  clearInterval(duelTimer);
  document.getElementById('arena-opts').querySelectorAll('.a-opt').forEach(b => b.disabled = true);
  btn.classList.add(correct ? 'correct' : 'wrong');
  if (correct) {
    duelState.myPts++;
    const sc = document.getElementById('a-my-sc');
    sc.textContent = duelState.myPts;
    sc.classList.add('bump');
    setTimeout(() => sc.classList.remove('bump'), 400);
  }
  oppAnswer();
  setTimeout(() => { duelState.q++; loadDuelQ(); }, 900);
}

function oppAnswer() {
  if (Math.random() > 0.42) {
    duelState.oppPts++;
    document.getElementById('a-opp-sc').textContent = duelState.oppPts;
  }
}

function endDuel() {
  clearInterval(duelTimer);
  const won = duelState.myPts >= duelState.oppPts;
  const pts = won ? (duelState.myPts * 12 + 10) : -8;
  const ds = currentUser.duelStats || { total:0,wins:0,losses:0,rating:0 };
  ds.total++;
  if (won) ds.wins++; else ds.losses++;
  ds.rating = Math.max(0, (ds.rating||0) + pts);
  currentUser.duelStats = ds;
  currentUser.duelHistory = [...(currentUser.duelHistory||[]), { win:won, my:duelState.myPts, opp:duelState.oppPts, pts:Math.abs(pts) }];
  saveMe();
  document.getElementById('ar-verdict').textContent = won ? 'Победа' : 'Поражение';
  document.getElementById('ar-trophy').textContent = won ? '🏆' : '💪';
  document.getElementById('arena-progress-fill').style.width = '100%';
  document.getElementById('ar-sc').textContent      = `${duelState.myPts} : ${duelState.oppPts}`;
  document.getElementById('ar-pts').textContent     = won ? '+' + pts : pts;
  document.getElementById('ar-pts').style.color     = won ? '#86EFAC' : '#f87171';
  document.getElementById('arena-box').style.display    = 'none';
  document.getElementById('arena-result').style.display = 'flex';
  toast(won ? 'Победа! +' + pts + ' к рейтингу' : 'Поражение. Тренируйся!');
  renderDuelStats();
  renderLeaderboard();
}

function closeArena() {
  clearInterval(duelTimer);
  const ov = document.getElementById('arena-ov');
  ov.classList.remove('open');
  ov.style.display = 'none';
  document.getElementById('arena-box').style.display    = 'flex';
  document.getElementById('arena-result').style.display = 'none';
}

// ══════════════════════════════════════
// PROFILE
// ══════════════════════════════════════
function renderProfile() {
  const u = currentUser;
  document.getElementById('ph-ava').textContent      = u.name[0].toUpperCase();
  document.getElementById('ph-name').textContent     = u.name + (u.sname ? ' ' + u.sname : '');
  document.getElementById('ph-email').textContent    = u.email;
  document.getElementById('ph-streak-b').textContent = (u.streak||0) + ' дней';
  document.getElementById('ph-goal-b').textContent   = goalLabel(u.goal);
  document.getElementById('pf-name').value  = u.name;
  document.getElementById('pf-sname').value = u.sname;
  document.getElementById('pf-email').value = u.email;
  document.getElementById('pf-goal').value  = u.goal;

  const lp = document.getElementById('learn-prof');
  lp.innerHTML = `
    <div class="learn-prof-row"><span>Предмет</span><b>Физика</b></div>
    <div class="learn-prof-row"><span>Класс</span><b>${u.selectedClass ? u.selectedClass + ' класс' : 'не выбран'}</b></div>
    <div class="learn-prof-row"><span>Восприятие</span><b>${percLabel(u.perception)}</b></div>
    <div class="learn-prof-row"><span>Уровень</span><b>${levelName(u.level)}</b></div>
    <div class="learn-prof-row"><span>Цель</span><b>${goalLabel(u.goal)}</b></div>
    <div class="learn-prof-row"><span>Диагностика</span><b>${u.diagScore||0}/5</b></div>
  `;

  const lessonsDone = Object.values(u.progress||{}).filter(p=>p.done).length;
  const acc = u.totalTasks > 0 ? Math.round((u.correctTasks/u.totalTasks)*100) : 0;
  document.getElementById('prof-stats').innerHTML = `
    <div class="prof-stat-grid">
      <div class="psg-item"><div class="psg-val">${lessonsDone}</div><div class="psg-lbl">Уроков</div></div>
      <div class="psg-item"><div class="psg-val">${u.totalTasks||0}</div><div class="psg-lbl">Задач</div></div>
      <div class="psg-item"><div class="psg-val">${acc}%</div><div class="psg-lbl">Точность</div></div>
      <div class="psg-item"><div class="psg-val">${u.duelStats?.wins||0}</div><div class="psg-lbl">Побед</div></div>
      <div class="psg-item"><div class="psg-val">${u.duelStats?.rating||0}</div><div class="psg-lbl">Рейтинг</div></div>
      <div class="psg-item"><div class="psg-val">${u.streak||0}</div><div class="psg-lbl">Дней</div></div>
    </div>`;
}

function saveProfile() {
  currentUser.name  = document.getElementById('pf-name').value.trim() || currentUser.name;
  currentUser.sname = document.getElementById('pf-sname').value.trim() || currentUser.sname;
  currentUser.goal  = document.getElementById('pf-goal').value;
  saveMe();
  document.getElementById('sb-nm').textContent = currentUser.name;
  document.getElementById('sb-av').textContent = currentUser.name[0].toUpperCase();
  renderProfile();
  toast('Профиль сохранён');
}

function resetOnboarding() {
  currentUser.subject = null; currentUser.perception = null;
  currentUser.level = null; currentUser.progress = {};
  currentUser.selectedClass = null;
  saveMe();
  showScreen('ob'); obGo(1);
  ob_subject = null; ob_perc = null;
  selectedClass = null;
}

// ══════════════════════════════════════
// HELPERS
// ══════════════════════════════════════
function goalLabel(g) { return {ege:'ЕГЭ',oge:'ОГЭ',self:'Самообразование'}[g] || g; }
function percLabel(p) { return {visual:'Визуал',audio:'Аудиал',kinetic:'Кинестетик',digital:'Дигитал'}[p] || '—'; }
function shuffleArr(a) {
  for (let i=a.length-1; i>0; i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function esc(s) { const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════
   ТЬЮТОР — НОВЫЕ ФУНКЦИИ
══════════════════════════════════════ */

// ── Анимация приветствия на главной ──
// Используем requestAnimationFrame чтобы гарантировать что браузер
// увидел сброс классов до начала анимации (без rAF transition не срабатывает)
function runHomeGreeting() {
  const u = currentUser;
  if (!u) return;

  const helloEl    = document.getElementById('hgn-hello-text');
  const cursorEl   = document.getElementById('hgn-cursor');
  const questionEl = document.getElementById('hgn-question');
  const cardsEl    = document.getElementById('home-action-cards');
  if (!helloEl) return;

  if (window._gt) { clearInterval(window._gt); window._gt = null; }

  // Шаг 1: мгновенно скрываем без transition
  helloEl.textContent = '';
  if (cursorEl)   { cursorEl.style.transition = 'none'; cursorEl.style.opacity = '0'; cursorEl.style.animation = 'none'; }
  if (questionEl) { questionEl.style.transition = 'none'; questionEl.style.opacity = '0'; questionEl.style.transform = 'translateY(10px)'; }
  if (cardsEl)    { cardsEl.style.transition = 'none'; cardsEl.style.opacity = '0'; cardsEl.style.transform = 'translateY(10px)'; }

  const text = 'Привет, ' + u.name + '!';

  // Шаг 2: после rAF браузер зафиксировал opacity:0, теперь включаем анимации
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (cursorEl) {
      cursorEl.style.transition = 'opacity .3s ease';
      cursorEl.style.opacity = '1';
      cursorEl.style.animation = 'blink-cur .75s step-end infinite';
    }

    let i = 0;
    window._gt = setInterval(() => {
      helloEl.textContent = text.slice(0, ++i);
      if (i >= text.length) {
        clearInterval(window._gt);
        window._gt = null;

        setTimeout(() => {
          // скрываем курсор
          if (cursorEl) { cursorEl.style.opacity = '0'; cursorEl.style.animation = 'none'; }
          // показываем вопрос
          if (questionEl) {
            questionEl.style.transition = 'opacity .45s ease, transform .45s ease';
            questionEl.style.opacity = '1';
            questionEl.style.transform = 'translateY(0)';
          }
          // карточки чуть позже
          setTimeout(() => {
            if (cardsEl) {
              cardsEl.style.transition = 'opacity .45s ease, transform .45s ease';
              cardsEl.style.opacity = '1';
              cardsEl.style.transform = 'translateY(0)';
            }
          }, 250);
        }, 350);
      }
    }, 60);
  }));
}

// ── Показать раздел внутри "Изучить материал" ──
function showLearnSection(name) {
  // Скрываем зону загрузки и сетку плашек
  const zone = document.querySelector('.learn-upload-zone');
  const grid = document.querySelector('.learn-opts-grid');
  const hero = document.querySelector('.learn-hero');
  if (zone) zone.style.display = 'none';
  if (grid) grid.style.display = 'none';
  if (hero) hero.style.display = 'none';
  // Скрываем все разделы
  document.querySelectorAll('.learn-section').forEach(s => s.style.display = 'none');
  // Показываем нужный
  const target = document.getElementById('learn-section-' + name);
  if (target) target.style.display = 'block';
}

function hideLearnSections() {
  // Показываем зону загрузки и сетку обратно
  const zone = document.querySelector('.learn-upload-zone');
  const grid = document.querySelector('.learn-opts-grid');
  const hero = document.querySelector('.learn-hero');
  if (zone) zone.style.display = '';
  if (grid) grid.style.display = '';
  if (hero) hero.style.display = '';
  // Скрываем все разделы
  document.querySelectorAll('.learn-section').forEach(s => s.style.display = 'none');
}

// ── Мобильная навигация: синхронизация ──
function syncMobileNav(tabName) {
  document.querySelectorAll('.mn-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector('.mn-btn[data-t="' + tabName + '"]');
  if (btn) btn.classList.add('active');
}
