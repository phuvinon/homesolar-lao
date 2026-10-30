/**
 * ຕາຕະລາງວຽກຕິດຕັ້ງ (ດອກໄຟ / ຮົ້ວ / ອື່ນໆ) · PHUSIRI TRADING – HOME SOLAR (BU02)
 * Backend: Google Sheets + Google Apps Script + Google Calendar + Google Drive (ຟຣີ ບໍ່ມີເຊີບເວີ)
 * ວິທີຕິດຕັ້ງ: ເບິ່ງ SETUP_GUIDE.md
 *
 * ສິດ 2 ລະດັບ:
 *  - ເຈົ້າຂອງ (ມີ PIN) = ເພີ່ມ/ແກ້/ລຶບວຽກ ເຫັນເງິນທັງໝົດ ຕັ້ງຄ່າ
 *  - ຊ່າງ (ບໍ່ມີ PIN, ຕ້ອງມີລິ້ງວຽກ) = ເບິ່ງວຽກນັ້ນ ປ່ຽນສະຖານະ ໃສ່ຮູບ ຂຽນບັນທຶກ ຕິກອຸປະກອນ
 *    ຊ່າງບໍ່ໄດ້ຮັບຕົວເລກເງິນໃດໆຈາກເຊີບເວີເລີຍ (ມູນຄ່າ/ມັດຈຳ/ຍອດຄ້າງ/ປະຫວັດເກັບເງິນ)
 */

const TZ = 'Asia/Vientiane';
const SH = { JOB: 'Jobs', TECH: 'Techs', LOG: 'Log', SET: 'Settings' };
const JOB_COLS = ['id', 'type', 'title', 'customer', 'phone', 'location', 'mapUrl', 'date', 'start', 'end',
  'techIds', 'status', 'equipment', 'price', 'deposit', 'collected', 'note',
  'photosBefore', 'photosAfter', 'calEventId', 'createdAt', 'updatedAt', 'shareKey',
  'points', 'instFee', 'techPay', 'labor', 'expenses', 'source', 'customerId', 'geo'];
// source = ລູກຄ້າມາຈາກທາງໃດ (ລາຍການໃນ Settings 'sources') · customerId = ລູກຄ້າໃນແທັບ Customers (ຈັບຄູ່ດ້ວຍເບີໂທ)
// expenses = [{id, cat, name, amount, date, by}] ລາຍຈ່າຍຂອງວຽກ (ເຈົ້າຂອງເທົ່ານັ້ນ) → ກຳໄລວຽກ = ມູນຄ່າວຽກ − ລາຍຈ່າຍ − ຄ່າແຮງຊ່າງ
// points = ຈຳນວນຈຸດຕິດຕັ້ງ · instFee = ຄ່າຕິດຕັ້ງເກັບລູກຄ້າ · labor = [{tid, full, half}] ວັນເຮັດວຽກຂອງຊ່າງແຕ່ລະຄົນ
// techPay = ຄ່າແຮງຊ່າງລວມ = Σ(full × dayRate + half × halfRate) — ຄິດຢູ່ເຊີບເວີຕອນບັນທຶກ
const STATUSES = ['pending', 'scheduled', 'progress', 'done', 'postponed', 'cancelled'];
const STATUS_LO = { pending: 'ລໍຖ້ານັດ', scheduled: 'ນັດແລ້ວ', progress: 'ກຳລັງເຮັດ', done: 'ສຳເລັດ', postponed: 'ເລື່ອນ', cancelled: 'ຍົກເລີກ' };
const DEFAULT_TYPES = ['💡 ຕິດຕັ້ງດອກໄຟ', '🧱 ຕິດຕັ້ງຮົ້ວ', '🔍 ສຳຫຼວດໜ້າງານ', '🔧 ສ້ອມແປງ/ຮັບປະກັນ', '📦 ສົ່ງເຄື່ອງ', '📌 ອື່ນໆ'];

/* ========== API ສຳລັບໜ້າຈໍທີ່ຢູ່ GitHub Pages ==========
   ເຫດຜົນ: ມືຖືທີ່ລັອກອິນ Google ຫຼາຍບັນຊີ ເປີດລິ້ງ /exec ໂດຍກົງບໍ່ໄດ້ (Google error ໜ້າຂາວ)
   ໜ້າຈໍຈິງຢູ່ PUBLIC_APP_URL ແລ້ວສົ່ງ POST {fn, args} ມາທີ່ນີ້ */
