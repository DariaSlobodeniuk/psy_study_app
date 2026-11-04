// Навчання: розклад, завдання і прогрес. Дані лежать у data/data.json,
// а все, що ти змінюєш у додатку (статуси, свої завдання, посилання), зберігається на телефоні.

const $ = (s, el = document) => el.querySelector(s);
const view = $('#view');
const sheet = $('#sheet');

const DAYS = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];
const DAYS_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const STATUS = ['Не почато', 'В процесі', 'Готово'];

// ---------- маскот ----------
function mascot(mood = 'happy', cls = '') {
  const eyes = mood === 'sleepy'
    ? '<path d="M32 54 q5 4 10 0M58 54 q5 4 10 0" stroke="#4a3f5c" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<circle cx="37" cy="54" r="4.5" fill="#4a3f5c"/><circle cx="63" cy="54" r="4.5" fill="#4a3f5c"/><circle cx="38.5" cy="52.5" r="1.6" fill="#fff"/><circle cx="64.5" cy="52.5" r="1.6" fill="#fff"/>';
  const mouth = '<path d="M44 63 q3 3 6 0 q3 3 6 0" stroke="#7a5a8c" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  return `<svg class="mascot ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="M22 40 L20 12 L42 28 Z M78 40 L80 12 L58 28 Z" fill="#fff" stroke="#e3d3f5" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M25 33 L24 19 L36 28 Z M75 33 L76 19 L64 28 Z" fill="#ffcfe3"/>
    <ellipse cx="50" cy="58" rx="36" ry="32" fill="#fff" stroke="#e3d3f5" stroke-width="2.5"/>
    <path d="M44 27 q3 -7 6 0 q3 -8 6 0" fill="#fff" stroke="#e3d3f5" stroke-width="2.5" stroke-linejoin="round"/>
    ${eyes}
    <ellipse cx="29" cy="64" rx="6" ry="3.5" fill="#ffc2da"/><ellipse cx="71" cy="64" rx="6" ry="3.5" fill="#ffc2da"/>
    <path d="M48 59 h4 l-2 2.5z" fill="#f59ab9"/>
    ${mouth}
  </svg>`;
}

// ---------- збережений стан ----------
const store = {
  get(key, def) { try { const v = localStorage.getItem('study:' + key); return v ? JSON.parse(v) : def; } catch { return def; } },
  set(key, val) { try { localStorage.setItem('study:' + key, JSON.stringify(val)); } catch {} },
};
const state = {
  tab: store.get('tab', 'today'),
  week: 0,
  filter: store.get('filter', 'all'),
  showDone: store.get('showDone', false),
  status: store.get('status', {}),
  custom: store.get('custom', []),
  links: store.get('links', {}),
  notified: store.get('notified', {}),
  steps: store.get('steps', {}),
  read: store.get('read', {}),
  cards: store.get('cards', {}),
  plans: store.get('plans', {}),
  budget: store.get('budget', 60),
  learnFilter: store.get('learnFilter', 'all'),
  reading: null,
  deck: null,
};
let DATA = null;
let LEARN = [];
const cache = {};

// ---------- дати ----------
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseDate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const at = (date, time) => { const d = parseDate(date); const [h, m] = time.split(':').map(Number); d.setHours(h, m, 0, 0); return d; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const mondayOf = d => addDays(d, -((d.getDay() + 6) % 7));
const daysUntil = s => Math.round((parseDate(s) - today()) / 864e5);
const fmtDay = d => `${d.getDate()} ${MONTHS[d.getMonth()]}`;
const fmtShort = s => { const d = parseDate(s); return `${d.getDate()}.${pad(d.getMonth() + 1)}`; };

function dueLabel(s) {
  const n = daysUntil(s);
  if (n < 0) return { text: `прострочено на ${-n} дн.`, cls: 'over' };
  if (n === 0) return { text: 'сьогодні', cls: 'over' };
  if (n === 1) return { text: 'завтра', cls: 'soon' };
  if (n <= 7) return { text: `через ${n} дн. (${fmtShort(s)})`, cls: 'soon' };
  return { text: `до ${fmtShort(s)}`, cls: '' };
}
function until(ms) {
  const m = Math.round(ms / 6e4);
  if (m < 60) return `${m} хв`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `${h} год ${r} хв` : `${h} год`;
  const d = Math.round(h / 24);
  return `${d} дн.`;
}

// ---------- дані ----------
const subj = id => DATA.subjects.find(s => s.id === id) || { short: 'Інше', name: 'Інше', color: '#cbbfe0' };
function derivedStatus(t) {
  if (state.status[t.id] !== undefined) return state.status[t.id];
  const steps = t.steps || [];
  const done = steps.filter(s => state.steps[s.id]).length;
  if (steps.length && done === steps.length) return 2;
  return done ? 1 : 0;
}
const allTasks = () => [...DATA.tasks, ...state.custom].map(t => ({ ...t, st: derivedStatus(t) }));
const lesson = id => LEARN.find(l => l.id === id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function eventsOn(dateStr) {
  return DATA.events.filter(e => e.date === dateStr).sort((a, b) => a.start.localeCompare(b.start));
}
function nextEvent() {
  const now = new Date();
  return DATA.events
    .map(e => ({ e, s: at(e.date, e.start), f: at(e.date, e.end) }))
    .filter(x => x.f > now)
    .sort((a, b) => a.s - b.s)[0];
}

// ---------- шматки інтерфейсу ----------
function eventHTML(e, opts = {}) {
  const s = subj(e.subject);
  const now = new Date();
  const st = at(e.date, e.start), fn = at(e.date, e.end);
  const cls = now >= st && now < fn ? 'now' : (fn < now ? 'past' : '');
  const link = state.links[e.subject];
  const title = e.subject === 'mil' ? e.title : `${e.type}`;
  return `<div class="card event ${cls}" style="--c:${s.color}">
    <div class="time">${e.start}<small>${e.end}</small></div>
    <div class="body">
      <div class="subj">${esc(s.short)}</div>
      <div class="meta">${esc(title)} · ${esc(e.format)}${e.subject !== 'mil' ? ' · ' + esc(s.teacher) : ''}</div>
      ${link && e.format === 'Zoom' && cls !== 'past' ? `<a class="join" href="${esc(link)}" target="_blank" rel="noopener">Приєднатися в Zoom →</a>` : ''}
      ${opts.date ? `<div class="meta">${fmtDay(parseDate(e.date))}</div>` : ''}
    </div>
  </div>`;
}

function taskHTML(t) {
  const s = subj(t.subject);
  const due = t.deadline ? dueLabel(t.deadline) : null;
  const ck = ['', 'progress', 'done'][t.st];
  return `<div class="card task ${t.st === 2 ? 'done' : ''}" data-task="${t.id}">
    <button class="check ${ck}" data-cycle="${t.id}" aria-label="Змінити статус: ${STATUS[t.st]}">${t.st === 2 ? '✓' : ''}</button>
    <div>
      <div class="title ${t.priority === 'Високий' && t.st !== 2 ? 'prio-high' : ''}">${esc(t.title)}</div>
      <div class="row">
        <span class="chip" style="--c:${s.color}"><span class="dot"></span>${esc(s.short)}</span>
        ${due && t.st !== 2 ? `<span class="due ${due.cls}">${due.text}</span>` : ''}
        ${!t.deadline && t.st !== 2 ? '<span class="small muted">без дати</span>' : ''}
        ${t.st === 1 ? '<span class="small" style="color:var(--warn)">в процесі</span>' : ''}
      </div>
      ${t.steps && t.steps.length && t.st !== 2 ? `<div class="mini" title="кроки"><span style="width:${t.steps.filter(s => state.steps[s.id]).length / t.steps.length * 100}%"></span></div>` : ''}
    </div>
  </div>`;
}

function cheer(text, mood = 'happy') {
  return `<div class="cheer">${mascot(mood, 'wiggle')}<div>${text}</div></div>`;
}

// ---------- екрани ----------
function renderToday() {
  const t = today();
  const now = new Date();
  const ev = eventsOn(iso(t));
  const nx = nextEvent();
  const tasks = allTasks().filter(x => x.st !== 2);
  const dated = tasks.filter(x => x.deadline && daysUntil(x.deadline) <= 14).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const inProgress = tasks.filter(x => x.st === 1 && !dated.includes(x));
  const ms = (DATA.milestones || []).filter(m => daysUntil(m.date) >= 0 && daysUntil(m.date) <= 21);
  const h = now.getHours();
  const hi = h < 12 ? 'Доброго ранку' : h < 18 ? 'Гарного дня' : 'Добрий вечір';

  let html = `<p class="muted" style="margin:0 4px 12px">${hi}! Сьогодні ${DAYS[t.getDay()]}, ${fmtDay(t)}.</p>`;

  if (nx) {
    const s = subj(nx.e.subject);
    const live = now >= nx.s;
    html += `<div class="card hero">
      <div class="label">${live ? 'Зараз іде' : 'Наступне заняття'}</div>
      <div class="big">${esc(s.short)}</div>
      <div class="countdown">${nx.e.subject === 'mil' ? esc(nx.e.title) + '<br>' : ''}${DAYS[nx.s.getDay()]}, ${fmtDay(nx.s)}, ${nx.e.start}–${nx.e.end}
        · ${live ? 'закінчиться через ' + until(nx.f - now) : 'через ' + until(nx.s - now)}</div>
    </div>`;
  }

  html += planHTML();
  html += `<div class="section-title">Заняття сьогодні</div>`;
  html += ev.length ? `<div class="stack">${ev.map(e => eventHTML(e)).join('')}</div>` : cheer('Сьогодні занять немає. Можна видихнути 🌸', 'sleepy');

  if (ms.length) {
    html += `<div class="section-title">Важливі дати</div><div class="stack">` + ms.map(m => {
      const s = subj(m.subject); const n = daysUntil(m.date);
      return `<div class="card" style="display:flex;gap:10px;align-items:center"><span class="dot" style="--c:${s.color};width:12px;height:12px"></span>
        <div><b>${esc(m.title)}</b><div class="small muted">${fmtDay(parseDate(m.date))} · ${n === 0 ? 'сьогодні' : 'через ' + n + ' дн.'}</div></div></div>`;
    }).join('') + `</div>`;
  }

  html += `<div class="section-title">Дедлайни на два тижні</div>`;
  html += dated.length ? `<div class="stack">${dated.map(taskHTML).join('')}</div>` : `<div class="card empty">Найближчими днями нічого здавати не треба ✨</div>`;

  if (inProgress.length) html += `<div class="section-title">Ти зараз робиш</div><div class="stack">${inProgress.map(taskHTML).join('')}</div>`;

  const undated = tasks.filter(x => !x.deadline).length;
  if (undated) html += `<p class="small muted" style="margin:14px 4px">Ще ${undated} завдань без дати, вони у вкладці «Завдання».</p>`;
  return html;
}

function renderSchedule() {
  const mon = addDays(mondayOf(today()), state.week * 7);
  const sun = addDays(mon, 6);
  const label = state.week === 0 ? 'Цей тиждень' : state.week === 1 ? 'Наступний тиждень' : state.week === -1 ? 'Минулий тиждень' : `${fmtDay(mon)} – ${fmtDay(sun)}`;
  let html = `<div class="weeknav">
    <button data-week="-1" aria-label="Попередній тиждень">‹</button>
    <div class="label">${label}<div class="small muted">${fmtDay(mon)} – ${fmtDay(sun)}</div></div>
    <button data-week="1" aria-label="Наступний тиждень">›</button></div>`;
  let any = false;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), ds = iso(d);
    const ev = eventsOn(ds);
    const dl = allTasks().filter(t => t.deadline === ds && t.st !== 2);
    const ms = (DATA.milestones || []).filter(m => m.date === ds);
    if (!ev.length && !dl.length && !ms.length) continue;
    any = true;
    html += `<div class="day-head ${ds === iso(today()) ? 'today' : ''}"><b>${DAYS[d.getDay()]}, ${fmtDay(d)}</b><span class="small muted">${ev.length ? ev.length + ' зан.' : ''}</span></div><div class="stack">`;
    html += ev.map(e => eventHTML(e)).join('');
    html += ms.map(m => `<div class="card small">📍 ${esc(m.title)}</div>`).join('');
    html += dl.map(taskHTML).join('');
    html += `</div>`;
  }
  if (!any) html += cheer('На цьому тижні в розкладі порожньо', 'sleepy');
  if (state.week !== 0) html += `<p style="text-align:center;margin-top:18px"><button class="btn ghost" data-week="0">До цього тижня</button></p>`;
  return html;
}

function renderTasks() {
  const list = allTasks();
  const used = DATA.subjects.filter(s => list.some(t => t.subject === s.id));
  let html = `<div class="filters">
    <button data-filter="all" class="${state.filter === 'all' ? 'on' : ''}">Усі</button>
    ${used.map(s => `<button data-filter="${s.id}" class="${state.filter === s.id ? 'on' : ''}">${esc(s.short)}</button>`).join('')}
  </div>`;
  let items = list.filter(t => state.filter === 'all' || t.subject === state.filter);
  const open = items.filter(t => t.st !== 2);
  const done = items.filter(t => t.st === 2);
  const dated = open.filter(t => t.deadline).sort((a, b) => a.deadline.localeCompare(b.deadline));
  const undated = open.filter(t => !t.deadline).sort((a, b) => (a.priority === 'Високий' ? 0 : 1) - (b.priority === 'Високий' ? 0 : 1));

  if (dated.length) html += `<div class="section-title">З дедлайном</div><div class="stack">${dated.map(taskHTML).join('')}</div>`;
  if (undated.length) html += `<div class="section-title">До сесії, дата ще невідома</div><div class="stack">${undated.map(taskHTML).join('')}</div>`;
  if (!open.length) html += cheer('Усе зроблено! Ти молодець 💜');
  if (done.length) {
    html += `<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">Зроблено (${done.length})
      <button class="icon-btn small" data-toggle-done>${state.showDone ? 'сховати' : 'показати'}</button></div>`;
    if (state.showDone) html += `<div class="stack">${done.map(taskHTML).join('')}</div>`;
  }
  html += `<p class="small muted" style="margin:16px 4px">Натисни кружечок, щоб змінити статус: не почато → в процесі → готово.</p>`;
  html += `<button class="btn fab" data-add aria-label="Додати завдання">+</button>`;
  return html;
}

function renderProgress() {
  const list = allTasks();
  const total = list.length, done = list.filter(t => t.st === 2).length, prog = list.filter(t => t.st === 1).length;
  let html = `<div class="stats">
    <div class="card stat"><b>${done}</b><span>готово</span></div>
    <div class="card stat"><b>${prog}</b><span>в процесі</span></div>
    <div class="card stat"><b>${total - done - prog}</b><span>не почато</span></div></div>`;

  const lect = LEARN.filter(l => l.kind !== 'qa');
  const qa = LEARN.filter(l => l.kind === 'qa');
  const stepsAll = allTasks().flatMap(t => t.steps || []);
  html += `<div class="stats" style="margin-top:8px">
    <div class="card stat"><b>${stepsAll.filter(s => state.steps[s.id]).length}</b><span>кроків з ${stepsAll.length}</span></div>
    <div class="card stat"><b>${lect.filter(l => state.read[l.id]).length}</b><span>конспектів з ${lect.length}</span></div>
    <div class="card stat"><b>${qa.reduce((a, l) => a + cardsKnown(l.id), 0)}</b><span>карток з ${qa.reduce((a, l) => a + l.count, 0)}</span></div></div>`;

  // прогрес по предметах
  html += `<div class="section-title">Завдання по предметах</div><div class="card">`;
  for (const s of DATA.subjects) {
    const ts = list.filter(t => t.subject === s.id);
    if (!ts.length) continue;
    const d = ts.filter(t => t.st === 2).length, p = ts.filter(t => t.st === 1).length;
    html += `<div class="bar-row"><span>${esc(s.short)}</span>
      <div class="bar"><span style="width:${d / ts.length * 100}%;background:${s.color}"></span><span style="width:${p / ts.length * 100}%;background:${s.color};opacity:.4"></span></div>
      <span class="n">${d}/${ts.length}</span></div>`;
  }
  html += `<div class="legend"><span><i style="background:var(--accent)"></i>готово</span><span><i style="background:var(--accent);opacity:.4"></i>в процесі</span></div></div>`;

  // навантаження по тижнях: години занять
  const start = addDays(mondayOf(today()), -21);
  const weeks = [];
  for (let w = 0; w < 10; w++) {
    const a = addDays(start, w * 7), b = addDays(a, 7);
    const per = {};
    let sum = 0;
    for (const e of DATA.events) {
      const d = parseDate(e.date);
      if (d >= a && d < b) {
        const hrs = (at(e.date, e.end) - at(e.date, e.start)) / 36e5;
        per[e.subject] = (per[e.subject] || 0) + hrs; sum += hrs;
      }
    }
    weeks.push({ a, per, sum, cur: w === 3 });
  }
  const max = Math.max(4, ...weeks.map(w => w.sum));
  html += `<div class="section-title">Години занять по тижнях</div><div class="card"><div class="load">` +
    weeks.map(w => `<div class="col ${w.cur ? 'cur' : ''}" title="${w.sum.toFixed(1)} год">
      <small>${w.sum ? Math.round(w.sum) : ''}</small>
      <div class="stackbar" style="height:${w.sum / max * 100}%">${Object.entries(w.per).map(([k, v]) => `<span style="height:${v / w.sum * 100}%;background:${subj(k).color}"></span>`).join('')}</div>
      <small>${w.a.getDate()}.${pad(w.a.getMonth() + 1)}</small></div>`).join('') +
    `</div><div class="legend">${DATA.subjects.filter(s => DATA.events.some(e => e.subject === s.id)).map(s => `<span><i style="background:${s.color}"></i>${esc(s.short)}</span>`).join('')}</div>
    <p class="small muted" style="margin:10px 0 0">Тиждень, у якому ти зараз, виділено. Сесія Каразіна в розкладі поки лише одна, бо дат наступної ще немає.</p></div>`;

  // курс УКУ
  const mil = DATA.events.filter(e => e.subject === 'mil');
  const now = new Date();
  for (const st of [1, 2]) {
    const ls = mil.filter(e => e.stage === st);
    if (!ls.length) continue;
    const past = ls.filter(e => at(e.date, e.end) < now).length;
    html += `${st === 1 ? '<div class="section-title">Курс УКУ: військовий психолог</div>' : ''}<div class="card" style="margin-top:8px">
      <div style="display:flex;justify-content:space-between"><b>Ступінь ${st}</b><span class="small muted">${past} з ${ls.length} лекцій</span></div>
      <div class="bar" style="margin-top:8px"><span style="width:${past / ls.length * 100}%;background:linear-gradient(90deg,var(--accent),var(--accent-2))"></span></div>
      <div class="small muted" style="margin-top:6px">${fmtDay(parseDate(ls[0].date))} – ${fmtDay(parseDate(ls[ls.length - 1].date))}</div></div>`;
  }
  return html;
}

// ---------- шторки ----------
function openSheet(html) {
  sheet.innerHTML = `<div class="sheet">${html}</div>`;
  sheet.showModal();
}
sheet.addEventListener('click', e => { if (e.target === sheet || e.target.closest('[data-close]')) sheet.close(); });

function taskSheet(id) {
  const t = allTasks().find(x => x.id === id);
  if (!t) return;
  const s = subj(t.subject);
  const isCustom = state.custom.some(c => c.id === id);
  openSheet(`
    <span class="chip" style="--c:${s.color}"><span class="dot"></span>${esc(s.name)}</span>
    <h2 style="margin-top:10px">${esc(t.title)}</h2>
    ${t.deadline ? `<p><b>Дедлайн:</b> ${fmtDay(parseDate(t.deadline))} (${dueLabel(t.deadline).text})</p>` : '<p class="muted">Дати поки немає.</p>'}
    ${t.notes ? `<div class="note">${esc(t.notes)}</div>` : ''}
    ${t.steps && t.steps.length ? `<label>Кроки (${t.steps.filter(x => state.steps[x.id]).length} з ${t.steps.length})</label>
      <div class="steps-list">${t.steps.map(stepRow).join('')}</div>` : ''}
    <label>Статус</label>
    <div class="seg">${STATUS.map((n, i) => `<button data-set="${i}" class="${t.st === i ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="actions">
      ${isCustom ? '<button class="btn ghost" data-del>Видалити</button>' : ''}
      <button class="btn" data-close>Готово</button>
    </div>`);
  sheet.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { setStatus(id, +b.dataset.set); taskSheet(id); });
  sheet.querySelectorAll('[data-step]').forEach(b => b.onclick = () => { toggleStep(b.dataset.step); taskSheet(id); });
  sheet.querySelectorAll('[data-open-learn]').forEach(b => b.onclick = () => { sheet.close(); openLearn(b.dataset.openLearn); });
  const del = $('[data-del]', sheet);
  if (del) del.onclick = () => { state.custom = state.custom.filter(c => c.id !== id); store.set('custom', state.custom); sheet.close(); render(); };
}

