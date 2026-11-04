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
  const mouth = mood === 'sleepy'
    ? '<path d="M44 62 q6 4 12 0" stroke="#7a5a8c" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<path d="M43 60 q7 7 14 0" stroke="#7a5a8c" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  const eyes = mood === 'sleepy'
    ? '<path d="M34 50 q4 3 8 0M58 50 q4 3 8 0" stroke="#4a3f5c" stroke-width="2.5" fill="none" stroke-linecap="round"/>'
    : '<circle cx="38" cy="50" r="4.5" fill="#4a3f5c"/><circle cx="62" cy="50" r="4.5" fill="#4a3f5c"/><circle cx="39.5" cy="48.5" r="1.5" fill="#fff"/><circle cx="63.5" cy="48.5" r="1.5" fill="#fff"/>';
  return `<svg class="mascot ${cls}" viewBox="0 0 100 100" aria-hidden="true">
    <g fill="#fff" stroke="#e6d6f7" stroke-width="2">
      <circle cx="30" cy="40" r="16"/><circle cx="50" cy="30" r="18"/><circle cx="70" cy="40" r="16"/>
      <circle cx="24" cy="60" r="15"/><circle cx="76" cy="60" r="15"/><circle cx="50" cy="70" r="20"/>
    </g>
    <ellipse cx="50" cy="55" rx="27" ry="22" fill="#fff"/>
    <path d="M26 26 l4 -12 l8 9z M74 26 l-4 -12 l-8 9z" fill="#ffd3e6" stroke="#e6d6f7" stroke-width="2" stroke-linejoin="round"/>
    ${eyes}
    <ellipse cx="31" cy="60" rx="5" ry="3" fill="#ffc2da"/><ellipse cx="69" cy="60" rx="5" ry="3" fill="#ffc2da"/>
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
};
let DATA = null;

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
const allTasks = () => [...DATA.tasks, ...state.custom].map(t => ({ ...t, st: state.status[t.id] ?? (t.status || 0) }));
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
    <label>Статус</label>
    <div class="seg">${STATUS.map((n, i) => `<button data-set="${i}" class="${t.st === i ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div class="actions">
      ${isCustom ? '<button class="btn ghost" data-del>Видалити</button>' : ''}
      <button class="btn" data-close>Готово</button>
    </div>`);
  sheet.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { setStatus(id, +b.dataset.set); taskSheet(id); });
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

// ---------- головний цикл ----------
const TITLES = { today: 'Сьогодні', schedule: 'Розклад', tasks: 'Завдання', progress: 'Прогрес' };
function render() {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
  $('#screen-title').innerHTML = (state.tab === 'today' ? mascot('happy', 'wiggle') : '') + TITLES[state.tab];
  view.innerHTML = { today: renderToday, schedule: renderSchedule, tasks: renderTasks, progress: renderProgress }[state.tab]();
}

document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  state.tab = b.dataset.tab; store.set('tab', state.tab); if (state.tab === 'schedule') state.week = 0;
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
});
$('#settings-btn').onclick = () => DATA && settingsSheet();

async function init() {
  applyTheme();
  try {
    const r = await fetch('data/data.json', { cache: 'no-cache' });
    DATA = await r.json();
  } catch {
    view.innerHTML = cheer('Не вдалося завантажити дані. Перевір інтернет і онови сторінку.', 'sleepy');
    return;
  }
  render();
  checkReminders();
  setInterval(() => { checkReminders(); if (state.tab === 'today') render(); }, 60_000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkReminders(); } });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
}
init();