const PUBLIC_APP_URL = 'https://phuvinon.github.io/homesolar-lao/jobs/';
const READ_FNS = { api_getAll: 1, api_checkPin: 1, api_getProducts: 1, api_getCRM: 1 };
function doPost(e) {
  const API = {
    api_getAll: api_getAll, api_checkPin: api_checkPin, api_saveJob: api_saveJob, api_deleteJob: api_deleteJob,
    api_shareLink: api_shareLink, api_setStatus: api_setStatus, api_addNote: api_addNote, api_toggleEquip: api_toggleEquip,
    api_recordPay: api_recordPay, api_uploadPhoto: api_uploadPhoto, api_delPhoto: api_delPhoto, api_saveSettings: api_saveSettings,
    api_saveNote: api_saveNote, api_setNoteStatus: api_setNoteStatus, api_snoozeNote: api_snoozeNote, api_deleteNote: api_deleteNote,
    api_syncProducts: api_syncProducts, api_saveSupplier: api_saveSupplier, api_savePO: api_savePO, api_payPO: api_payPO,
    api_setPOStatus: api_setPOStatus, api_deletePO: api_deletePO, api_uploadPOFile: api_uploadPOFile, api_delPOFile: api_delPOFile,
    api_issueReceipt: api_issueReceipt, api_issueFenceDoc: api_issueFenceDoc, api_addExpense: api_addExpense, api_delExpense: api_delExpense, api_getProducts: api_getProducts,
    api_getCRM: api_getCRM, api_saveCustomer: api_saveCustomer, api_syncSales: api_syncSales
  };
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (!API[req.fn]) throw new Error('unknown fn');
    if (!READ_FNS[req.fn]) bumpCache(); // ຄຳສັ່ງຂຽນ → ລ້າງແຄຊ (ກ່ອນ ແລະ ຫຼັງ ເພື່ອກັນຄຳຂໍທີ່ອ່ານພ້ອມກັນ)
    out = { result: API[req.fn].apply(null, Array.isArray(req.args) ? req.args : []) };
    if (!READ_FNS[req.fn]) bumpCache();
  } catch (err) { out = { error: (err && err.message) || String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/* ========== ໜ້າເວັບ ========== */
// ໜ້າຈໍອ່ານຈາກໄຟລ໌ Index.html ໃນ Google Drive (11_PROJECTS/PRJ_JOB_SCHEDULE) — ແກ້ໄຟລ໌ນັ້ນແລ້ວແອບອັບເດດເອງ ບໍ່ຕ້ອງ Deploy ໃໝ່
// ຖ້າອ່ານບໍ່ໄດ້ (ໄຟລ໌ຖືກຍ້າຍ/ລຶບ) ຈະໃຊ້ໄຟລ໌ Index ໃນໂປຣເຈັກແທນ
const INDEX_FILE_ID = '1neBhzdveb2E_AGSQDmqTcibAElXwVXoZ';
function doGet() {
  let out;
  try { out = HtmlService.createHtmlOutput(DriveApp.getFileById(INDEX_FILE_ID).getBlob().getDataAsString('UTF-8')); }
  catch (e) { out = HtmlService.createHtmlOutputFromFile('Index'); }
  return out
    .setTitle('ຕາຕະລາງວຽກ · HOME SOLAR')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/* ========== ຕິດຕັ້ງຄັ້ງທຳອິດ — ກົດ Run ຟັງຊັນນີ້ 1 ຄັ້ງ ========== */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const mk = (name, headers) => {
    let s = ss.getSheetByName(name);
    if (!s) { s = ss.insertSheet(name); s.appendRow(headers); s.setFrozenRows(1); }
    return s;
  };
  const job = mk(SH.JOB, JOB_COLS);
  const tech = mk(SH.TECH, ['id', 'name', 'phone', 'email', 'active']);
  mk(SH.LOG, ['time', 'jobId', 'who', 'action', 'detail']);
  const set = mk(SH.SET, ['key', 'value']);
  // ກັນ Sheets ປ່ຽນເບີໂທ 020... / ວັນທີ / ເວລາ ເປັນ format ອື່ນ
  job.getRange(1, 1, job.getMaxRows(), JOB_COLS.length).setNumberFormat('@');
  tech.getRange(1, 1, tech.getMaxRows(), 5).setNumberFormat('@');

  const st = settingsObj();
  const upsert = (k, v) => { if (st[k] === undefined || st[k] === '') set.appendRow([k, v]); };
  upsert('pin', '1234');
  upsert('types', DEFAULT_TYPES.join('\n'));
  upsert('reminders', '1440,60');
  if (!st.calendarId) {
    const cal = CalendarApp.createCalendar('ວຽກຕິດຕັ້ງ HOME SOLAR', { timeZone: TZ, color: CalendarApp.Color.YELLOW });
    set.appendRow(['calendarId', cal.getId()]);
  }
  if (!st.photoFolderId) {
    const f = DriveApp.createFolder('HOME_SOLAR_JOB_PHOTOS');
    set.appendRow(['photoFolderId', f.getId()]);
  }
  if (tech.getLastRow() < 2) {
    [['t1', 'ຊ່າງ A (ຕົວຢ່າງ)', '', '', 'TRUE'],
     ['t2', 'ຊ່າງ B (ຕົວຢ່າງ)', '', '', 'TRUE']].forEach(r => tech.appendRow(r));
  }
}

/* ========== helpers ========== */
function sheet(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function fmtD(v) { if (v === '' || v == null) return ''; return v instanceof Date ? Utilities.formatDate(v, TZ, 'yyyy-MM-dd') : String(v); }
function fmtT(v) { if (v === '' || v == null) return ''; return v instanceof Date ? Utilities.formatDate(v, TZ, 'HH:mm') : String(v); }
function nowFull() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function parseArr(v) { if (!v) return []; try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
function money(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }

// ແຄຊຂໍ້ມູນພາຍໃນ 1 ຄຳຂໍ (ລ້າງເອງທຸກຄຳຂໍໃໝ່) — ບໍ່ໃຫ້ອ່ານ Sheet ດຽວກັນຊ້ຳຫຼາຍເທື່ອ
const _memo = {};
function memo(k, fn) { return Object.prototype.hasOwnProperty.call(_memo, k) ? _memo[k] : (_memo[k] = fn()); }
function forget(k) { delete _memo[k]; }
let _wrote = false; // ຄຳຂໍນີ້ມີການຂຽນ → ຫ້າມໃຊ້ແຄຊ getAll
const _newLogs = []; // ປະຫວັດທີ່ຂຽນໃນຄຳຂໍນີ້ (ສົ່ງໄປກັບ jobDelta)

function settingsObj() {
  return memo('settings', () => {
    const o = {};
    const s = sheet(SH.SET);
    if (!s) return o;
    s.getDataRange().getValues().slice(1).forEach(r => { if (r[0] !== '') o[r[0]] = r[1]; });
    if (o.pin !== undefined) o.pin = String(o.pin);
    return o;
  });
}
function typesList(st) {
  const t = String(st.types || '').split('\n').map(x => x.trim()).filter(Boolean);
  return t.length ? t : DEFAULT_TYPES;
}
function remindersList(st) {
  return String(st.reminders || '').split(',').map(Number).filter(n => n > 0 && n <= 40320);
}
function isOwner(ctx) { return !!(ctx && ctx.pin) && String(ctx.pin) === settingsObj().pin; }
function needOwner(ctx) { if (!isOwner(ctx)) throw new Error('ຕ້ອງເປັນເຈົ້າຂອງ (PIN) ຈຶ່ງເຮັດໄດ້'); }
function whoOf(ctx) { return String((ctx && ctx.who) || '?').slice(0, 40); }
// ຊ່າງເຂົ້າເຖິງວຽກໄດ້ສະເພາະເມື່ອມີລິ້ງ (shareKey) ຂອງວຽກນັ້ນ
function canAccess(ctx, j) { return isOwner(ctx) || !!(ctx && ctx.key && j.shareKey && String(ctx.key) === j.shareKey); }
function needAccess(ctx, j) { if (!canAccess(ctx, j)) throw new Error('ລິ້ງນີ້ໃຊ້ບໍ່ໄດ້ແລ້ວ — ກະລຸນາຂໍລິ້ງໃໝ່ຈາກເຈົ້າຂອງ'); }
function newKey() { return Utilities.getUuid().replace(/-/g, '').slice(0, 20); }
function withLock(fn) {
  _wrote = true;
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function log(jobId, who, action, detail) {
  const t = nowFull();
  sheet(SH.LOG).appendRow([t, jobId, who, action, detail || '']);
  _newLogs.push({ id: String(jobId), time: t, who: String(who), action: String(action), detail: String(detail || '') });
  bumpCache(); // ກໍລະນີເອີ້ນຜ່ານລິ້ງ /exec ເກົ່າ (google.script.run ບໍ່ຜ່ານ doPost)
}

/* ---------- Jobs: ອ່ານ/ຂຽນ ---------- */
function readJobs() {
  return memo('jobs', () => {
    const v = sheet(SH.JOB).getDataRange().getValues();
    const out = [];
    for (let i = 1; i < v.length; i++) {
      if (!v[i][0]) continue;
      const o = { _row: i + 1 };
      JOB_COLS.forEach((c, k) => { o[c] = v[i][k]; });
      out.push(normJob(o));
    }
    return out;
  });
}
function normJob(o) {
  ['id', 'type', 'title', 'customer', 'phone', 'location', 'mapUrl', 'status', 'note', 'calEventId', 'createdAt', 'updatedAt', 'shareKey']
    .forEach(k => { o[k] = o[k] == null ? '' : String(o[k]); });
  o.date = fmtD(o.date); o.start = fmtT(o.start); o.end = fmtT(o.end);
  ['price', 'deposit', 'collected', 'points', 'instFee', 'techPay'].forEach(k => { o[k] = Number(o[k]) || 0; });
  ['equipment', 'photosBefore', 'photosAfter', 'labor', 'expenses'].forEach(k => { o[k] = Array.isArray(o[k]) ? o[k] : parseArr(o[k]); });
  o.techIds = Array.isArray(o.techIds) ? o.techIds : String(o.techIds || '').split(',').filter(Boolean);
  if (STATUSES.indexOf(o.status) < 0) o.status = o.date ? 'scheduled' : 'pending';
  return o;
}
function findJob(id) {
  const j = readJobs().filter(x => x.id === String(id))[0];
  if (!j) throw new Error('ບໍ່ພົບວຽກນີ້ (ອາດຖືກລຶບແລ້ວ)');
  return j;
}
function writeJob(o) {
  const s = sheet(SH.JOB);
  const isNewRow = !o._row, row = o._row || s.getLastRow() + 1;
  const vals = JOB_COLS.map(c => {
    const v = o[c];
    if (c === 'techIds') return (v || []).join(',');
    if (Array.isArray(v)) return JSON.stringify(v);
    return v == null ? '' : String(v);
  });
  if (s.getRange(1, JOB_COLS.length).getValue() !== JOB_COLS[JOB_COLS.length - 1]) {
    s.getRange(1, 1, 1, JOB_COLS.length).setValues([JOB_COLS]); // ເພີ່ມຫົວຖັນໃໝ່ໃຫ້ Sheet ເກົ່າ
  }
  const r = s.getRange(row, 1, 1, JOB_COLS.length);
  r.setNumberFormat('@');
  r.setValues([vals]);
  o._row = row;
  if (isNewRow && _memo.jobs && _memo.jobs.indexOf(o) < 0) _memo.jobs.push(o); // ໃຫ້ແຄຊເຫັນວຽກໃໝ່
}

/* ---------- Google Calendar: ສ້າງ/ອັບເດດ event ຂອງວຽກ ---------- */
function syncCal(job, techs) {
  const st = settingsObj();
  if (!st.calendarId) return job.calEventId || '';
  const cal = CalendarApp.getCalendarById(st.calendarId);
  if (!cal) return job.calEventId || '';
  let ev = null;
  if (job.calEventId) { try { ev = cal.getEventById(job.calEventId); } catch (e) { ev = null; } }

  // ບໍ່ມີວັນນັດ ຫຼື ຍົກເລີກ → ລຶບ event ອອກຈາກປະຕິທິນ
  if (!job.date || job.status === 'cancelled') { if (ev) ev.deleteEvent(); return ''; }

  const start = Utilities.parseDate(job.date + ' ' + (job.start || '08:00'), TZ, 'yyyy-MM-dd HH:mm');
  let end = job.end ? Utilities.parseDate(job.date + ' ' + job.end, TZ, 'yyyy-MM-dd HH:mm') : null;
  if (!end || end <= start) end = new Date(start.getTime() + 2 * 3600 * 1000);

  const names = job.techIds.map(id => (techs.filter(t => t.id === id)[0] || {}).name).filter(Boolean);
  const prefix = job.status === 'done' ? '✅ ' : job.status === 'postponed' ? '⏸ ' : '';
  const title = prefix + job.type + ' · ' + job.customer + (job.title ? ' — ' + job.title : '');
  const desc = [
    '👤 ' + job.customer + (job.phone ? '  📞 ' + job.phone : ''),
    '👷 ' + (names.join(', ') || '-'),
    '📌 ສະຖານະ: ' + (STATUS_LO[job.status] || job.status),
    job.mapUrl ? '🗺️ ' + job.mapUrl : '',
    job.equipment.length ? '🔧 ອຸປະກອນ:\n' + job.equipment.map(e => '  • ' + e.t + (e.qty ? ' × ' + e.qty : '')).join('\n') : '',
    job.note ? '📝 ' + job.note : '',
    '',
    '🔗 ເປີດວຽກໃນແອບ: ' + PUBLIC_APP_URL + '?job=' + job.id + (job.shareKey ? '&k=' + job.shareKey : '')
  ].filter(x => x !== '').join('\n');
  const loc = job.location || '';
  const guests = job.techIds.map(id => (techs.filter(t => t.id === id)[0] || {}).email).filter(e => e && e.indexOf('@') > 0);

  if (!ev) {
    ev = cal.createEvent(title, start, end, { description: desc, location: loc, guests: guests.join(','), sendInvites: true });
  } else {
    ev.setTitle(title); ev.setTime(start, end); ev.setDescription(desc); ev.setLocation(loc);
    const have = ev.getGuestList().map(g => g.getEmail().toLowerCase());
    guests.forEach(g => { if (have.indexOf(g.toLowerCase()) < 0) ev.addGuest(g); });
    have.forEach(g => { if (guests.map(x => x.toLowerCase()).indexOf(g) < 0) ev.removeGuest(g); });
  }
  ev.removeAllReminders();
  remindersList(st).forEach(m => ev.addPopupReminder(m));
  const colors = [CalendarApp.EventColor.YELLOW, CalendarApp.EventColor.CYAN, CalendarApp.EventColor.MAUVE,
    CalendarApp.EventColor.RED, CalendarApp.EventColor.GREEN, CalendarApp.EventColor.GRAY];
  const ti = typesList(st).indexOf(job.type);
  ev.setColor(job.status === 'done' ? CalendarApp.EventColor.PALE_GREEN : colors[(ti < 0 ? 5 : ti) % colors.length]);
  return ev.getId();
}
function syncCalSafe(job) {
  try { job.calEventId = syncCal(job, readTechs(true)); return ''; }
  catch (e) { return 'ບັນທຶກແລ້ວ ແຕ່ອັບເດດປະຕິທິນບໍ່ສຳເລັດ: ' + e.message; }
}

function readTechs(all) {
  return memo('techs' + (all ? 1 : 0), () => sheet(SH.TECH).getDataRange().getValues().slice(1)
    .filter(r => r[0] && (all || String(r[4]).toUpperCase() !== 'FALSE'))
    .map(r => ({ id: String(r[0]), name: String(r[1]), phone: String(r[2] || ''), email: String(r[3] || ''),
      active: String(r[4]).toUpperCase() !== 'FALSE' })));
}

/* ========== ດຶງຂໍ້ມູນທັງໝົດ ========== */
/* ສຳເນົາວຽກສຳລັບສົ່ງອອກ — ຊ່າງບໍ່ເຫັນຕົວເລກເງິນໃດໆເລີຍ (ເຈົ້າຂອງສັ່ງ 2026-10-05) */
function viewJob(j0, owner) {
  const j = Object.assign({}, j0); delete j._row; // ສຳເນົາ — ບໍ່ແຕະຕ້ອງແຄຊ
  j.due = j.status === 'cancelled' ? 0 : Math.max(0, j.price - j.deposit - j.collected);
  if (!owner) { delete j.price; delete j.deposit; delete j.collected; delete j.due; delete j.shareKey; delete j.calEventId; delete j.instFee; delete j.techPay; delete j.labor; delete j.expenses; }
  return j;
}
/* ⚡ ຄຳຕອບແບບສັ້ນຫຼັງບັນທຶກ (v12): ສົ່ງຄືນສະເພາະວຽກທີ່ປ່ຽນ + ປະຫວັດທີ່ຫາກໍຂຽນ — ບໍ່ອ່ານທຸກແທັບຄືນໃໝ່
   ໜ້າຈໍເອົາໄປລວມກັບຂໍ້ມູນທີ່ມີຢູ່ (mergeDelta ໃນ Index.html) */
function jobDelta(ctx, ids, extra) {
  const owner = isOwner(ctx);
  const jobs = readJobs().filter(j => ids.indexOf(j.id) >= 0 && (owner || (ctx && String(ctx.jobId) === j.id && canAccess(ctx, j)))).map(j => viewJob(j, owner));
  const logs = _newLogs.filter(l => ids.indexOf(l.id) >= 0 && (owner || (l.action !== 'pay' && l.action !== 'receipt')));
  return JSON.stringify(Object.assign({ delta: true, jobs: jobs, logs: logs, removed: [] }, extra || {}));
}
/* ⚡ ແຄຊ getAll (v12): ເກັບຜົນໄວ້ໃນ CacheService 5 ນາທີ · ທຸກຄຳສັ່ງຂຽນ → bumpCache() ລ້າງທັງໝົດ
   key ອີງຕາມ ctx (pin/jobId/key) → ຄົນທີ່ PIN ຜິດບໍ່ມີທາງໄດ້ຂໍ້ມູນຂອງເຈົ້າຂອງ */
const CACHE_TTL = 300, CACHE_CHUNK = 25000;
function cacheVer() {
  const c = CacheService.getScriptCache(); let v = c.get('ga_ver');
  if (!v) { v = String(Date.now()); c.put('ga_ver', v, 21600); }
  return v;
}
function bumpCache() { try { CacheService.getScriptCache().put('ga_ver', String(Date.now()), 21600); } catch (e) { } }
function cacheKey(ctx) {
  const raw = JSON.stringify([ctx && ctx.pin || '', ctx && ctx.jobId || '', ctx && ctx.key || '']);
  return 'ga_' + cacheVer() + '_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw));
}
function cacheGet(k) {
  const c = CacheService.getScriptCache(), n = Number(c.get(k + '_n'));
  if (!n) return null;
  const keys = []; for (let i = 0; i < n; i++) keys.push(k + '_' + i);
  const parts = c.getAll(keys); let s = '';
  for (let i = 0; i < n; i++) { if (parts[keys[i]] == null) return null; s += parts[keys[i]]; }
  return s;
}
function cachePut(k, s) {
  try {
    const o = {}, n = Math.ceil(s.length / CACHE_CHUNK);
    if (n > 30) return; // ໃຫຍ່ເກີນ — ບໍ່ແຄຊ
    for (let i = 0; i < n; i++) o[k + '_' + i] = s.slice(i * CACHE_CHUNK, (i + 1) * CACHE_CHUNK);
    o[k + '_n'] = String(n);
    CacheService.getScriptCache().putAll(o, CACHE_TTL);
  } catch (e) { }
}
/* ສິນຄ້າ Pancake ໂຫຼດແຍກ (v12) — ໜ້າຈໍຂໍຢູ່ເບື້ອງຫຼັງຫຼັງເປີດແອບ */
function api_getProducts(ctx) {
  needOwner(ctx);
  return JSON.stringify({ products: readProducts().map(o => { delete o._row; return o; }) });
}

function api_getAll(ctx, warn, opts) {
  const useCache = !_wrote && !warn && !opts;
  const ck = useCache ? cacheKey(ctx) : '';
  if (useCache && !(ctx && ctx.fresh)) { const hit = cacheGet(ck); if (hit) return hit; } // ⟳ ກົດເອງ = fresh (ອ່ານໃໝ່)
  const owner = isOwner(ctx);
  const st = settingsObj();
  // ຊ່າງ: ໄດ້ສະເພາະວຽກໃນລິ້ງ (jobId + key ຕ້ອງກົງ) — ບໍ່ມີລິ້ງ = ບໍ່ໄດ້ຫຍັງເລີຍ
  const jobs = readJobs()
    .filter(j => owner || (ctx && ctx.jobId && String(ctx.jobId) === j.id && canAccess(ctx, j)))
    .map(j => viewJob(j, owner));
  const notes = owner ? readNotes().map(n => { delete n._row; return n; }) : [];
  const strip = o => { delete o._row; return o; };
  const pos = owner ? readPOs().map(strip) : [];
  const rcs = owner ? readReceipts() : [];
  const fds = owner ? readFenceDocs() : [];
  const ids = {}; jobs.forEach(j => { ids[j.id] = 1; }); notes.forEach(n => { ids[n.id] = 1; }); pos.forEach(p => { ids[p.id] = 1; });
  const logs = {};
  // ອ່ານແຕ່ 1500 ແຖວລ່າສຸດຂອງ Log (ບໍ່ອ່ານທັງແທັບ)
  const ls = sheet(SH.LOG), lr = ls.getLastRow(), ln = Math.min(1500, lr - 1);
  const lv = [[]].concat(ln > 0 ? ls.getRange(lr - ln + 1, 1, ln, 5).getValues() : []);
  for (let i = 1; i < lv.length; i++) {
    const id = String(lv[i][1]); if (!id || !ids[id]) continue;
    if (!owner && (String(lv[i][3]) === 'pay' || String(lv[i][3]) === 'receipt')) continue; // ຊ່າງບໍ່ເຫັນເງິນ
    (logs[id] = logs[id] || []).push({ time: String(lv[i][0] instanceof Date ? Utilities.formatDate(lv[i][0], TZ, 'yyyy-MM-dd HH:mm') : lv[i][0]),
      who: String(lv[i][2]), action: String(lv[i][3]), detail: String(lv[i][4]) });
  }
  const assigned = {}; jobs.forEach(j => j.techIds.forEach(t => { assigned[t] = 1; }));
  const techs = readTechs(owner).filter(t => owner || assigned[t.id]).map(t => owner ? t : { id: t.id, name: t.name });
  const out = {
    owner: owner, jobs: jobs, notes: notes, techs: techs, types: typesList(st), sources: owner ? sourcesList(st) : [], logs: logs,
    pos: pos, suppliers: owner ? readSuppliers().map(strip) : [],
    receipts: rcs, nextInvoice: owner ? nextInvoiceNo(rcs) : 0, fenceDocs: fds,
    // ອັດຕາ: ຄ່າຕິດຕັ້ງຕໍ່ຈຸດ (ເກັບລູກຄ້າ) · ຄ່າແຮງຊ່າງ ເຕັມວັນ/ເຄິ່ງວັນ (ເຈົ້າຂອງບອກ 2026-10-12: 350,000 / 150,000)
    instRate: owner ? (st.instRate === undefined || st.instRate === '' ? 250000 : Number(st.instRate) || 0) : 0,
    dayRate: owner ? (Number(st.dayRate) || 350000) : 0, halfRate: owner ? (Number(st.halfRate) || 150000) : 0,
    reminders: remindersList(st), calendarId: owner ? (st.calendarId || '') : '',
    appUrl: owner ? PUBLIC_APP_URL : '', warn: warn || '',
    calPending: owner ? parseArr(PropertiesService.getScriptProperties().getProperty('CAL_QUEUE')).length : 0
  };
  if (owner && opts && opts.products) out.products = readProducts().map(strip); // ສະເພາະຕອນສິນຄ້າປ່ຽນ (ດຶງ Pancake / ຮັບເຄື່ອງ)
  const s = JSON.stringify(out);
  if (useCache) cachePut(ck, s);
  return s;
}
function api_checkPin(ctx, pin) { return String(pin) === settingsObj().pin; }

/* ========== ເຈົ້າຂອງ: ເພີ່ມ / ແກ້ / ລຶບວຽກ ========== */
function api_saveJob(ctx, data) {
  needOwner(ctx);
  return withLock(() => {
    const isNew = !data.id;
    const j = isNew ? normJob({ id: 'J' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      createdAt: nowFull(), photosBefore: [], photosAfter: [], calEventId: '' }) : findJob(data.id);
    const oldDep = j.deposit || 0, oldCol = j.collected || 0; // ສຳລັບ payLog (ເງິນທີ່ພິມໃນຟອມ)
    ['type', 'title', 'customer', 'phone', 'location', 'mapUrl', 'date', 'start', 'end', 'status', 'note', 'source', 'geo']
      .forEach(k => { if (data[k] !== undefined) j[k] = String(data[k]).trim(); });
    ['price', 'deposit', 'collected', 'points', 'instFee'].forEach(k => { if (data[k] !== undefined) j[k] = Math.max(0, Number(data[k]) || 0); });
    if (Array.isArray(data.labor)) {
      const st = settingsObj(), dr = Number(st.dayRate) || 350000, hr = Number(st.halfRate) || 150000;
      j.labor = data.labor.map(l => ({ tid: String(l.tid), full: Math.max(0, Number(l.full) || 0), half: Math.max(0, Number(l.half) || 0) }))
        .filter(l => l.tid && (l.full || l.half));
      j.techPay = j.labor.reduce((a, l) => a + l.full * dr + l.half * hr, 0); // ອັດຕາຂະນະບັນທຶກ (ປ່ຽນອັດຕາພາຍຫຼັງ ບໍ່ກະທົບວຽກເກົ່າ)
    }
    if (Array.isArray(data.techIds)) j.techIds = data.techIds.map(String);
    if (Array.isArray(data.equipment)) j.equipment = data.equipment.map(e => {
      const o = { t: String(e.t).trim(), done: !!e.done }; // vid = ສິນຄ້າ Pancake, qty = ຈຳນວນ (ລາຍການພິມເອງບໍ່ມີ)
      if (e.vid) o.vid = String(e.vid); if (Number(e.qty) > 0) o.qty = Math.round(Number(e.qty));
      return o;
    }).filter(e => e.t);
    if (!j.customer) throw new Error('ກະລຸນາໃສ່ຊື່ລູກຄ້າ');
    if (j.status === 'pending' && j.date) j.status = 'scheduled';
    if (!j.shareKey) j.shareKey = newKey();
    j.updatedAt = nowFull();
    if (j.phone) j.customerId = linkCustomer(j.customer, j.phone, j.location, j.source, j.geo);
    writeJob(j);
    const warn = queueCal('job', j.id);
    log(j.id, whoOf(ctx), isNew ? 'create' : 'edit', isNew ? 'ສ້າງວຽກໃໝ່' : 'ແກ້ໄຂຂໍ້ມູນວຽກ');
    payLog(ctx, { kind: 'in', src: 'jobform', ref: j.id, amount: (j.deposit - oldDep) + (j.collected - oldCol), party: j.customer, note: 'ແກ້ມັດຈຳ/ເກັບແລ້ວ ໃນຟອມວຽກ', fence: isFenceJob(j) });
    if (data.fromNote) linkNoteToJob(data.fromNote, j.id, ctx);
    if (data.fromQuote) linkFenceDocToJob(data.fromQuote, j.id, ctx);
    return (data.fromNote || data.fromQuote) ? api_getAll(ctx, warn) : jobDelta(ctx, [j.id], { warn: warn || '' });
  });
}

function api_deleteJob(ctx, id) {
  needOwner(ctx);
  return withLock(() => {
    const j = findJob(id);
    if (j.calEventId) queueCal('del', '', j.calEventId);
    sheet(SH.JOB).deleteRow(j._row); forget('jobs');
    log(j.id, whoOf(ctx), 'delete', 'ລຶບວຽກ: ' + j.type + ' · ' + j.customer);
    return jobDelta(ctx, [], { removed: [j.id] });
  });
}

/* ສ້າງ/ປ່ຽນລິ້ງແຊວຽກ — reset = true → ລິ້ງເກົ່າໃຊ້ບໍ່ໄດ້ທັນທີ */
function api_shareLink(ctx, id, reset) {
  needOwner(ctx);
  return withLock(() => {
    const j = findJob(id);
    if (!j.shareKey || reset) {
      j.shareKey = newKey(); j.updatedAt = nowFull();
      writeJob(j); queueCal('job', j.id);
      if (reset) log(j.id, whoOf(ctx), 'share', 'ປ່ຽນລິ້ງແຊໃໝ່ (ລິ້ງເກົ່າໃຊ້ບໍ່ໄດ້)');
    }
    return jobDelta(ctx, [id]);
  });
}

/* ========== ທຸກຄົນ (ຊ່າງຕ້ອງມີລິ້ງຂອງວຽກນັ້ນ) ========== */
function api_setStatus(ctx, id, status) {
  if (STATUSES.indexOf(status) < 0) throw new Error('ສະຖານະບໍ່ຖືກຕ້ອງ');
  if (status === 'cancelled') needOwner(ctx);
  return withLock(() => {
    const j = findJob(id); needAccess(ctx, j);
    const old = j.status;
    j.status = status; j.updatedAt = nowFull();
    writeJob(j);
    const warn = queueCal('job', j.id);
    log(j.id, whoOf(ctx), 'status', (STATUS_LO[old] || old) + ' → ' + (STATUS_LO[status] || status));
    return jobDelta(ctx, [id], { warn: warn || '' });
  });
}

function api_addNote(ctx, id, text) {
  text = String(text || '').trim().slice(0, 1000);
  if (!text) throw new Error('ຂຽນບັນທຶກກ່ອນ');
  return withLock(() => {
    if (String(id).charAt(0) === 'N') { needOwner(ctx); findNote(id); } // ບັນທຶກໃນໂນດ = ເຈົ້າຂອງເທົ່ານັ້ນ
    else needAccess(ctx, findJob(id));
    log(String(id), whoOf(ctx), 'note', text);
    return jobDelta(ctx, [id]);
  });
}

function api_toggleEquip(ctx, id, idx, done) {
  return withLock(() => {
    const j = findJob(id); needAccess(ctx, j);
    if (!j.equipment[idx]) throw new Error('ບໍ່ພົບລາຍການອຸປະກອນ');
    j.equipment[idx].done = !!done; j.updatedAt = nowFull();
    writeJob(j);
    log(j.id, whoOf(ctx), 'equip', (done ? '☑ ' : '☐ ') + j.equipment[idx].t + (j.equipment[idx].qty ? ' × ' + j.equipment[idx].qty : ''));
    return jobDelta(ctx, [id]);
  });
}

/* ບັນທຶກເງິນທີ່ເກັບໄດ້ (ເຈົ້າຂອງເທົ່ານັ້ນ) */
function api_recordPay(ctx, id, amount) {
  needOwner(ctx);
  amount = Math.round(Number(amount) || 0);
  if (amount <= 0) throw new Error('ໃສ່ຈຳນວນເງິນໃຫ້ຖືກ');
  return withLock(() => {
    const j = findJob(id);
    j.collected += amount; j.updatedAt = nowFull();
    writeJob(j); // ປະຕິທິນບໍ່ມີຂໍ້ມູນເງິນແລ້ວ — ບໍ່ຕ້ອງອັບເດດ
    log(j.id, whoOf(ctx), 'pay', 'ເກັບເງິນໄດ້ ' + money(amount) + ' ກີບ');
    payLog(ctx, { kind: 'in', src: 'job', ref: j.id, amount: amount, party: j.customer, note: j.type, fence: isFenceJob(j) });
    return jobDelta(ctx, [id]);
  });
}

/* ຮູບ: kind = 'before' | 'after' · dataUrl = 'data:image/jpeg;base64,...' (ຫຍໍ້ຂະໜາດໃນມືຖືແລ້ວ) */
function api_uploadPhoto(ctx, id, kind, dataUrl) {
  if (kind !== 'before' && kind !== 'after') throw new Error('kind ຜິດ');
  const m = String(dataUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/);
  if (!m) throw new Error('ໄຟລ໌ຮູບບໍ່ຖືກຕ້ອງ');
  needAccess(ctx, findJob(id)); // ກວດກ່ອນບັນທຶກຮູບລົງ Drive
  const st = settingsObj();
  const folder = DriveApp.getFolderById(st.photoFolderId);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1],
    id + '_' + kind + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '.jpg');
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return withLock(() => {
    const j = findJob(id);
    const key = kind === 'before' ? 'photosBefore' : 'photosAfter';
    j[key].push(file.getId()); j.updatedAt = nowFull();
    writeJob(j);
    log(j.id, whoOf(ctx), 'photo', 'ໃສ່ຮູບ' + (kind === 'before' ? 'ກ່ອນ' : 'ຫຼັງ') + 'ຕິດຕັ້ງ');
    return jobDelta(ctx, [id]);
  });
}

function api_delPhoto(ctx, id, kind, fileId) {
  needOwner(ctx);
  return withLock(() => {
    const j = findJob(id);
    const key = kind === 'before' ? 'photosBefore' : 'photosAfter';
    j[key] = j[key].filter(x => x !== fileId);
    writeJob(j);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { }
    log(j.id, whoOf(ctx), 'photo', 'ລຶບຮູບ 1 ຮູບ');
    return jobDelta(ctx, [id]);
  });
}

/* ========== ເຈົ້າຂອງ: ຕັ້ງຄ່າ ========== */
function api_saveSettings(ctx, obj) {
  needOwner(ctx);
  return withLock(() => {
    const s = sheet(SH.SET), vals = s.getDataRange().getValues();
    const upsert = (key, val) => {
      for (let i = 1; i < vals.length; i++) {
        if (String(vals[i][0]) === key) { s.getRange(i + 1, 2).setValue(val); return; }
      }
      s.appendRow([key, val]);
    };
    if (Array.isArray(obj.types) && obj.types.length) upsert('types', obj.types.map(String).join('\n'));
    if (Array.isArray(obj.reminders)) upsert('reminders', obj.reminders.map(Number).filter(n => n > 0).join(','));
    ['instRate', 'dayRate', 'halfRate'].forEach(k => { if (obj[k] !== undefined) upsert(k, Math.max(0, Number(obj[k]) || 0)); });
    if (Array.isArray(obj.sources) && obj.sources.length) upsert('sources', obj.sources.map(s => String(s).trim()).filter(Boolean).join('\n'));
    if (obj.newPin) {
      if (!/^\d{4,8}$/.test(String(obj.newPin))) throw new Error('PIN ຕ້ອງເປັນຕົວເລກ 4-8 ໂຕ');
      upsert('pin', "'" + String(obj.newPin));
    }
    if (Array.isArray(obj.techs)) {
      const t = sheet(SH.TECH);
      if (t.getLastRow() > 1) t.getRange(2, 1, t.getLastRow() - 1, 5).clearContent();
      const rows = obj.techs.filter(x => String(x.name || '').trim())
        .map(x => [x.id || ('t' + Date.now() + Math.floor(Math.random() * 1000)), String(x.name).trim(),
          String(x.phone || '').trim(), String(x.email || '').trim(), x.active === false ? 'FALSE' : 'TRUE']);
      if (rows.length) {
        const r = t.getRange(2, 1, rows.length, 5);
        r.setNumberFormat('@'); r.setValues(rows);
      }
    }
    forget('settings'); forget('techs0'); forget('techs1'); // ຕັ້ງຄ່າປ່ຽນ → ອ່ານໃໝ່
    return api_getAll({ pin: obj.newPin || ctx.pin, who: ctx.who });
  });
}

/* ========== ໂນດ (ເຈົ້າຂອງເທົ່ານັ້ນ): ຕິດຕາມລູກຄ້າ / ລໍຖ້າຕິດຕັ້ງ / ສຳຄັນ / ອື່ນໆ ==========
   ແທັບ Notes ສ້າງເອງອັດຕະໂນມັດຄັ້ງທຳອິດທີ່ໃຊ້ · ມີວັນເຕືອນ → ລົງ Google Calendar (ບໍ່ເຊີນຊ່າງ) */
const NOTE_COLS = ['id', 'cat', 'title', 'customer', 'phone', 'detail', 'value', 'remindDate', 'remindTime',
  'status', 'jobId', 'calEventId', 'createdAt', 'updatedAt', 'source'];
const NOTE_CATS = { follow: '📞 ຕິດຕາມ', install: '🔧 ລໍຖ້າຕິດຕັ້ງ', important: '⭐ ສຳຄັນ', other: '📌 ອື່ນໆ' };
const NOTE_STATUS = { open: 'ເປີດ', done: 'ສຳເລັດ', won: 'ປິດການຂາຍໄດ້', lost: 'ບໍ່ຊື້' };

function noteSheet() {
  let s = sheet('Notes');
  if (!s) {
    s = SpreadsheetApp.getActiveSpreadsheet().insertSheet('Notes');
    s.appendRow(NOTE_COLS); s.setFrozenRows(1);
    s.getRange(1, 1, s.getMaxRows(), NOTE_COLS.length).setNumberFormat('@');
  }
  return s;
}
function readNotes() {
  const v = noteSheet().getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    const o = { _row: i + 1 };
    NOTE_COLS.forEach((c, k) => { o[c] = c === 'value' ? (Number(v[i][k]) || 0) : c === 'remindDate' ? fmtD(v[i][k]) : c === 'remindTime' ? fmtT(v[i][k]) : String(v[i][k] == null ? '' : v[i][k]); });
    if (!NOTE_CATS[o.cat]) o.cat = 'other';
    if (!NOTE_STATUS[o.status]) o.status = 'open';
    out.push(o);
  }
  return out;
}
function findNote(id) {
  const n = readNotes().filter(x => x.id === String(id))[0];
  if (!n) throw new Error('ບໍ່ພົບໂນດນີ້ (ອາດຖືກລຶບແລ້ວ)');
  return n;
}
function writeNote(n) {
  const s = noteSheet(), row = n._row || s.getLastRow() + 1;
  const r = s.getRange(row, 1, 1, NOTE_COLS.length);
  r.setNumberFormat('@');
  r.setValues([NOTE_COLS.map(c => n[c] == null ? '' : String(n[c]))]);
  n._row = row;
}
function syncNoteCal(n) {
  try {
    const st = settingsObj();
    if (!st.calendarId) return;
    const cal = CalendarApp.getCalendarById(st.calendarId); if (!cal) return;
    let ev = null;
    if (n.calEventId) { try { ev = cal.getEventById(n.calEventId); } catch (e) { ev = null; } }
    if (!n.remindDate || n.status !== 'open') { if (ev) ev.deleteEvent(); n.calEventId = ''; return; }
    const start = Utilities.parseDate(n.remindDate + ' ' + (n.remindTime || '09:00'), TZ, 'yyyy-MM-dd HH:mm');
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const title = NOTE_CATS[n.cat] + ': ' + (n.customer ? n.customer + ' — ' : '') + n.title;
    const desc = [n.phone ? '📞 ' + n.phone : '', n.detail, n.value ? '💰 ມູນຄ່າຄາດ: ' + money(n.value) + ' ກີບ' : '',
      '', '🔗 ' + PUBLIC_APP_URL].filter(x => x !== '').join('\n');
    if (!ev) ev = cal.createEvent(title, start, end, { description: desc });
    else { ev.setTitle(title); ev.setTime(start, end); ev.setDescription(desc); }
    ev.removeAllReminders(); ev.addPopupReminder(0); ev.addPopupReminder(60);
    ev.setColor(n.cat === 'follow' ? CalendarApp.EventColor.ORANGE : n.cat === 'important' ? CalendarApp.EventColor.RED : CalendarApp.EventColor.GRAY);
    n.calEventId = ev.getId();
  } catch (e) { /* ປະຕິທິນລົ້ມ ບໍ່ໃຫ້ກະທົບການບັນທຶກໂນດ */ }
}

function api_saveNote(ctx, data) {
  needOwner(ctx);
  return withLock(() => {
    const isNew = !data.id;
    const n = isNew ? { id: 'N' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
      status: 'open', jobId: '', calEventId: '', createdAt: nowFull() } : findNote(data.id);
    ['cat', 'title', 'customer', 'phone', 'detail', 'remindDate', 'remindTime', 'source']
      .forEach(k => { if (data[k] !== undefined) n[k] = String(data[k]).trim(); });
    if (data.value !== undefined) n.value = Math.max(0, Number(data.value) || 0);
    if (!NOTE_CATS[n.cat]) n.cat = 'other';
    if (!n.title) throw new Error('ກະລຸນາໃສ່ຫົວຂໍ້ໂນດ');
    n.updatedAt = nowFull();
    writeNote(n); queueCal('note', n.id);
    log(n.id, whoOf(ctx), isNew ? 'create' : 'edit', isNew ? 'ສ້າງໂນດ' : 'ແກ້ໄຂໂນດ');
    return api_getAll(ctx);
  });
}

function api_setNoteStatus(ctx, id, status) {
  needOwner(ctx);
  if (!NOTE_STATUS[status]) throw new Error('ສະຖານະບໍ່ຖືກຕ້ອງ');
  return withLock(() => {
    const n = findNote(id), old = n.status;
    n.status = status; n.updatedAt = nowFull();
    writeNote(n); queueCal('note', n.id);
    log(n.id, whoOf(ctx), 'status', NOTE_STATUS[old] + ' → ' + NOTE_STATUS[status]);
    return api_getAll(ctx);
  });
}

/* ເລື່ອນວັນເຕືອນ +days ມື້ (ນັບຈາກມື້ນີ້ ຖ້າວັນເຕືອນເກົ່າເລີຍໄປແລ້ວ) */
function api_snoozeNote(ctx, id, days) {
  needOwner(ctx);
  return withLock(() => {
    const n = findNote(id), today = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
    const base = n.remindDate && n.remindDate > today ? n.remindDate : today;
    const d = Utilities.parseDate(base + ' 12:00', TZ, 'yyyy-MM-dd HH:mm');
    d.setDate(d.getDate() + Math.max(1, Number(days) || 1));
    n.remindDate = Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); n.updatedAt = nowFull();
    writeNote(n); queueCal('note', n.id);
    log(n.id, whoOf(ctx), 'snooze', 'ເລື່ອນເຕືອນໄປ ' + n.remindDate);
    return api_getAll(ctx);
  });
}

function api_deleteNote(ctx, id) {
  needOwner(ctx);
  return withLock(() => {
    const n = findNote(id);
    if (n.calEventId) queueCal('del', '', n.calEventId);
    noteSheet().deleteRow(n._row);
    log(n.id, whoOf(ctx), 'delete', 'ລຶບໂນດ: ' + n.title);
    return api_getAll(ctx);
  });
}

/* ເອີ້ນຈາກ api_saveJob ເມື່ອປ່ຽນໂນດເປັນວຽກ → ປິດໂນດ + ຈື່ລະຫັດວຽກ */
function linkNoteToJob(noteId, jobId, ctx) {
  try {
    const n = findNote(noteId);
    n.status = n.cat === 'follow' ? 'won' : 'done'; n.jobId = jobId; n.updatedAt = nowFull();
    writeNote(n); queueCal('note', n.id);
    log(n.id, whoOf(ctx), 'job', 'ປ່ຽນເປັນວຽກ ' + jobId);
  } catch (e) { }
}

/* ========== 📦 ສັ່ງເຄື່ອງຈາກຜູ້ສະໜອງ (ເຈົ້າຂອງເທົ່ານັ້ນ) ==========
   ສິນຄ້າດຶງຈາກ Pancake POS · ໄດ້ຮັບເຄື່ອງ → ສ້າງໃບນຳເຂົ້າໃນ Pancake ອັດຕະໂນມັດ (ສະຕັອກເພີ່ມ)
   API key ຂອງ Pancake ເກັບໃນ Script Properties ຊື່ PANCAKE_API_KEY (ເຈົ້າຂອງໃສ່ເອງ — ບໍ່ຢູ່ໃນໂຄດ) */
const PANCAKE_BASE = 'https://pos.pages.fm/api/v1';
const PANCAKE_SHOP = '714977150';
const PANCAKE_WAREHOUSE = 'cb27c8bb-5599-422e-b1a4-d611cea4b893'; // Default warehouse
const PROD_COLS = ['vid', 'pid', 'name', 'variant', 'sku', 'category', 'retail', 'cost', 'stock', 'image', 'syncedAt'];
const SUP_COLS = ['id', 'name', 'phone', 'address', 'note', 'active'];
const PO_COLS = ['id', 'supplierId', 'date', 'status', 'items', 'shipFee', 'discount', 'paid', 'note', 'files',
  'pancakeId', 'pancakeNo', 'receivedAt', 'createdAt', 'updatedAt'];
const PO_STATUS = { draft: 'ຮ່າງ', sent: 'ສົ່ງໃບສັ່ງແລ້ວ', received: 'ໄດ້ຮັບເຄື່ອງແລ້ວ', cancelled: 'ຍົກເລີກ' };

function tabSheet(name, cols) {
  let s = sheet(name);
  if (!s) {
    s = SpreadsheetApp.getActiveSpreadsheet().insertSheet(name);
    s.appendRow(cols); s.setFrozenRows(1);
    s.getRange(1, 1, s.getMaxRows(), cols.length).setNumberFormat('@');
  }
  return s;
}
function readTab(name, cols, nums) {
  const v = tabSheet(name, cols).getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    const o = { _row: i + 1 };
    cols.forEach((c, k) => { o[c] = (nums || []).indexOf(c) >= 0 ? (Number(v[i][k]) || 0) : (v[i][k] instanceof Date ? fmtD(v[i][k]) : String(v[i][k] == null ? '' : v[i][k])); });
    out.push(o);
  }
  return out;
}
function writeTab(name, cols, o) {
  const s = tabSheet(name, cols), row = o._row || s.getLastRow() + 1;
  const r = s.getRange(row, 1, 1, cols.length);
  r.setNumberFormat('@');
  r.setValues([cols.map(c => { const v = o[c]; return Array.isArray(v) ? JSON.stringify(v) : v == null ? '' : String(v); })]);
  o._row = row;
}
function readProducts() { return readTab('Products', PROD_COLS, ['retail', 'cost', 'stock']); }
function readSuppliers() { return readTab('Suppliers', SUP_COLS).map(s => { s.active = s.active !== 'FALSE'; return s; }); }
function readPOs() {
  return readTab('Purchases', PO_COLS, ['shipFee', 'discount', 'paid']).map(p => {
    p.items = parseArr(p.items); p.files = parseArr(p.files);
    if (!PO_STATUS[p.status]) p.status = 'draft';
    p.subtotal = p.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    p.total = Math.max(0, p.subtotal - p.discount + p.shipFee);
    return p;
  });
}
function findPO(id) {
  const p = readPOs().filter(x => x.id === String(id))[0];
  if (!p) throw new Error('ບໍ່ພົບໃບສັ່ງນີ້');
  return p;
}