function addSheet() {
  openSheet(`<h2>Нове завдання</h2>
    <form id="add-form">
      <label for="f-title">Що зробити</label><input id="f-title" required placeholder="Наприклад, прочитати статтю">
      <label for="f-subj">Предмет</label><select id="f-subj">${DATA.subjects.map(s => `<option value="${s.id}" ${state.filter === s.id ? 'selected' : ''}>${esc(s.short)}</option>`).join('')}</select>
      <label for="f-date">Дедлайн (можна залишити порожнім)</label><input id="f-date" type="date">
      <label for="f-notes">Нотатки</label><textarea id="f-notes"></textarea>
      <div class="actions"><button type="button" class="btn ghost" data-close>Скасувати</button><button class="btn">Додати</button></div>
    </form>`);
  $('#add-form').onsubmit = e => {
    e.preventDefault();
    state.custom.push({ id: 'c' + Date.now(), title: $('#f-title').value.trim(), subject: $('#f-subj').value, deadline: $('#f-date').value || null, priority: 'Середній', notes: $('#f-notes').value.trim() });
    store.set('custom', state.custom);
    sheet.close(); toast('Додано 💜'); render();
  };
}

function settingsSheet() {
  const theme = store.get('theme', 'auto');
  const perm = 'Notification' in window ? Notification.permission : 'unsupported';
  const ics = new URL('calendar.ics', location.href).href;
  const zoomSubjects = DATA.subjects.filter(s => DATA.events.some(e => e.subject === s.id && e.format === 'Zoom'));
  openSheet(`<h2>Налаштування</h2>
    <label>Тема</label>
    <div class="seg">${[['auto', 'Як у системі'], ['light', 'Світла'], ['dark', 'Темна']].map(([k, n]) => `<button data-theme="${k}" class="${theme === k ? 'on' : ''}">${n}</button>`).join('')}</div>

    <label>Нагадування в додатку</label>
    ${perm === 'unsupported' ? '<p class="small muted">Цей браузер не вміє показувати сповіщення.</p>' :
      perm === 'granted' ? '<p class="small">Увімкнено. Додаток нагадає за 15 хвилин до заняття і зранку про дедлайни, коли він відкритий або нещодавно відкривався.</p>' :
      '<button class="btn block" data-notify>Увімкнути нагадування</button>'}

    <label>Нагадування через календар</label>
    <p class="small" style="margin:0 0 8px">Найнадійніше: підписатися на календар додатку, тоді Google Календар сам нагадуватиме навіть із закритим додатком.</p>
    <button class="btn ghost block" data-copy="${esc(ics)}">Скопіювати посилання на календар</button>
    <p class="small muted">У Google Календарі на комп'ютері: «Інші календарі» → «+» → «За URL» → встав посилання.</p>

    <label>Посилання на Zoom</label>
    <p class="small muted" style="margin:0 0 6px">Вони зберігаються лише на цьому пристрої, в репозиторій не потрапляють.</p>
    ${zoomSubjects.map(s => `<input data-link="${s.id}" placeholder="${esc(s.short)}" value="${esc(state.links[s.id] || '')}" style="margin-bottom:6px">`).join('')}

    <p class="small muted" style="margin-top:16px">Дані оновлено ${fmtDay(parseDate(DATA.updated))}. ${(DATA.notes || []).map(esc).join(' ')}</p>
    <div class="actions"><button class="btn" data-close>Готово</button></div>`);
  sheet.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { store.set('theme', b.dataset.theme); applyTheme(); settingsSheet(); });
  sheet.querySelectorAll('[data-link]').forEach(i => i.onchange = () => { state.links[i.dataset.link] = i.value.trim(); store.set('links', state.links); render(); });
  const n = $('[data-notify]', sheet);
  if (n) n.onclick = async () => { await Notification.requestPermission(); checkReminders(); settingsSheet(); };
  const c = $('[data-copy]', sheet);
  if (c) c.onclick = async () => { try { await navigator.clipboard.writeText(c.dataset.copy); toast('Скопійовано'); } catch { prompt('Скопіюй посилання:', c.dataset.copy); } };
}