function pancakeKey() {
  const k = PropertiesService.getScriptProperties().getProperty('PANCAKE_API_KEY');
  if (!k) throw new Error('ຍັງບໍ່ໄດ້ໃສ່ PANCAKE_API_KEY ໃນ Script Properties (ເບິ່ງຄູ່ມື)');
  return k;
}
function pancakeFetch(path, method, body) {
  const url = PANCAKE_BASE + '/shops/' + PANCAKE_SHOP + path + (path.indexOf('?') >= 0 ? '&' : '?') + 'api_key=' + encodeURIComponent(pancakeKey());
  const opt = { method: method || 'get', muteHttpExceptions: true, contentType: 'application/json' };
  if (body) opt.payload = JSON.stringify(body);
  const res = UrlFetchApp.fetch(url, opt), code = res.getResponseCode();
  let data = null; try { data = JSON.parse(res.getContentText()); } catch (e) { }
  if (code >= 300 || !data || data.success === false) throw new Error('Pancake ຕອບ ' + code + ': ' + String(res.getContentText()).slice(0, 160));
  return data;
}

/* ດຶງສິນຄ້າ + ສະຕັອກ + ທຶນລ່າສຸດ ຈາກ Pancake → ແທັບ Products (ຂຽນທັບທັງໝົດ) */
function syncProductsCore() {
  let all = [], page = 1, r;
  do { r = pancakeFetch('/products?page_size=100&page_number=' + page); all = all.concat(r.data || []); page++; }
  while ((r.data || []).length === 100 && page < 20);
  const now = nowFull(), rows = [];
  all.forEach(p => (p.variations || []).forEach(v => {
    if (v.is_removed) return;
    const variant = (v.fields || []).map(f => f.value).filter(Boolean).join(' / ');
    const img = (v.images && v.images[0]) || p.image || '';
    rows.push([v.id, p.id, p.name, variant, v.display_id || '', (p.categories || []).map(c => c.name).join(', '),
      v.retail_price || 0, v.last_imported_price || 0, v.remain_quantity || 0, img, now]);
  }));
  const s = tabSheet('Products', PROD_COLS);
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, PROD_COLS.length).clearContent();
  if (rows.length) { const rg = s.getRange(2, 1, rows.length, PROD_COLS.length); rg.setNumberFormat('@'); rg.setValues(rows.map(r => r.map(String))); }
  return rows.length;
}
function api_syncProducts(ctx) {
  needOwner(ctx);
  return withLock(() => { const n = syncProductsCore(); return api_getAll(ctx, '✓ ດຶງສິນຄ້າຈາກ Pancake ' + n + ' ລາຍການ', { products: true }); });
}

function api_saveSupplier(ctx, d) {
  needOwner(ctx);
  return withLock(() => {
    const s = d.id ? (readSuppliers().filter(x => x.id === d.id)[0] || {}) : { id: 'S' + Date.now().toString(36).toUpperCase(), active: true };
    ['name', 'phone', 'address', 'note'].forEach(k => { if (d[k] !== undefined) s[k] = String(d[k]).trim(); });
    if (d.active !== undefined) s.active = !!d.active;
    if (!s.name) throw new Error('ກະລຸນາໃສ່ຊື່ຜູ້ສະໜອງ');
    s.active = s.active === false ? 'FALSE' : 'TRUE';
    writeTab('Suppliers', SUP_COLS, s);
    return api_getAll(ctx);
  });
}

function api_savePO(ctx, d) {
  needOwner(ctx);
  return withLock(() => {
    const isNew = !d.id;
    const p = isNew ? { id: 'PO' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 5).toUpperCase(),
      status: 'draft', files: [], pancakeId: '', pancakeNo: '', receivedAt: '', createdAt: nowFull() } : findPO(d.id);
    if (p.status === 'received') throw new Error('ໃບນີ້ຮັບເຄື່ອງ ແລະ ລົງ Pancake ແລ້ວ — ແກ້ລາຍການບໍ່ໄດ້ (ແກ້ໄດ້ແຕ່ການຈ່າຍເງິນ)');
    ['supplierId', 'date', 'note'].forEach(k => { if (d[k] !== undefined) p[k] = String(d[k]).trim(); });
    ['shipFee', 'discount', 'paid'].forEach(k => { if (d[k] !== undefined) p[k] = Math.max(0, Number(d[k]) || 0); });
    if (Array.isArray(d.items)) p.items = d.items.map(it => ({ vid: String(it.vid || ''), name: String(it.name || '').trim(), variant: String(it.variant || ''),
      sku: String(it.sku || ''), qty: Math.max(0, Number(it.qty) || 0), price: Math.max(0, Number(it.price) || 0) })).filter(it => it.name && it.qty > 0);
    if (!p.supplierId) throw new Error('ກະລຸນາເລືອກຜູ້ສະໜອງ');
    if (!p.items || !p.items.length) throw new Error('ກະລຸນາເລືອກສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ');
    p.updatedAt = nowFull();
    writeTab('Purchases', PO_COLS, p);
    log(p.id, whoOf(ctx), isNew ? 'create' : 'edit', isNew ? 'ສ້າງໃບສັ່ງເຄື່ອງ' : 'ແກ້ໄຂໃບສັ່ງເຄື່ອງ');
    return api_getAll(ctx);
  });
}