// ---------- дії ----------
function setStatus(id, st) {
  state.status[id] = st; store.set('status', state.status);
  if (st === 2) toast(['Ура! 🎉', 'Готово, так тримати 💜', 'Ще одне зроблено ✨', 'Молодець 🌸'][Math.floor(Math.random() * 4)]);
  render();
}
function toast(text) {
  const t = document.createElement('div'); t.className = 'toast pop'; t.textContent = text;
  document.body.append(t); setTimeout(() => t.remove(), 1800);
}
function applyTheme() {
  const t = store.get('theme', 'auto');
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
}

// ---------- нагадування, поки додаток відкритий ----------
async function notify(key, title, body) {
  if (state.notified[key]) return;
  state.notified[key] = Date.now(); store.set('notified', state.notified);
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg) reg.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: key });
    else new Notification(title, { body });
  } catch {}
}
function checkReminders() {
  if (!DATA || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  for (const e of DATA.events) {
    const s = at(e.date, e.start), diff = (s - now) / 6e4;
    if (diff > 0 && diff <= 15) notify(`ev:${e.date}:${e.start}:${e.subject}`, `${subj(e.subject).short} о ${e.start}`, e.subject === 'mil' ? e.title : `${e.type}, ${e.format}`);
  }
  if (now.getHours() >= 9) {
    for (const t of allTasks()) {
      if (!t.deadline || t.st === 2) continue;
      const n = daysUntil(t.deadline);
      if (n === 0 || n === 1 || n === 3) notify(`dl:${t.id}:${iso(today())}`, n === 0 ? 'Дедлайн сьогодні' : `Дедлайн через ${n} дн.`, t.title);
    }
  }
}

// ---------- кроки і план на день ----------
function stepRow(s) {
  const done = !!state.steps[s.id];
  return `<div class="step ${done ? 'done' : ''}">
    <button class="check ${done ? 'done' : ''}" data-step="${s.id}" aria-label="Відмітити крок">${done ? '✓' : ''}</button>
    <span class="t">${esc(s.title)}${s.learn && lesson(s.learn) ? ` <button class="linkish" data-open-learn="${s.learn}">відкрити →</button>` : ''}</span>
    <span class="small muted">${s.min} хв</span></div>`;
}
function toggleStep(id) {
  state.steps[id] = !state.steps[id];
  if (!state.steps[id]) delete state.steps[id];
  store.set('steps', state.steps);
  if (state.steps[id]) toast(['Крок зроблено ✨', 'Так тримати 💜', 'Ще трішки ближче 🌸', 'Молодець!'][Math.floor(Math.random() * 4)]);
}
function allSteps() {
  const out = [];
  for (const t of allTasks()) {
    if (t.st === 2 || !t.steps) continue;
    t.steps.forEach((s, i) => out.push({ ...s, task: t, idx: i }));
  }
  return out;
}
// Кроки на сьогодні: спершу те, що з найближчим дедлайном, далі високий пріоритет,
// по одному кроку з завдання, поки не набереться твій час на день.
function buildPlan() {
  const stepsById = Object.fromEntries(allSteps().map(s => [s.id, s]));
  const key = iso(today());
  if (state.plans[key]) return state.plans[key].map(id => stepsById[id] || findStep(id)).filter(Boolean);
  const tasks = allTasks().filter(t => t.st !== 2 && t.steps && t.steps.some(s => !state.steps[s.id]));
  const score = t => {
    let v = t.deadline ? Math.max(0, daysUntil(t.deadline)) : 200;
    if (t.priority === 'Високий') v -= 20;
    return v;
  };
  tasks.sort((a, b) => score(a) - score(b));
  const plan = []; let used = 0; const usedSubj = {};
  for (const pass of [0, 1]) {
    for (const t of tasks) {
      if (plan.length >= 4) break;
      if (pass === 0 && usedSubj[t.subject]) continue;
      const s = t.steps.find(x => !state.steps[x.id] && !plan.some(p => p.id === x.id));
      if (!s) continue;
      if (used + s.min > state.budget && plan.length) continue;
      plan.push({ ...s, task: t }); used += s.min; usedSubj[t.subject] = 1;
    }
  }
  state.plans = { [key]: plan.map(p => p.id) }; store.set('plans', state.plans);
  return plan;
}
function findStep(id) {
  for (const t of allTasks()) for (const s of t.steps || []) if (s.id === id) return { ...s, task: t };
}
function planHTML() {
  const plan = buildPlan();
  const done = plan.filter(s => state.steps[s.id]).length;
  const mins = plan.reduce((a, s) => a + s.min, 0);
  let html = `<div class="section-title" style="display:flex;justify-content:space-between;align-items:center">План на сьогодні
    <span><button class="linkish" data-budget>${state.budget} хв на день</button></span></div>`;
  if (!plan.length) return html + cheer('На сьогодні кроків немає. Відпочивай 💜');
  html += `<div class="card plan">` + plan.map(s => {
    const d = !!state.steps[s.id]; const sb = subj(s.task.subject);
    return `<div class="step ${d ? 'done' : ''}">
      <button class="check ${d ? 'done' : ''}" data-step="${s.id}" aria-label="Відмітити крок">${d ? '✓' : ''}</button>
      <div><div class="t">${esc(s.title)}</div>
        <div class="s"><span class="dot" style="--c:${sb.color}"></span>${esc(sb.short)} · ${esc(s.task.title)}
        ${s.learn && lesson(s.learn) ? `<button class="linkish" data-open-learn="${s.learn}">відкрити →</button>` : ''}</div></div>
      <span class="min">${s.min} хв</span></div>`;
  }).join('') +
  `<div class="small muted" style="display:flex;justify-content:space-between;margin-top:8px">
     <span>${done === plan.length ? 'Усе на сьогодні зроблено 🎉' : `Зроблено ${done} з ${plan.length} · разом ~${mins} хв`}</span>
     <button class="linkish" data-replan>інші кроки</button></div></div>`;
  return html;
}
function budgetSheet() {
  openSheet(`<h2>Скільки часу на навчання в день?</h2>
    <p class="small muted">Від цього залежить, скільки кроків буде в плані на сьогодні.</p>
    <div class="seg">${[30, 60, 90, 120].map(m => `<button data-b="${m}" class="${state.budget === m ? 'on' : ''}">${m} хв</button>`).join('')}</div>
    <div class="actions"><button class="btn" data-close>Готово</button></div>`);
  sheet.querySelectorAll('[data-b]').forEach(b => b.onclick = () => {
    state.budget = +b.dataset.b; store.set('budget', state.budget);
    delete state.plans[iso(today())]; store.set('plans', state.plans);
    budgetSheet(); render();
  });
}

// ---------- вчити: конспекти і картки ----------
async function getFile(file) {
  if (!cache[file]) {
    const r = await fetch('data/learn/' + file, { cache: 'no-cache' });
    cache[file] = file.endsWith('.json') ? await r.json() : await r.text();
  }
  return cache[file];
}
function openLearn(id) {
  const l = lesson(id); if (!l) return;
  state.tab = 'learn'; store.set('tab', 'learn');
  if (l.kind === 'qa') { state.deck = { id, shown: false, cur: null }; state.reading = null; }
  else { state.reading = id; state.deck = null; }
  render(); window.scrollTo({ top: 0 });
}
async function renderLearn() {
  if (state.reading) {
    const l = lesson(state.reading);
    const html = await getFile(l.file);
    const s = subj(l.subject);
    return `<div class="backbar"><button data-back>‹ Назад</button><span class="chip" style="--c:${s.color}"><span class="dot"></span>${esc(s.short)}</span></div>
      <h2 style="margin:4px 4px 12px;font-size:21px;line-height:1.3">${esc(l.title)}</h2>
      <article class="reader">${html}</article>
      <p style="margin-top:16px"><button class="btn block ${state.read[l.id] ? 'ghost' : ''}" data-mark-read="${l.id}">${state.read[l.id] ? 'Прочитано ✓ (натисни, щоб зняти)' : 'Я прочитала 📖'}</button></p>`;
  }
  if (state.deck) return renderDeck();
  const subjects = DATA.subjects.filter(s => LEARN.some(l => l.subject === s.id));
  let html = `<div class="filters">
    <button data-lfilter="all" class="${state.learnFilter === 'all' ? 'on' : ''}">Усі</button>
    ${subjects.map(s => `<button data-lfilter="${s.id}" class="${state.learnFilter === s.id ? 'on' : ''}">${esc(s.short)}</button>`).join('')}</div>`;
  for (const s of subjects) {
    if (state.learnFilter !== 'all' && state.learnFilter !== s.id) continue;
    const items = LEARN.filter(l => l.subject === s.id);
    const readN = items.filter(l => l.kind !== 'qa' && state.read[l.id]).length;
    const lect = items.filter(l => l.kind !== 'qa').length;
    html += `<div class="section-title" style="display:flex;justify-content:space-between">${esc(s.short)}<span>${lect ? `${readN}/${lect} прочитано` : ''}</span></div><div class="stack">`;
    html += items.map(l => {
      if (l.kind === 'qa') {
        const known = cardsKnown(l.id);
        return `<div class="card lesson" style="--c:${s.color}" data-open-learn="${l.id}"><div class="ico">🃏</div>
          <div><div class="t">${esc(l.title)}</div><div class="meta">Картки для самоперевірки · запам'ятала ${known} з ${l.count}</div>
          <div class="mini"><span style="width:${known / l.count * 100}%"></span></div></div></div>`;
      }
      const r = state.read[l.id];
      return `<div class="card lesson" style="--c:${s.color}" data-open-learn="${l.id}"><div class="ico">${r ? '✅' : l.kind === 'practice' ? '🧩' : '📖'}</div>
        <div><div class="t">${esc(l.title)}</div><div class="meta">${l.date ? fmtDay(parseDate(l.date)) + ' · ' : ''}~${l.minutes} хв читання${r ? ' · прочитано' : ''}</div></div></div>`;
    }).join('');
    html += `</div>`;
  }
  const missing = DATA.subjects.filter(s => !LEARN.some(l => l.subject === s.id)).map(s => s.short);
  if (missing.length) html += `<p class="small muted" style="margin:16px 4px">Конспектів ще немає: ${missing.map(esc).join(', ')}. Скинь записи лекцій, і я додам.</p>`;
  return html;
}
function cardsKnown(id) { return Object.entries(state.cards).filter(([k, v]) => k.startsWith(id + ':') && v >= 2).length; }
async function renderDeck() {
  const l = lesson(state.deck.id);
  const cards = await getFile(l.file);
  if (state.deck.cur === null) {
    // спершу ті, що ще не знаєш; серед них — з найменшою кількістю «знаю»
    const order = cards.map((c, i) => ({ i, box: state.cards[`${l.id}:${i}`] || 0 }))
      .filter(x => x.box < 2).sort((a, b) => a.box - b.box || a.i - b.i);
    state.deck.cur = order.length ? order[0].i : -1;
    state.deck.shown = false;
  }
  const known = cardsKnown(l.id);
  let html = `<div class="backbar"><button data-back>‹ Назад</button><span class="small muted">запам'ятала ${known} з ${cards.length}</span></div>
    <div class="mini" style="margin:0 4px 14px"><span style="width:${known / cards.length * 100}%"></span></div>`;
  if (state.deck.cur === -1) return html + cheer('Усі картки запам\'ятала! Ти неймовірна 💜') +
    `<p style="text-align:center"><button class="btn ghost" data-reset-deck>Почати спочатку</button></p>`;
  const c = cards[state.deck.cur];
  html += `<div class="card flash">
    <div class="lec">${esc(c.lecture || '')}</div>
    <div class="q">${esc(c.q)}</div>
    ${state.deck.shown ? `<div class="a">${c.a}</div>` : `<p class="muted small" style="margin-top:auto">Спробуй згадати відповідь, а потім подивись.</p>`}
  </div>`;
  html += state.deck.shown
    ? `<div class="flash-actions"><button class="btn soft" data-answer="no">Ще повторю</button><button class="btn good" data-answer="yes">Знаю 💜</button></div>`
    : `<div class="flash-actions"><button class="btn block" data-reveal>Показати відповідь</button></div>`;
  html += `<p class="small muted" style="margin:14px 4px">Картка вважається вивченою, коли двічі натиснеш «Знаю». Відповіді писала Claude за лекціями, звіряй їх перед іспитом.</p>`;
  return html;
}
function answerCard(yes) {
  const key = `${state.deck.id}:${state.deck.cur}`;
  state.cards[key] = yes ? (state.cards[key] || 0) + 1 : 0;
  store.set('cards', state.cards);
  state.deck.cur = null; render(); window.scrollTo({ top: 0 });
}
function afterRender() {
  const r = $('[data-reset-deck]');
  if (r) r.onclick = () => {
    for (const k of Object.keys(state.cards)) if (k.startsWith(state.deck.id + ':')) delete state.cards[k];
    store.set('cards', state.cards); state.deck.cur = null; render();
  };
}

// ---------- головний цикл ----------
const TITLES = { today: 'Сьогодні', schedule: 'Розклад', tasks: 'Завдання', learn: 'Вчити', progress: 'Прогрес' };
function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  $('#screen-title').innerHTML = (state.tab === 'today' ? mascot('happy', 'wiggle') : '') + TITLES[state.tab];
  const fn = { today: renderToday, schedule: renderSchedule, tasks: renderTasks, learn: renderLearn, progress: renderProgress }[state.tab];
  const out = fn();
  if (out instanceof Promise) out.then(h => { view.innerHTML = h; afterRender(); }); else { view.innerHTML = out; afterRender(); }
}

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  state.tab = b.dataset.tab; store.set('tab', state.tab); if (state.tab === 'schedule') state.week = 0;
  state.reading = null; state.deck = null;
  render(); window.scrollTo({ top: 0 });
});
view.addEventListener('click', e => {
  const cyc = e.target.closest('[data-cycle]');
  if (cyc) { e.stopPropagation(); const t = allTasks().find(x => x.id === cyc.dataset.cycle); setStatus(t.id, (t.st + 1) % 3); return; }
  const task = e.target.closest('[data-task]'); if (task) return taskSheet(task.dataset.task);
  const wk = e.target.closest('[data-week]'); if (wk) { const v = +wk.dataset.week; state.week = v === 0 ? 0 : state.week + v; return render(); }
  const f = e.target.closest('[data-filter]'); if (f) { state.filter = f.dataset.filter; store.set('filter', state.filter); return render(); }
  if (e.target.closest('[data-toggle-done]')) { state.showDone = !state.showDone; store.set('showDone', state.showDone); return render(); }
  if (e.target.closest('[data-add]')) return addSheet();
  const st = e.target.closest('[data-step]'); if (st) { toggleStep(st.dataset.step); return render(); }
  const ol = e.target.closest('[data-open-learn]'); if (ol) return openLearn(ol.dataset.openLearn);
  const lf = e.target.closest('[data-lfilter]'); if (lf) { state.learnFilter = lf.dataset.lfilter; store.set('learnFilter', state.learnFilter); return render(); }
  if (e.target.closest('[data-back]')) { state.reading = null; state.deck = null; render(); return window.scrollTo({ top: 0 }); }
  if (e.target.closest('[data-mark-read]')) { const id = e.target.closest('[data-mark-read]').dataset.markRead; state.read[id] = !state.read[id]; store.set('read', state.read); if (state.read[id]) toast('Прочитано 📖'); return render(); }
  if (e.target.closest('[data-reveal]')) { state.deck.shown = true; return render(); }
  const ans = e.target.closest('[data-answer]'); if (ans) return answerCard(ans.dataset.answer === 'yes');
  if (e.target.closest('[data-replan]')) { delete state.plans[iso(today())]; store.set('plans', state.plans); return render(); }
  if (e.target.closest('[data-budget]')) return budgetSheet();
});
$('#settings-btn').onclick = () => DATA && settingsSheet();

async function init() {
  applyTheme();
  try {
    const r = await fetch('data/data.json', { cache: 'no-cache' });
    DATA = await r.json();
    try { LEARN = await (await fetch('data/learn/index.json', { cache: 'no-cache' })).json(); } catch { LEARN = []; }
  } catch {
    view.innerHTML = cheer('Не вдалося завантажити дані. Перевір інтернет і онови сторінку.', 'sleepy');
    return;
  }
  render();
  checkReminders();
  setInterval(() => { checkReminders(); if (state.tab === 'today') render(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}
init();