/* ຈ່າຍເງິນ (ແກ້ໄດ້ທຸກສະຖານະ) */
function api_payPO(ctx, id, paid) {
  needOwner(ctx);
  return withLock(() => {
    const p = findPO(id), before = p.paid || 0;
    p.paid = Math.max(0, Number(paid) || 0); p.updatedAt = nowFull();
    const sup = readSuppliers().filter(s => s.id === p.supplierId)[0];
    payLog(ctx, { kind: 'out', src: 'po', ref: p.id, amount: p.paid - before, party: sup ? sup.name : '', note: 'ຈ່າຍໃບສັ່ງຊື້ ' + p.id });
    writeTab('Purchases', PO_COLS, p);
    log(p.id, whoOf(ctx), 'pay', 'ຈ່າຍຜູ້ສະໜອງແລ້ວລວມ ' + money(p.paid) + ' ກີບ');
    return api_getAll(ctx);
  });
}

/* status: sent | received | cancelled | draft · received → ສ້າງໃບນຳເຂົ້າ Pancake (status 1 = ນຳເຂົ້າແລ້ວ) */
function api_setPOStatus(ctx, id, status) {
  needOwner(ctx);
  if (!PO_STATUS[status]) throw new Error('ສະຖານະບໍ່ຖືກຕ້ອງ');
  return withLock(() => {
    const p = findPO(id), old = p.status;
    if (old === 'received') throw new Error('ໃບນີ້ລົງ Pancake ແລ້ວ — ປ່ຽນສະຖານະບໍ່ໄດ້ (ຖ້າຜິດ ໃຫ້ແກ້ໃນ Pancake)');
    let warn = '';
    if (status === 'received') {
      const bad = p.items.filter(it => !it.vid);
      if (bad.length) throw new Error('ມີລາຍການທີ່ບໍ່ໄດ້ເລືອກຈາກສິນຄ້າ Pancake: ' + bad.map(b => b.name).join(', '));
      const sup = readSuppliers().filter(s => s.id === p.supplierId)[0] || {};
      const r = pancakeFetch('/purchases', 'post', { purchase: {
        warehouse_id: PANCAKE_WAREHOUSE, status: 1, transport_fee: p.shipFee || 0,
        note: p.id + ' · ' + (sup.name || '') + (p.discount ? ' · ສ່ວນຫຼຸດ ' + money(p.discount) : '') + (p.note ? ' · ' + p.note : ''),
        items: p.items.map(it => ({ variation_id: it.vid, quantity: it.qty, imported_price: it.price }))
      } });
      p.pancakeId = (r.data && r.data.id) || ''; p.pancakeNo = (r.data && r.data.display_id) || '';
      p.receivedAt = nowFull();
      try { syncProductsCore(); } catch (e) { warn = 'ລົງ Pancake ແລ້ວ ແຕ່ອັບເດດສະຕັອກໃນແອບບໍ່ສຳເລັດ — ກົດ 🔄 ດຶງສິນຄ້າ'; }
    }
    p.status = status; p.updatedAt = nowFull();
    writeTab('Purchases', PO_COLS, p);
    log(p.id, whoOf(ctx), 'status', PO_STATUS[old] + ' → ' + PO_STATUS[status] + (p.pancakeNo && status === 'received' ? ' · Pancake #' + p.pancakeNo : ''));
    return api_getAll(ctx, warn, { products: true });
  });
}

function api_deletePO(ctx, id) {
  needOwner(ctx);
  return withLock(() => {
    const p = findPO(id);
    if (p.status === 'received') throw new Error('ໃບທີ່ລົງ Pancake ແລ້ວ ລຶບບໍ່ໄດ້');
    tabSheet('Purchases', PO_COLS).deleteRow(p._row);
    log(p.id, whoOf(ctx), 'delete', 'ລຶບໃບສັ່ງເຄື່ອງ');
    return api_getAll(ctx);
  });
}

/* ແນບຮູບ/PDF ບິນ · dataUrl = data:<mime>;base64,... */
function api_uploadPOFile(ctx, id, dataUrl, fileName) {
  needOwner(ctx);
  const m = String(dataUrl).match(/^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m || !/^(image\/|application\/pdf)/i.test(m[1])) throw new Error('ຮອງຮັບແຕ່ຮູບ ຫຼື PDF');
  findPO(id);
  const st = settingsObj();
  const folder = DriveApp.getFolderById(st.photoFolderId);
  const name = id + '_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd_HHmmss') + '_' + String(fileName || 'bill').replace(/[^\w.\-]+/g, '_').slice(-40);
  const file = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], name));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return withLock(() => {
    const p = findPO(id);
    p.files.push({ id: file.getId(), name: String(fileName || name).slice(0, 80), mime: m[1] });
    p.updatedAt = nowFull();
    writeTab('Purchases', PO_COLS, p);
    log(p.id, whoOf(ctx), 'file', 'ແນບໄຟລ໌: ' + (fileName || name));
    return api_getAll(ctx);
  });
}
function api_delPOFile(ctx, id, fileId) {
  needOwner(ctx);
  return withLock(() => {
    const p = findPO(id);
    p.files = p.files.filter(f => f.id !== fileId); p.updatedAt = nowFull();
    writeTab('Purchases', PO_COLS, p);
    try { DriveApp.getFileById(fileId).setTrashed(true); } catch (e) { }
    return api_getAll(ctx);
  });
}

/* ກົດ Run ຟັງຊັນນີ້ 1 ຄັ້ງ ຫຼັງໃສ່ PANCAKE_API_KEY → ໃຫ້ສິດເຊື່ອມອິນເຕີເນັດ + ດຶງສິນຄ້າຄັ້ງທຳອິດ */
function setupPancake() {
  const n = syncProductsCore();
  Logger.log('✓ ເຊື່ອມ Pancake ສຳເລັດ — ດຶງສິນຄ້າໄດ້ ' + n + ' ລາຍການ');
}

/* ========== ຄິວອັບເດດ Google Calendar ຢູ່ເບື້ອງຫຼັງ ==========
   ເຫດຜົນ: ການອັບເດດ Calendar ຊ້າ (ຫຼາຍວິນາທີ) → ບໍ່ໃຫ້ຜູ້ໃຊ້ລໍຖ້າ
   ທຸກການບັນທຶກ ໃສ່ຄິວໄວ້ (Script Properties: CAL_QUEUE) → trigger ທຸກ 1 ນາທີ ມາອັບເດດ Calendar
   ຕ້ອງກົດ Run setupCalTrigger 1 ຄັ້ງ (ໃຫ້ສິດ trigger) */
function queueCal(kind, id, ev) {
  const p = PropertiesService.getScriptProperties();
  const q = parseArr(p.getProperty('CAL_QUEUE'));
  if (!q.some(x => x.k === kind && x.id === String(id || '') && x.ev === (ev || ''))) q.push({ k: kind, id: String(id || ''), ev: ev || '' });
  p.setProperty('CAL_QUEUE', JSON.stringify(q.slice(-300)));
  return '';
}
function processCalQueue() {
  const p = PropertiesService.getScriptProperties();
  let q = [];
  withLock(() => { q = parseArr(p.getProperty('CAL_QUEUE')); p.setProperty('CAL_QUEUE', '[]'); });
  if (!q.length) return;
  const st = settingsObj(), cal = st.calendarId ? CalendarApp.getCalendarById(st.calendarId) : null;
  const retry = [];
  q.forEach(x => {
    try {
      if (x.k === 'del') { if (cal && x.ev) { try { const e = cal.getEventById(x.ev); if (e) e.deleteEvent(); } catch (e) { } } return; }
      if (x.k === 'job') {
        forget('jobs');
        let j; try { j = findJob(x.id); } catch (e) { return; } // ວຽກຖືກລຶບແລ້ວ
        const before = j.calEventId, after = syncCal(j, readTechs(true));
        if (after !== before) withLock(() => { forget('jobs'); const jj = findJob(x.id); jj.calEventId = after; writeJob(jj); });
      } else if (x.k === 'note') {
        let n; try { n = findNote(x.id); } catch (e) { return; }
        const before = n.calEventId; syncNoteCal(n);
        if (n.calEventId !== before) withLock(() => { const nn = findNote(x.id); nn.calEventId = n.calEventId; writeNote(nn); });
      }
    } catch (e) {
      if ((x.n || 0) < 3) retry.push(Object.assign({}, x, { n: (x.n || 0) + 1 }));
      log(x.id, 'system', 'calerr', 'ອັບເດດ Calendar ບໍ່ສຳເລັດ: ' + e.message);
    }
  });
  if (retry.length) withLock(() => { p.setProperty('CAL_QUEUE', JSON.stringify(parseArr(p.getProperty('CAL_QUEUE')).concat(retry))); });
  bumpCache(); // calEventId / ຈຳນວນຄິວປ່ຽນ → ລ້າງແຄຊ
}
/* ກົດ Run 1 ຄັ້ງ → ສ້າງ trigger ອັບເດດ Calendar ທຸກ 1 ນາທີ */
function setupCalTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'processCalQueue').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('processCalQueue').timeBased().everyMinutes(1).create();
  processCalQueue();
  Logger.log('✓ ຕັ້ງ trigger ອັບເດດ Calendar ທຸກ 1 ນາທີ ແລ້ວ');
}

/* ========== 🧾 ໃບເກັບເງິນ (ເຈົ້າຂອງເທົ່ານັ້ນ) ==========
   ເລກທີ INV-<ປີ>-NNN ນັບຕໍ່ສາຍດຽວກັບໃບທີ່ອອກຈາກອໍເດີ Pancake (ໃບສຸດທ້າຍກ່ອນມີແອບ = 042)
   ເຈົ້າຂອງແກ້ເລກໄດ້ກ່ອນອອກ · ລະບົບບໍ່ໃຫ້ອອກເລກທີ່ໃຊ້ແລ້ວໃນແອບ */
const INV_START = 42;
const RC_COLS = ['no', 'jobId', 'date', 'customer', 'address', 'phone', 'items', 'discount', 'total', 'paid', 'note', 'createdAt', 'by'];
function readReceipts() {
  return readTab('Receipts', RC_COLS, ['no', 'discount', 'total', 'paid']).map(r => { r.items = parseArr(r.items); delete r._row; return r; });
}
function nextInvoiceNo(rcs) {
  const last = Number(settingsObj().lastInvoiceNo) || INV_START;
  return Math.max(last, rcs.reduce((a, r) => Math.max(a, r.no), 0)) + 1;
}
function api_issueReceipt(ctx, d) {
  needOwner(ctx);
  return withLock(() => {
    const rcs = readReceipts(), no = Math.round(Number(d.no) || 0);
    if (no < 1) throw new Error('ເລກທີບໍ່ຖືກຕ້ອງ');
    if (rcs.some(r => r.no === no)) throw new Error('ເລກທີ ' + no + ' ອອກໃນແອບແລ້ວ — ໃຊ້ເລກອື່ນ');
    const items = (d.items || []).map(it => ({ name: String(it.name || '').trim(), qty: Math.max(0, Number(it.qty) || 0), price: Math.max(0, Number(it.price) || 0) }))
      .filter(it => it.name && it.qty > 0);
    if (!items.length) throw new Error('ກະລຸນາໃສ່ລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ');
    if (!String(d.customer || '').trim()) throw new Error('ກະລຸນາໃສ່ຊື່ລູກຄ້າ');
    const sub = items.reduce((a, it) => a + it.qty * it.price, 0), discount = Math.max(0, Number(d.discount) || 0);
    const r = { no: no, jobId: String(d.jobId || ''), date: String(d.date || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')),
      customer: String(d.customer).trim(), address: String(d.address || '').trim(), phone: String(d.phone || '').trim(),
      items: items, discount: discount, total: Math.max(0, sub - discount), paid: Math.max(0, Number(d.paid) || 0),
      note: String(d.note || '').trim(), createdAt: nowFull(), by: whoOf(ctx) };
    writeTab('Receipts', RC_COLS, r);
    // ຈື່ເລກສູງສຸດໄວ້ (ກໍລະນີແກ້ເລກຂ້າມໄປ)
    const s = sheet(SH.SET), vals = s.getDataRange().getValues();
    let found = false;
    for (let i = 1; i < vals.length; i++) if (String(vals[i][0]) === 'lastInvoiceNo') { found = true; if (no > (Number(vals[i][1]) || 0)) s.getRange(i + 1, 2).setValue(no); }
    if (!found) s.appendRow(['lastInvoiceNo', Math.max(no, INV_START)]);
    forget('settings');
    if (r.jobId) log(r.jobId, whoOf(ctx), 'receipt', '🧾 ອອກໃບເກັບເງິນ INV-' + r.date.slice(0, 4) + '-' + ('00' + no).slice(-3) + ' · ' + money(r.total) + ' ກີບ');
    return jobDelta(ctx, r.jobId ? [r.jobId] : [], (rc => ({ receipts: rc, nextInvoice: nextInvoiceNo(rc) }))(readReceipts()));
  });
}

/* ========== 🧱 ເອກະສານຮົ້ວ (ເຈົ້າຂອງເທົ່ານັ້ນ) — ແບບດຽວກັບ PHUSIRI_FENCE_QUOTE_FORM / RECEIPT_FORM ==========
   kind: quote = ໃບສະເໜີລາຄາ (ເລກ QT) · deposit = ໃບຮັບເງິນມັດຈຳ · install = ໃບຮັບເງິນງວດ · full = ໃບເກັບເງິນ (ເລກ FN)
   ເລກທີແຍກສາຍຈາກ INV ຂອງ Home Solar (ເຈົ້າຂອງເລືອກ 2026-10-20) · ໃບຮັບເງິນ + ຕິກ addPay → ບັນທຶກເງິນເຂົ້າວຽກນຳ */
const FD_COLS = ['id', 'kind', 'no', 'jobId', 'date', 'validDate', 'customer', 'address', 'phone', 'items', 'total', 'prevPaid', 'paid',
  'notes', 'terms', 'createdAt', 'by'];
const FD_KINDS = { quote: 'QT', deposit: 'FN', install: 'FN', full: 'FN' };
function readFenceDocs() {
  return readTab('FenceDocs', FD_COLS, ['no', 'total', 'prevPaid', 'paid']).map(r => { r.items = parseArr(r.items); delete r._row; return r; });
}
function api_issueFenceDoc(ctx, d) {
  needOwner(ctx);
  return withLock(() => {
    const kind = String(d.kind || ''), ser = FD_KINDS[kind];
    if (!ser) throw new Error('ປະເພດເອກະສານບໍ່ຖືກຕ້ອງ');
    const docs = readFenceDocs(), no = Math.round(Number(d.no) || 0);
    if (no < 1) throw new Error('ເລກທີບໍ່ຖືກຕ້ອງ');
    if (docs.some(x => FD_KINDS[x.kind] === ser && x.no === no)) throw new Error('ເລກທີ ' + ser + ' ' + no + ' ອອກແລ້ວ — ໃຊ້ເລກອື່ນ');
    const items = (d.items || []).map(it => ({ name: String(it.name || '').trim(), mesh: String(it.mesh || '').trim(), size: String(it.size || '').trim(),
      unit: String(it.unit || '').trim(), qty: Math.max(0, Number(it.qty) || 0), price: Math.max(0, Number(it.price) || 0) })).filter(it => it.name && it.qty > 0);
    if (!items.length) throw new Error('ກະລຸນາໃສ່ລາຍການຢ່າງໜ້ອຍ 1 ລາຍການ');
    if (!String(d.customer || '').trim()) throw new Error('ກະລຸນາໃສ່ຊື່ລູກຄ້າ');
    const date = String(d.date || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'));
    const r = { id: ser + '-' + date.slice(0, 4) + '-' + ('00' + no).slice(-3), kind: kind, no: no, jobId: String(d.jobId || ''), date: date,
      validDate: kind === 'quote' ? String(d.validDate || '') : '', customer: String(d.customer).trim(), address: String(d.address || '').trim(),
      phone: String(d.phone || '').trim(), items: items, total: items.reduce((a, it) => a + it.qty * it.price, 0),
      prevPaid: kind === 'quote' ? 0 : Math.max(0, Number(d.prevPaid) || 0), paid: kind === 'quote' ? 0 : Math.max(0, Math.round(Number(d.paid) || 0)),
      notes: String(d.notes || '').trim(), terms: String(d.terms || '').trim(), createdAt: nowFull(), by: whoOf(ctx) };
    if (kind !== 'quote' && r.paid <= 0) throw new Error('ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຮັບ');
    const j = r.jobId ? findJob(r.jobId) : null; // ກວດວ່າວຽກຍັງຢູ່ ກ່ອນບັນທຶກໃບ (ບໍ່ດັ່ງນັ້ນໃບເຂົ້າ Sheet ແຕ່ເງິນບໍ່ເຂົ້າວຽກ)
    writeTab('FenceDocs', FD_COLS, r);
    const label = { quote: '📋 ອອກໃບສະເໜີລາຄາ', deposit: '💵 ອອກໃບຮັບເງິນມັດຈຳ', install: '💵 ອອກໃບຮັບເງິນງວດ', full: '🧾 ອອກໃບເກັບເງິນຮົ້ວ' }[kind];
    if (j) {
      if (kind !== 'quote' && d.addPay) { // ບັນທຶກເງິນເຂົ້າວຽກ (ມັດຈຳ → ຊ່ອງມັດຈຳ · ອື່ນໆ → ເກັບແລ້ວ)
        if (kind === 'deposit') j.deposit += r.paid; else j.collected += r.paid;
        if (!j.price) j.price = r.total;
        j.updatedAt = nowFull(); writeJob(j);
        log(j.id, whoOf(ctx), 'pay', (kind === 'deposit' ? 'ຮັບມັດຈຳ ' : 'ເກັບເງິນໄດ້ ') + money(r.paid) + ' ກີບ (' + r.id + ')');
      }
    }
    // ເງິນເຂົ້າແທ້ → ສະໝຸດເງິນ (ມີວຽກ + ຕິກບັນທຶກເຂົ້າວຽກ ຫຼື ໃບທີ່ບໍ່ມີວຽກ) · ບໍ່ຕິກ = ຖືວ່າບັນທຶກທາງອື່ນແລ້ວ
    if (kind !== 'quote' && (j ? d.addPay : true)) payLog(ctx, { kind: 'in', src: 'fencedoc', ref: r.jobId, doc: r.id, amount: r.paid, party: r.customer, note: label + ' ' + r.id, fence: true });
    if (j) {
      log(j.id, whoOf(ctx), 'receipt', label + ' ' + r.id + ' · ' + money(kind === 'quote' ? r.total : r.paid) + ' ກີບ');
    }
    return jobDelta(ctx, j ? [j.id] : [], { fenceDocs: readFenceDocs() });
  });
}
/* ໃບສະເໜີລາຄາທີ່ອອກກ່ອນມີວຽກ → ຜູກກັບວຽກທີ່ສ້າງຈາກໃບນັ້ນ */
function linkFenceDocToJob(docId, jobId, ctx) {
  const r = readTab('FenceDocs', FD_COLS).filter(x => x.id === String(docId))[0];
  if (!r || r.jobId) return;
  r.jobId = jobId; writeTab('FenceDocs', FD_COLS, r);
  log(jobId, whoOf(ctx), 'receipt', '📋 ສ້າງວຽກຈາກໃບສະເໜີລາຄາ ' + r.id);
}

/* ========== 💸 ລາຍຈ່າຍຂອງວຽກ (ເຈົ້າຂອງເທົ່ານັ້ນ · ເພີ່ມ 2026-10-20) ==========
   ກຳໄລວຽກ = ມູນຄ່າວຽກ − (ລາຍຈ່າຍທີ່ບັນທຶກ + ຄ່າແຮງຊ່າງ techPay) · ຊ່າງບໍ່ໄດ້ຮັບຂໍ້ມູນນີ້ */
function api_addExpense(ctx, id, e) {
  needOwner(ctx);
  const amount = Math.round(Number(e && e.amount) || 0), name = String(e && e.name || '').trim();
  if (amount <= 0) throw new Error('ໃສ່ຈຳນວນເງິນໃຫ້ຖືກ');
  if (!name) throw new Error('ກະລຸນາໃສ່ລາຍການ');
  return withLock(() => {
    const j = findJob(id);
    const x = { id: Utilities.getUuid().slice(0, 8), cat: String(e.cat || '📌 ອື່ນໆ'), name: name, amount: amount,
      date: String(e.date || Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')), by: whoOf(ctx) };
    j.expenses = (j.expenses || []).concat([x]); j.updatedAt = nowFull(); writeJob(j);
    log(j.id, whoOf(ctx), 'pay', '💸 ລາຍຈ່າຍ: ' + x.name + ' ' + money(x.amount) + ' ກີບ');
    return jobDelta(ctx, [id]);
  });
}
function api_delExpense(ctx, id, eid) {
  needOwner(ctx);
  return withLock(() => {
    const j = findJob(id), x = (j.expenses || []).filter(e => e.id === String(eid))[0];
    if (!x) return jobDelta(ctx, [id]);
    j.expenses = j.expenses.filter(e => e.id !== x.id); j.updatedAt = nowFull(); writeJob(j);
    log(j.id, whoOf(ctx), 'pay', '🗑️ ລຶບລາຍຈ່າຍ: ' + x.name + ' ' + money(x.amount) + ' ກີບ');
    return jobDelta(ctx, [id]);
  });
}

/* ========== 💱 ບັນທຶກການຮັບ-ຈ່າຍເງິນ → ແອບສະໝຸດເງິນ (ເພີ່ມ 2026-10-22) ==========
   ທຸກຄັ້ງທີ່ເງິນເຂົ້າ/ອອກແທ້ ຈົດ 1 ແຖວລົງແທັບ Payments · ແອບ MONEY_BOOK (ບັນຊີ mee50cent ດຽວກັນ) ອ່ານແທັບນີ້ໂດຍກົງ
   ເຈົ້າຂອງເລືອກ: ເງິນວຽກດອກໄຟ ເຂົ້າສະໝຸດເງິນຜ່ານ Pancake ແລ້ວ → MONEY_BOOK ນຳເຂົ້າສະເພາະ fence=TRUE ແລະ src=po (ກັນນັບຊ້ຳ)
   amount ຕິດລົບໄດ້ (ແກ້ຍອດລົງ) */
const PAY_COLS = ['id', 'time', 'date', 'kind', 'src', 'ref', 'doc', 'amount', 'party', 'note', 'fence', 'by'];
function isFenceJob(j) { return /ຮົ້ວ/.test(String(j && j.type || '')); }
function payLog(ctx, o) {
  const amount = Math.round(Number(o.amount) || 0); if (!amount) return;
  writeTab('Payments', PAY_COLS, { id: 'PM' + Utilities.formatDate(new Date(), TZ, 'yyMMddHHmmss') + Math.random().toString(36).slice(2, 5).toUpperCase(),
    time: nowFull(), date: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'), kind: o.kind, src: o.src, ref: o.ref || '', doc: o.doc || '',
    amount: amount, party: o.party || '', note: o.note || '', fence: o.fence ? 'TRUE' : 'FALSE', by: whoOf(ctx) });
}
/* ກົດ Run 1 ຄັ້ງ: ນຳປະຫວັດການຈ່າຍໃບສັ່ງຊື້ (ກ່ອນມີແທັບ Payments) ລົງ Payments ຕາມວັນທີແທ້
   ຄິດຈາກ Log "ຈ່າຍຜູ້ສະໜອງແລ້ວລວມ X ກີບ" (ຍອດສະສົມ → ສ່ວນຕ່າງແຕ່ລະເທື່ອ) · ໃບທີ່ມີແຖວ po ໃນ Payments ແລ້ວ = ຂ້າມ (Run ຊ້ຳໄດ້) */
function backfillPOPayments() {
  return withLock(() => {
    const have = {}; readTab('Payments', PAY_COLS).forEach(r => { if (r.src === 'po') have[r.ref] = 1; });
    const pos = readPOs().filter(p => !have[p.id] && p.paid > 0), sup = {}; readSuppliers().forEach(s => { sup[s.id] = s.name; });
    const lv = sheet(SH.LOG).getDataRange().getValues(), hist = {};
    for (let i = 1; i < lv.length; i++) {
      const m = String(lv[i][4]).match(/ຈ່າຍຜູ້ສະໜອງແລ້ວລວມ ([\d,]+)/);
      if (String(lv[i][3]) === 'pay' && m) (hist[String(lv[i][1])] = hist[String(lv[i][1])] || []).push({ t: lv[i][0], v: Number(m[1].replace(/,/g, '')) });
    }
    const s = tabSheet('Payments', PAY_COLS), out = [];
    pos.forEach(p => {
      let prev = 0;
      const ev = (hist[p.id] || []).map(h => { const d = h.t instanceof Date ? h.t : new Date(String(h.t).replace(' ', 'T') + ':00+07:00'); const a = h.v - prev; prev = h.v; return { d: d, a: a }; }).filter(e => e.a);
      const sum = ev.reduce((x, e) => x + e.a, 0);
      if (sum !== p.paid) ev.push({ d: new Date(String(p.date || p.createdAt).slice(0, 10) + 'T12:00:00+07:00'), a: p.paid - sum }); // ສ່ວນທີ່ບໍ່ມີ Log
      ev.forEach((e, k) => out.push(PAY_COLS.map(c => String({ id: 'PMB' + p.id + '-' + (k + 1), time: Utilities.formatDate(e.d, TZ, 'yyyy-MM-dd HH:mm'), date: Utilities.formatDate(e.d, TZ, 'yyyy-MM-dd'),
        kind: 'out', src: 'po', ref: p.id, doc: '', amount: Math.round(e.a), party: sup[p.supplierId] || '', note: 'ຈ່າຍໃບສັ່ງຊື້ ' + p.id + ' (ປະຫວັດ)', fence: 'FALSE', by: 'backfill' }[c]))));
    });
    if (out.length) { const r = s.getRange(s.getLastRow() + 1, 1, out.length, PAY_COLS.length); r.setNumberFormat('@'); r.setValues(out); }
    Logger.log('✓ ນຳເຂົ້າປະຫວັດຈ່າຍໃບສັ່ງຊື້: ' + pos.length + ' ໃບ · ' + out.length + ' ແຖວ · ລວມ ' + money(out.reduce((a, r) => a + Number(r[7]), 0)) + ' ກີບ');
  });
}

/* ========== 👥 ຖານລູກຄ້າ + ແຫຼ່ງທີ່ມາ + ສະຖິຕິການຂາຍ (ເພີ່ມ 2026-10-26) ==========
   ເຈົ້າຂອງເລືອກ: ລວມ Pancake + ແອບວຽກ · ຈັບຄູ່ລູກຄ້າດ້ວຍເບີໂທ
   - Customers: 1 ແຖວ/ລູກຄ້າ · source = ມາຈາກທາງໃດ (ໃສ່ໄດ້ທັງລູກຄ້າໜ້າຮ້ານທີ່ມີແຕ່ບິນ Pancake)
   - Sales: ລາຍການສິນຄ້າໃນອໍເດີ Pancake (ສ້າງໃໝ່ທຸກຄັ້ງທີ່ sync) → ລຸ້ນຂາຍດີ
   - ປິດການຂາຍ = ມີບິນ Pancake (ບໍ່ນັບບິນຍົກເລີກ/ຕີກັບ) ຫຼື ວຽກຮົ້ວສຳເລັດ (ວຽກດອກໄຟ ມີບິນ Pancake ແລ້ວ → ບໍ່ນັບຊ້ຳ) */
const DEFAULT_SOURCES = ['🟠 Solaro ສົ່ງມາ', '🎵 TikTok', '📘 Facebook', '🚶 Walk-in', '🏪 ໜ້າຮ້ານ', '🗣️ ແນະນຳບອກຕໍ່', '🔁 ລູກຄ້າຊື້ຊ້ຳ'];
const CUST_COLS = ['id', 'name', 'phone', 'address', 'source', 'sourceNote', 'pancakeId', 'orders', 'okOrders', 'amount',
  'firstOrder', 'lastOrder', 'note', 'createdAt', 'updatedAt', 'geo'];
// geo = ລະຫັດບ້ານ (commune_id ຂອງ Pancake ເຊັ່ນ 856_200104022) → ແຂວງ/ເມືອງ ອ່ານຈາກ 3 ຕົວທຳອິດຂອງລະຫັດ (ໄຟລ໌ jobs/lao-geo.json)
const SALE_COLS = ['oid', 'date', 'status', 'pancakeCust', 'phone', 'vid', 'name', 'qty', 'amount'];
// ນັບເປັນການຊື້ = ທຸກບິນທີ່ບໍ່ຖືກຍົກເລີກ/ຕີກັບ (ເຈົ້າຂອງ 2026-10-26: ໃຫ້ກົງກັບບິນຕົວຈິງ — ບາງບິນຍັງຄ້າງສະຖານະ new ໃນ Pancake)
const NOT_SALE = { canceled: 1, returned: 1, returning: 1, removed: 1 };
const SHOP_PHONES = { '2055949459': 1, '2058868589': 1 }; // ເບີຮ້ານ HOME SOLAR (normPhone) — ບໍ່ໃຊ້ຈັບຄູ່ລູກຄ້າ
function sourcesList(st) {
  const t = String(st.sources || '').split('\n').map(x => x.trim()).filter(Boolean);
  return t.length ? t : DEFAULT_SOURCES;
}
// ເບີໂທ → ຮູບແບບດຽວ: ຕົວເລກລ້ວນ ຕັດ 856 / 0 ທາງໜ້າ (020 5594 9459 = +856 20 55949459 = 2055949459)
function normPhone(p) { let d = String(p || '').replace(/\D/g, ''); if (d.indexOf('856') === 0 && d.length > 10) d = d.slice(3); return d.replace(/^0+/, ''); }
function newCustId() { return 'C' + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function readCustomers() { return memo('cust', () => readTab('Customers', CUST_COLS, ['orders', 'okOrders', 'amount'])); }
// ບັນທຶກວຽກ → ຫາ/ສ້າງລູກຄ້າດ້ວຍເບີໂທ · ໃສ່ແຫຼ່ງທີ່ມາໃຫ້ລູກຄ້າ ຖ້າຍັງບໍ່ມີ
function linkCustomer(name, phone, address, source, geo) {
  const ph = normPhone(phone); if (ph.length < 7 || SHOP_PHONES[ph]) return ''; // ເບີຮ້ານ = ບໍ່ຜູກລູກຄ້າ
  let c = readCustomers().filter(x => x.phone === ph)[0];
  if (!c) {
    c = { id: newCustId(), name: name, phone: ph, address: address || '', source: source || '', sourceNote: '', pancakeId: '', orders: 0, okOrders: 0, amount: 0,
      firstOrder: '', lastOrder: '', note: '', createdAt: nowFull(), geo: geo || '' };
    readCustomers().push(c);
  } else { if (!c.source && source) c.source = source; if (!c.address && address) c.address = address; if (!c.name && name) c.name = name; if (!c.geo && geo) c.geo = geo; }
  c.updatedAt = nowFull(); writeTab('Customers', CUST_COLS, c);
  return c.id;
}
function api_getCRM(ctx) {
  needOwner(ctx);
  const strip = o => { const x = Object.assign({}, o); delete x._row; return x; };
  return JSON.stringify({ customers: readCustomers().map(strip), sales: readTab('Sales', SALE_COLS, ['qty', 'amount']).map(strip), salesSync: settingsObj().salesSync || '' });
}
function api_saveCustomer(ctx, d) {
  needOwner(ctx);
  return withLock(() => {
    const c = readCustomers().filter(x => x.id === String(d.id))[0]; if (!c) throw new Error('ບໍ່ພົບລູກຄ້າ');
    ['name', 'address', 'source', 'sourceNote', 'note', 'geo'].forEach(k => { if (d[k] !== undefined) c[k] = String(d[k]).trim(); });
    if (d.phone !== undefined && normPhone(d.phone).length >= 7) c.phone = normPhone(d.phone);
    c.updatedAt = nowFull(); writeTab('Customers', CUST_COLS, c);
    log(c.id, whoOf(ctx), 'customer', 'ແກ້ຂໍ້ມູນລູກຄ້າ: ' + c.name + (c.source ? ' · ' + c.source : ''));
    return api_getCRM(ctx);
  });
}
function api_syncSales(ctx) {
  needOwner(ctx);
  const n = withLock(() => syncSalesCore()), o = JSON.parse(api_getCRM(ctx));
  o.msg = 'ດຶງຈາກ Pancake: ອໍເດີ ' + n.orders + ' · ລູກຄ້າ ' + n.customers + ' (ໃໝ່ ' + n.added + ')';
  return JSON.stringify(o);
}
function syncSales() { withLock(() => syncSalesCore()); } // trigger ທຸກຊົ່ວໂມງ
function syncSalesCore() {
  let orders = [], page = 1, r;
  do { r = pancakeFetch('/orders?page_size=100&page_number=' + page + '&option_sort=inserted_at_desc'); orders = orders.concat(r.data || []); page++; }
  while ((r.data || []).length === 100 && page < 30);
  let pcs = []; page = 1;
  do { r = pancakeFetch('/customers?page_size=100&page_number=' + page); pcs = pcs.concat(r.data || []); page++; }
  while ((r.data || []).length === 100 && page < 30);
  const day = s => s ? Utilities.formatDate(new Date(String(s).replace(/(\.\d+)?$/, 'Z')), TZ, 'yyyy-MM-dd') : '';
  // 1) Sales (ສ້າງໃໝ່ທັງແທັບ) + ສະຫຼຸບຕໍ່ລູກຄ້າ
  // ບິນຕໍ່ລູກຄ້າ: ເກັບເປັນລາຍການບິນ (oid) ຕາມ pancakeId ແລະ ຕາມເບີໂທ → ລວມແບບບໍ່ຊ້ຳ ຕອນສະຫຼຸບ
  // ⚠️ ເບີໂທຂອງຮ້ານ (ພະນັກງານໃສ່ແທນລູກຄ້າໃນບາງບິນ) ຫ້າມໃຊ້ຈັບຄູ່ — ບໍ່ດັ່ງນັ້ນບິນຫຼາຍຄົນໄປລວມຢູ່ຄົນດຽວ
  const rows = [], byKey = {}, ocInfo = {};
  orders.forEach(o => {
    const st = String(o.status_name || ''), ok = !NOT_SALE[st], cid = String(o.customer && o.customer.id || o.customer_id || '');
    let ph = normPhone(o.bill_phone_number || (o.customer && (o.customer.phone_numbers || [])[0]) || ''); if (SHOP_PHONES[ph]) ph = '';
    const d = day(o.inserted_at), amt = Math.round(Number(o.total_price_after_sub_discount) || 0), oid = String(o.id);
    [cid ? 'c:' + cid : '', ph.length >= 7 ? 'p:' + ph : ''].filter(Boolean).forEach(key => { (byKey[key] = byKey[key] || {})[oid] = { ok: ok, amt: amt, d: d }; });
    const sa = o.shipping_address || {};
    if (cid && !ocInfo[cid]) ocInfo[cid] = { name: o.bill_full_name || (o.customer && o.customer.name) || '', phone: ph, geo: sa.commune_id || '', addr: sa.full_address || '' };
    (o.items || []).forEach(it => {
      const v = it.variation_info || {}, q = Number(it.quantity) || 0;
      const nm = [v.name, (v.fields || []).map(f => f.value).filter(Boolean).join(' / ')].filter(Boolean).join(' · ');
      rows.push([String(o.id), d, st, cid, ph, String(it.variation_id || v.id || ''), nm, q, Math.round((Number(v.retail_price) || 0) * q - (Number(it.total_discount) || 0))]);
    });
  });
  const s = tabSheet('Sales', SALE_COLS);
  if (s.getLastRow() > 1) s.getRange(2, 1, s.getLastRow() - 1, SALE_COLS.length).clearContent();
  if (rows.length) { const rg = s.getRange(2, 1, rows.length, SALE_COLS.length); rg.setNumberFormat('@'); rg.setValues(rows.map(x => x.map(String))); }
  // 2) Customers: ຈັບຄູ່ pancakeId ຫຼື ເບີໂທ · ຂໍ້ມູນທີ່ເຈົ້າຂອງໃສ່ເອງ (source/sourceNote/note) ບໍ່ຖືກທັບ
  const cs = readCustomers(); let added = 0;
  const attach = (pid, ph, name, addr, geo) => { // ຫາ/ສ້າງລູກຄ້າ ແລ້ວໃສ່ pancakeId (+ ລະຫັດບ້ານ ຈາກທີ່ຢູ່ Pancake)
    if (SHOP_PHONES[ph]) ph = '';
    let c = cs.filter(x => x.pancakeId === pid)[0] || (ph.length >= 7 ? cs.filter(x => x.phone === ph && !x.pancakeId)[0] : null);
    if (!c) { c = { id: newCustId(), name: '', phone: ph, address: '', source: '', sourceNote: '', note: '', createdAt: nowFull() }; cs.push(c); added++; }
    Object.assign(c, { pancakeId: pid, name: c.name || name || '', phone: c.phone || ph, address: c.address || addr || '', geo: c.geo || geo || '' });
  };
  const pids = {};
  pcs.forEach(p => { const adr = (p.shop_customer_addresses || [])[0]; pids[String(p.id)] = 1;
    attach(String(p.id), normPhone((p.phone_numbers || [])[0] || ''), p.name, adr && (adr.full_address || adr.address), adr && adr.commune_id); });
  Object.keys(ocInfo).forEach(cid => { if (!pids[cid]) attach(cid, ocInfo[cid].phone, ocInfo[cid].name, ocInfo[cid].addr, ocInfo[cid].geo); }); // ບິນທີ່ລູກຄ້າບໍ່ຢູ່ໃນລາຍຊື່ Pancake
  // ສະຫຼຸບບິນໃຫ້ທຸກຄົນ (ລວມລູກຄ້າທີ່ສ້າງຈາກແອບວຽກ) = ບິນຕາມ pancakeId ∪ ບິນຕາມເບີໂທ (ບໍ່ຊ້ຳ)
  cs.forEach(c => {
    const all = Object.assign({}, c.pancakeId ? byKey['c:' + c.pancakeId] : null, c.phone && !SHOP_PHONES[c.phone] ? byKey['p:' + c.phone] : null);
    const b = { orders: 0, ok: 0, amount: 0, first: '', last: '' };
    Object.keys(all).forEach(oid => { const x = all[oid]; b.orders++; if (x.ok) { b.ok++; b.amount += x.amt; if (!b.first || x.d < b.first) b.first = x.d; if (!b.last || x.d > b.last) b.last = x.d; } });
    Object.assign(c, { orders: b.orders, okOrders: b.ok, amount: b.amount, firstOrder: b.first, lastOrder: b.last, updatedAt: nowFull() });
    const oi = c.pancakeId && ocInfo[c.pancakeId]; // ທີ່ຢູ່ສົ່ງຂອງບິນລ່າສຸດ (ຖ້າລາຍຊື່ລູກຄ້າບໍ່ມີ)
    if (oi && !c.geo && oi.geo) { c.geo = oi.geo; if (!c.address) c.address = oi.addr; }
  });
  // ລາຍຊື່ເປົ່າທີ່ຊ້ຳ (Pancake ມີລູກຄ້າຊື່ດຽວກັນ 2 ລາຍຊື່ ເຊັ່ນ ເອື້ອຍ ມົນແກ້ວ): ບໍ່ມີເບີ + ບໍ່ມີບິນ + ບໍ່ມີວຽກ + ບໍ່ໄດ້ໃສ່ຂໍ້ມູນເອງ → ເອົາອອກ
  const nm = s => String(s || '').replace(/\s+/g, '').toLowerCase(), hasJob = {};
  readJobs().forEach(j => { if (j.customerId) hasJob[j.customerId] = 1; });
  // ລວມ: ຂໍ້ມູນທີ່ເຈົ້າຂອງໃສ່ໃນລາຍຊື່ເປົ່າ (ແຫຼ່ງ/ຜູ້ແນະນຳ/ໝາຍເຫດ/ທີ່ຢູ່) ຍ້າຍໄປໃສ່ລາຍຊື່ທີ່ມີເບີ ຫຼື ບິນ (ຖ້າບ່ອນນັ້ນຍັງຫວ່າງ)
  const twin = {}; cs.forEach(c => { if ((c.phone || c.orders) && !twin[nm(c.name)]) twin[nm(c.name)] = c; });
  const keep = cs.filter(c => {
    const t = twin[nm(c.name)];
    if (c.phone || c.orders || hasJob[c.id] || !t || t === c) return true;
    ['source', 'sourceNote', 'note', 'address'].forEach(k => { if (!t[k] && c[k]) t[k] = c[k]; });
    return false;
  });
  const sh = tabSheet('Customers', CUST_COLS);
  sh.getRange(1, 1, 1, CUST_COLS.length).setValues([CUST_COLS]); // ຫົວຖັນໃໝ່ (geo)
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, CUST_COLS.length).clearContent();
  if (keep.length) {
    const rg = sh.getRange(2, 1, keep.length, CUST_COLS.length);
    rg.setNumberFormat('@'); rg.setValues(keep.map(c => CUST_COLS.map(k => String(c[k] == null ? '' : c[k]))));
  }
  forget('cust');
  const st = sheet(SH.SET), vals = st.getDataRange().getValues(); let found = false;
  for (let i = 1; i < vals.length; i++) if (String(vals[i][0]) === 'salesSync') { st.getRange(i + 1, 2).setValue(nowFull()); found = true; }
  if (!found) st.appendRow(['salesSync', nowFull()]);
  forget('settings');
  return { orders: orders.length, customers: keep.length, added: added, dup: cs.length - keep.length };
}
/* ກົດ Run 1 ຄັ້ງ: trigger ດຶງອໍເດີ+ລູກຄ້າ Pancake ທຸກຊົ່ວໂມງ + ດຶງຮອບທຳອິດ + ຜູກວຽກເກົ່າກັບລູກຄ້າ */
function setupSalesTrigger() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncSales').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncSales').timeBased().everyHours(1).create();
  const n = withLock(() => syncSalesCore());
  let linked = 0;
  withLock(() => { readJobs().forEach(j => { if (j.phone && !j.customerId) { j.customerId = linkCustomer(j.customer, j.phone, j.location, j.source); if (j.customerId) { writeJob(j); linked++; } } }); });
  Logger.log('✓ ອໍເດີ ' + n.orders + ' · ລູກຄ້າ ' + n.customers + ' (ໃໝ່ ' + n.added + ' · ເອົາລາຍຊື່ເປົ່າທີ່ຊ້ຳອອກ ' + n.dup + ') · ຜູກວຽກເກົ່າ ' + linked);
}
