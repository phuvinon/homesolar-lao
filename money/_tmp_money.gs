/**
 * ສະໝຸດລາຍຮັບ-ລາຍຈ່າຍ (ບໍລິສັດ + ສ່ວນຕົວ) · PHUSIRI TRADING (BU02) + ຄອບຄົວ
 * Backend: Google Sheets + Apps Script (ຟຣີ) · ໜ້າຈໍ: GitHub Pages ເອີ້ນ doPost {fn, args}
 * ເບິ່ງຫຼັກການບັນຊີໃນ README.md
 *
 * ສິດ:
 *  - ເຈົ້າຂອງ (PIN) = ເຫັນ/ບັນທຶກ ທັງ 2 ບັນຊີ · ຕັ້ງຄ່າ · ຄຸ້ມຄອງກະເປົາ/ໝວດ/ຜູ້ຊ່ວຍ
 *  - ຜູ້ຊ່ວຍ (PIN ຂອງຕົນ) = ສະເພາະບັນຊີບໍລິສັດ · ແກ້/ລຶບໄດ້ສະເພາະລາຍການຂອງຕົນເອງ ພາຍໃນ 48 ຊມ
 *    ເຊີບເວີບໍ່ສົ່ງຂໍ້ມູນສ່ວນຕົວໃຫ້ຜູ້ຊ່ວຍເລີຍ (ກະເປົາ/ໝວດ/ລາຍການສ່ວນຕົວ ຖືກກັ່ນອອກ ຫຼື ປິດບັງ)
 */
const TZ = 'Asia/Vientiane';
const SHOP_ID = '714977150';
const PANCAKE = 'https://pos.pages.fm/api/v1';
const TX_COLS = ['id', 'date', 'kind', 'book', 'cat', 'wallet', 'toWallet', 'amount', 'note', 'src', 'ref', 'status', 'cost', 'photo', 'by', 'createdAt', 'updatedAt'];
const W_COLS = ['id', 'book', 'name', 'type', 'opening', 'openDate', 'active', 'sort'];
const C_COLS = ['id', 'book', 'kind', 'name', 'grp', 'budget', 'active', 'sort'];
// kind: in = ລາຍຮັບ · out = ລາຍຈ່າຍ · xfer = ໂອນ (wallet → toWallet)
// status: ok · pending (Pancake ລໍຖ້າຢືນຢັນກະເປົາ) · void (ອໍເດີຖືກຍົກເລີກ)

/* ========== API (ໜ້າຈໍ GitHub Pages ເອີ້ນຜ່ານ POST) ========== */
function doPost(e) {
  const API = {
    api_getAll: api_getAll, api_setFirstPin: api_setFirstPin, api_saveTx: api_saveTx, api_delTx: api_delTx,
    api_confirmTx: api_confirmTx, api_saveWallet: api_saveWallet, api_saveCat: api_saveCat, api_saveSettings: api_saveSettings,
    api_uploadBill: api_uploadBill, api_syncNow: api_syncNow
  };
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    if (!API[req.fn]) throw new Error('unknown fn');
    out = { result: API[req.fn].apply(null, Array.isArray(req.args) ? req.args : []) };
  } catch (err) { out = { error: (err && err.message) || String(err) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() {
  return HtmlService.createHtmlOutput('<p style="font-family:sans-serif;padding:20px">ເປີດແອບທີ່: <a href="https://phuvinon.github.io/homesolar-lao/money/">phuvinon.github.io/homesolar-lao/money/</a></p>');
}

/* ========== ພື້ນຖານ ========== */
const _memo = {};
function memo(k, fn) { return Object.prototype.hasOwnProperty.call(_memo, k) ? _memo[k] : (_memo[k] = fn()); }
function forget(k) { delete _memo[k]; }
const SHEET_ID = '1XOJwPo33nKUez5fXNpWh6u5IlqeuRSKg7q5cnTJmYnE'; // Google Sheet: PHUSIRI_MONEY_BOOK (mee50cent)
function ss() { return memo('ss', () => SpreadsheetApp.openById(SHEET_ID)); }
function nowFull() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function today() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function money(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); }
function parseArr(s) { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(15000); try { return fn(); } finally { l.releaseLock(); } }
function fmtD(v) { return Utilities.formatDate(v, TZ, 'yyyy-MM-dd'); }
function newId(p) { return p + Utilities.formatDate(new Date(), TZ, 'yyMMdd') + '-' + Math.random().toString(36).slice(2, 7).toUpperCase(); }

function tab(name, cols) {
  let s = ss().getSheetByName(name);
  if (!s) { s = ss().insertSheet(name); s.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold'); s.setFrozenRows(1); s.getRange(1, 1, s.getMaxRows(), cols.length).setNumberFormat('@'); }
  return s;
}
function readTab(name, cols, nums) {
  const v = tab(name, cols).getDataRange().getValues(), out = [];
  for (let i = 1; i < v.length; i++) {
    if (!v[i][0]) continue;
    const o = { _row: i + 1 };
    cols.forEach((c, k) => { const x = v[i][k]; o[c] = nums.indexOf(c) >= 0 ? (Number(x) || 0) : (x instanceof Date ? fmtD(x) : String(x == null ? '' : x)); });
    out.push(o);
  }
  return out;
}
function writeRow(name, cols, o) {
  const s = tab(name, cols), row = o._row || s.getLastRow() + 1;
  const r = s.getRange(row, 1, 1, cols.length); r.setNumberFormat('@');
  r.setValues([cols.map(c => o[c] == null ? '' : String(o[c]))]); o._row = row;
}
function readTx() { return memo('tx', () => readTab('Tx', TX_COLS, ['amount', 'cost'])); }
function readWallets() { return memo('w', () => readTab('Wallets', W_COLS, ['opening', 'sort']).map(w => { w.active = w.active !== 'FALSE'; return w; })); }
function readCats() { return memo('c', () => readTab('Cats', C_COLS, ['budget', 'sort']).map(c => { c.active = c.active !== 'FALSE'; return c; })); }
function settingsObj() {
  return memo('st', () => { const o = {}; const v = tab('Settings', ['key', 'value']).getDataRange().getValues(); for (let i = 1; i < v.length; i++) if (v[i][0]) o[String(v[i][0])] = String(v[i][1]); return o; });
}
function setSetting(k, val) {
  const s = tab('Settings', ['key', 'value']), v = s.getDataRange().getValues();
  for (let i = 1; i < v.length; i++) if (String(v[i][0]) === k) { s.getRange(i + 1, 2).setNumberFormat('@').setValue(String(val)); forget('st'); return; }
  s.appendRow([k, String(val)]); s.getRange(s.getLastRow(), 2).setNumberFormat('@'); forget('st');
}
function log(who, action, detail) { tab('Log', ['time', 'who', 'action', 'detail']).appendRow([nowFull(), who, action, detail || '']); }

/* ========== ສິດ ========== */
function helpers() { return parseArr(settingsObj().helpers); } // [{name, pin}]
function roleOf(ctx) {
  const pin = String(ctx && ctx.pin || '').trim(), st = settingsObj();
  if (!pin) return null;
  if (st.ownerPin && pin === st.ownerPin) return { role: 'owner', name: 'ເຈົ້າຂອງ' };
  const h = helpers().filter(x => String(x.pin) === pin)[0];
  return h ? { role: 'helper', name: h.name } : null;
}
function need(ctx) { const r = roleOf(ctx); if (!r) throw new Error('PIN ບໍ່ຖືກຕ້ອງ'); return r; }
function needOwner(ctx) { const r = need(ctx); if (r.role !== 'owner') throw new Error('ສະເພາະເຈົ້າຂອງ'); return r; }

/* ========== ອ່ານຂໍ້ມູນທັງໝົດ ========== */
// ຍອດຄົງເຫຼືອ = ຍອດຍົກມາ + ເຂົ້າ − ອອກ (ນັບແຕ່ວັນຍົກຍອດ · ບໍ່ນັບ pending/void)
function balances() {
  const ws = readWallets(), b = {}, from = {};
  ws.forEach(w => { b[w.id] = w.opening; from[w.id] = w.openDate || '0000'; });
  readTx().forEach(t => {
    if (t.status !== 'ok') return;
    const add = (wid, n) => { if (wid in b && t.date >= from[wid]) b[wid] += n; };
    if (t.kind === 'in') add(t.wallet, t.amount);
    else if (t.kind === 'out') add(t.wallet, -t.amount);
    else if (t.kind === 'xfer') { add(t.wallet, -t.amount); add(t.toWallet, t.amount); }
  });
  return b;
}
function api_getAll(ctx) {
  const st = settingsObj();
  if (!st.ownerPin) return JSON.stringify({ needSetup: true });
  const r = need(ctx), owner = r.role === 'owner';
  maybeImportJobs(); // ດຶງການຮັບ-ຈ່າຍເງິນຈາກແອບຕາຕະລາງວຽກ (ສູງສຸດນາທີລະເທື່ອ)
  const ws = readWallets(), wBook = {}; ws.forEach(w => { wBook[w.id] = w.book; });
  const cats = readCats(), bal = balances();
  const since = Utilities.formatDate(new Date(Date.now() - 400 * 864e5), TZ, 'yyyy-MM-dd'); // ~13 ເດືອນ
  let tx = readTx().filter(t => t.date >= since && t.status !== 'void').map(t => { const o = Object.assign({}, t); delete o._row; return o; });
  if (!owner) {
    // ຜູ້ຊ່ວຍ: ເຫັນສະເພາະລາຍການທີ່ແຕະກະເປົາບໍລິສັດ ຫຼື ໝວດບໍລິສັດ · ລາຍການສ່ວນຕົວທີ່ຈ່າຍຈາກກະເປົາບໍລິສັດ = ປິດບັງ
    tx = tx.filter(t => t.book === 'co' || wBook[t.wallet] === 'co' || wBook[t.toWallet] === 'co').map(t => {
      if (t.book === 'me' || (t.kind === 'xfer' && wBook[t.toWallet] !== 'co') || (t.kind === 'xfer' && wBook[t.wallet] !== 'co')) {
        const m = { id: t.id, date: t.date, kind: t.kind, book: t.book, cat: '', wallet: wBook[t.wallet] === 'co' ? t.wallet : '', toWallet: wBook[t.toWallet] === 'co' ? t.toWallet : '',
          amount: t.amount, note: '', src: t.src, ref: '', status: t.status, cost: 0, photo: '', by: t.by, createdAt: t.createdAt, masked: true };
        if (t.kind === 'xfer') m.cat = t.cat; // ຊື່ໝວດໂອນ (ເງິນເດືອນ/ຖອນ) ບໍ່ແມ່ນຄວາມລັບ
        return m;
      }
      return t;
    });
  }
  return JSON.stringify({
    role: r.role, me: r.name, today: today(),
    wallets: ws.filter(w => owner || w.book === 'co').map(w => { const o = Object.assign({}, w); delete o._row; o.balance = bal[w.id] || 0; return o; }),
    cats: cats.filter(c => owner || c.book === 'co' || c.book === 'x').map(c => { const o = Object.assign({}, c); delete o._row; return o; }),
    tx: tx,
    helpers: owner ? helpers().map(h => ({ name: h.name })) : [],
    lastSync: st.lastSync || '', pancakeReady: !!PropertiesService.getScriptProperties().getProperty('PANCAKE_API_KEY')
  });
}
// ເປີດແອບຄັ້ງທຳອິດ: ເຈົ້າຂອງຕັ້ງ PIN ເອງ (ໃຊ້ໄດ້ຄັ້ງດຽວ)
function api_setFirstPin(ctx, pin) {
  return withLock(() => {
    if (settingsObj().ownerPin) throw new Error('ຕັ້ງ PIN ແລ້ວ');
    pin = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(pin)) throw new Error('PIN ຕ້ອງເປັນຕົວເລກ 4–8 ຫຼັກ');
    setSetting('ownerPin', pin); log('ເຈົ້າຂອງ', 'pin', 'ຕັ້ງ PIN ຄັ້ງທຳອິດ');
    return api_getAll({ pin: pin });
  });
}

/* ========== ລາຍການເງິນ ========== */
function canEdit(r, t) {
  if (r.role === 'owner') return true;
  if (t.by !== r.name || t.src === 'pancake') return false;
  const age = Date.now() - new Date(String(t.createdAt).replace(' ', 'T') + ':00+07:00').getTime();
  return age < 48 * 3600e3;
}
function api_saveTx(ctx, d) {
  const r = need(ctx), owner = r.role === 'owner';
  return withLock(() => {
    const ws = readWallets(), cats = readCats();
    const w = id => ws.filter(x => x.id === id)[0];
    const kind = String(d.kind), amount = Math.round(Number(d.amount) || 0);
    if (['in', 'out', 'xfer'].indexOf(kind) < 0) throw new Error('ປະເພດບໍ່ຖືກຕ້ອງ');
    if (amount <= 0) throw new Error('ໃສ່ຈຳນວນເງິນ');
    const c = cats.filter(x => x.id === String(d.cat))[0];
    if (!c || c.kind !== kind) throw new Error('ກະລຸນາເລືອກໝວດ');
    const wa = w(String(d.wallet)); if (!wa) throw new Error('ກະລຸນາເລືອກກະເປົາ');
    let wb = null;
    if (kind === 'xfer') { wb = w(String(d.toWallet)); if (!wb || wb.id === wa.id) throw new Error('ເລືອກກະເປົາປາຍທາງ'); }
    if (!owner) { // ຜູ້ຊ່ວຍ: ກະເປົາບໍລິສັດ + ໝວດບໍລິສັດ/ໂອນ ເທົ່ານັ້ນ (ໂອນຫາສ່ວນຕົວໄດ້ ເຊັ່ນ ຈ່າຍເງິນເດືອນເຈົ້າຂອງ)
      if (wa.book !== 'co') throw new Error('ກະເປົານີ້ບໍ່ອະນຸຍາດ');
      if (c.book === 'me') throw new Error('ໝວດນີ້ບໍ່ອະນຸຍາດ');
    }
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date)) ? String(d.date) : today();
    let t;
    if (d.id) {
      t = readTx().filter(x => x.id === String(d.id))[0]; if (!t) throw new Error('ບໍ່ພົບລາຍການ');
      if (!canEdit(r, t)) throw new Error('ແກ້ລາຍການນີ້ບໍ່ໄດ້');
    } else t = { id: newId('T'), src: 'manual', ref: '', status: 'ok', cost: 0, photo: '', by: r.name, createdAt: nowFull() };
    Object.assign(t, { date: date, kind: kind, book: kind === 'xfer' ? 'x' : c.book, cat: c.id, wallet: wa.id, toWallet: wb ? wb.id : '', amount: amount,
      note: String(d.note || '').trim().slice(0, 300), updatedAt: nowFull() });
    if (t.src === 'pancake' && owner && d.cost != null) t.cost = Math.max(0, Math.round(Number(d.cost) || 0));
    if (t.status === 'pending' && d.confirm) t.status = 'ok';
    writeRow('Tx', TX_COLS, t); forget('tx');
    log(r.name, d.id ? 'edit' : 'add', (kind === 'in' ? '+' : kind === 'out' ? '−' : '⇄') + money(amount) + ' ' + c.name);
    return api_getAll(ctx);
  });
}
function api_delTx(ctx, id) {
  const r = need(ctx);
  return withLock(() => {
    const t = readTx().filter(x => x.id === String(id))[0]; if (!t) return api_getAll(ctx);
    if (!canEdit(r, t)) throw new Error('ລຶບລາຍການນີ້ບໍ່ໄດ້');
    if (t.src === 'pancake') { t.status = 'void'; t.updatedAt = nowFull(); writeRow('Tx', TX_COLS, t); } // ກັນບໍ່ໃຫ້ sync ດຶງກັບມາອີກ
    else ss().getSheetByName('Tx').deleteRow(t._row);
    forget('tx'); log(r.name, 'delete', money(t.amount) + ' ' + t.cat + ' ' + t.date);
    return api_getAll(ctx);
  });
}
// ຢືນຢັນລາຍຮັບ Pancake ທີ່ລໍຖ້າ: ids + ກະເປົາ (ວ່າງ = ໃຊ້ກະເປົາທີ່ແອບແນະນຳ)
function api_confirmTx(ctx, ids, wallet) {
  const r = need(ctx);
  return withLock(() => {
    const ws = readWallets(), set = {}; (ids || []).forEach(i => { set[String(i)] = 1; });
    if (wallet) { const w = ws.filter(x => x.id === wallet)[0]; if (!w || (r.role !== 'owner' && w.book !== 'co')) throw new Error('ກະເປົາບໍ່ຖືກຕ້ອງ'); }
    let n = 0, sum = 0;
    readTx().forEach(t => {
      if (!set[t.id] || t.status !== 'pending') return;
      t.status = 'ok'; if (wallet) t.wallet = wallet; t.updatedAt = nowFull(); writeRow('Tx', TX_COLS, t); n++; sum += t.amount;
    });
    forget('tx'); log(r.name, 'confirm', 'ຢືນຢັນ ' + n + ' ລາຍການ · ' + money(sum));
    return api_getAll(ctx);
  });
}
// ຮູບບິນ/ໃບຮັບເງິນ → Google Drive (ໂຟນເດີ MONEY_BOOK_BILLS)
function api_uploadBill(ctx, id, dataUrl) {
  const r = need(ctx);
  const t0 = readTx().filter(x => x.id === String(id))[0]; if (!t0) throw new Error('ບໍ່ພົບລາຍການ');
  if (!canEdit(r, t0) && !(r.role === 'helper' && t0.by === r.name)) throw new Error('ແນບຮູບບໍ່ໄດ້');
  const m = String(dataUrl || '').match(/^data:(image\/\w+);base64,(.+)$/); if (!m) throw new Error('ໄຟລ໌ບໍ່ຖືກຕ້ອງ');
  const st = settingsObj(); let folder;
  try { folder = DriveApp.getFolderById(st.billFolder); } catch (e) { folder = DriveApp.createFolder('MONEY_BOOK_BILLS'); setSetting('billFolder', folder.getId()); }
  const f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], id + '_' + Date.now() + '.jpg'));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return withLock(() => {
    forget('tx'); const t = readTx().filter(x => x.id === String(id))[0];
    t.photo = f.getId(); t.updatedAt = nowFull(); writeRow('Tx', TX_COLS, t); forget('tx');
    return api_getAll(ctx);
  });
}

/* ========== ຕັ້ງຄ່າ (ເຈົ້າຂອງ) ========== */
function api_saveWallet(ctx, d) {
  const r = needOwner(ctx);
  return withLock(() => {
    const ws = readWallets(); let w = d.id ? ws.filter(x => x.id === d.id)[0] : null;
    if (!w) w = { id: newId('W'), sort: ws.length + 1 };
    if (['co', 'me'].indexOf(d.book) < 0) throw new Error('ເລືອກບັນຊີ');
    if (!String(d.name || '').trim()) throw new Error('ໃສ່ຊື່ກະເປົາ');
    Object.assign(w, { book: d.book, name: String(d.name).trim(), type: String(d.type || 'cash'), opening: Math.round(Number(d.opening) || 0),
      openDate: /^\d{4}-\d{2}-\d{2}$/.test(String(d.openDate)) ? d.openDate : today(), active: d.active === false ? 'FALSE' : 'TRUE' });
    writeRow('Wallets', W_COLS, w); forget('w'); log(r.name, 'wallet', w.name + ' ຍອດຍົກມາ ' + money(w.opening) + ' (' + w.openDate + ')');
    return api_getAll(ctx);
  });
}
function api_saveCat(ctx, d) {
  const r = needOwner(ctx);
  return withLock(() => {
    const cs = readCats(); let c = d.id ? cs.filter(x => x.id === d.id)[0] : null;
    if (!c) {
      if (['co', 'me'].indexOf(d.book) < 0 || ['in', 'out'].indexOf(d.kind) < 0) throw new Error('ເລືອກບັນຊີ/ປະເພດ');
      c = { id: newId('C'), book: d.book, kind: d.kind, grp: d.book === 'co' ? (d.kind === 'in' ? 'other' : 'var') : (d.kind === 'in' ? 'income' : 'living'), sort: cs.length + 1 };
    }
    if (!String(d.name || '').trim()) throw new Error('ໃສ່ຊື່ໝວດ');
    c.name = String(d.name).trim(); c.budget = Math.max(0, Math.round(Number(d.budget) || 0)); c.active = d.active === false ? 'FALSE' : 'TRUE';
    if (d.grp) c.grp = String(d.grp);
    writeRow('Cats', C_COLS, c); forget('c'); log(r.name, 'cat', c.name + ' ງົບ ' + money(c.budget));
    return api_getAll(ctx);
  });
}
// newPin = ປ່ຽນ PIN ເຈົ້າຂອງ · helpers = [{name, pin}] (pin ວ່າງ = ໃຊ້ PIN ເກົ່າຂອງຄົນນັ້ນ)
function api_saveSettings(ctx, d) {
  const r = needOwner(ctx);
  return withLock(() => {
    let pin = ctx.pin;
    if (d.newPin) { if (!/^\d{4,8}$/.test(String(d.newPin))) throw new Error('PIN ຕ້ອງເປັນຕົວເລກ 4–8 ຫຼັກ'); pin = String(d.newPin); setSetting('ownerPin', pin); log(r.name, 'pin', 'ປ່ຽນ PIN ເຈົ້າຂອງ'); }
    if (Array.isArray(d.helpers)) {
      const old = {}; helpers().forEach(h => { old[h.name] = h.pin; });
      const list = d.helpers.map(h => ({ name: String(h.name || '').trim(), pin: String(h.pin || old[String(h.name || '').trim()] || '').trim() })).filter(h => h.name);
      list.forEach(h => { if (!/^\d{4,8}$/.test(h.pin)) throw new Error('PIN ຂອງ ' + h.name + ' ຕ້ອງເປັນຕົວເລກ 4–8 ຫຼັກ'); if (h.pin === pin) throw new Error('PIN ຜູ້ຊ່ວຍຫ້າມຊ້ຳກັບເຈົ້າຂອງ'); });
      setSetting('helpers', JSON.stringify(list)); log(r.name, 'helpers', list.map(h => h.name).join(', '));
    }
    return api_getAll({ pin: pin });
  });
}

/* ========== Pancake → ລາຍຮັບຂາຍ (ອັດຕະໂນມັດ) ==========
   ອໍເດີສະຖານະ received_money (16) → 1 ແຖວ (ref = ເລກອໍເດີ) · ຈຳນວນ = total_price_after_sub_discount (ຫຼັງຫັກສ່ວນຫຼຸດ)
   ຕົ້ນທຶນ = Σ last_imported_price × quantity · ວັນທີ = ມື້ທີ່ປ່ຽນເປັນ "ຮັບເງິນແລ້ວ" · ສະຖານະ pending ຈົນກວ່າຈະຢືນຢັນກະເປົາ */
function api_syncNow(ctx) { need(ctx); const n = withLock(() => syncPancakeCore()), k = withLock(() => importJobsCore()); const o = JSON.parse(api_getAll(ctx)); o.syncMsg = 'Pancake: ໃໝ່ ' + n.added + ' · ຍົກເລີກ ' + n.voided + ' · ແອບວຽກ: ໃໝ່ ' + k; return JSON.stringify(o); }
function syncPancake() { withLock(() => syncPancakeCore()); try { withLock(() => importJobsCore()); } catch (e) { log('ແອບວຽກ', 'error', e.message); } } // trigger ທຸກຊົ່ວໂມງ
function syncPancakeCore() {
  const key = PropertiesService.getScriptProperties().getProperty('PANCAKE_API_KEY');
  if (!key) throw new Error('ຍັງບໍ່ໄດ້ໃສ່ PANCAKE_API_KEY ໃນ Script Properties');
  const ws = readWallets(), cats = readCats();
  const cash = (ws.filter(w => w.book === 'co' && w.type === 'cash')[0] || {}).id || '';
  const bank = (ws.filter(w => w.book === 'co' && w.type === 'bank')[0] || {}).id || cash;
  const salesCat = (cats.filter(c => c.book === 'co' && c.grp === 'sales')[0] || {}).id;
  if (!salesCat || !cash) throw new Error('ບໍ່ພົບໝວດ "ຍອດຂາຍ" ຫຼື ກະເປົາບໍລິສັດ');
  const have = {}; readTx().forEach(t => { if (t.src === 'pancake') have[t.ref] = t; });
  // ອໍເດີກ່ອນວັນຍົກຍອດກະເປົາ = ປະຫວັດ (ok ທັນທີ ເພື່ອວິເຄາະກຳໄລຍ້ອນຫຼັງ · ບໍ່ກະທົບຍອດກະເປົາ) · ຫຼັງຈາກນັ້ນ = pending ລໍຢືນຢັນ
  const histBefore = ws.filter(w => w.book === 'co').map(w => w.openDate || '').sort()[0] || today();
  const rows = []; let voided = 0;
  for (let p = 1; p <= 3; p++) {
    const res = UrlFetchApp.fetch(PANCAKE + '/shops/' + SHOP_ID + '/orders?api_key=' + encodeURIComponent(key) + '&page_size=100&page_number=' + p + '&option_sort=inserted_at_desc', { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('Pancake ຕອບ ' + res.getResponseCode());
    const data = (JSON.parse(res.getContentText()).data) || [];
    data.forEach(o => {
      const ref = String(o.id), got = o.status_name === 'received_money' || Number(o.status) === 16;
      const t = have[ref];
      if (got && !t) {
        const h = (o.status_history || []).filter(x => Number(x.status) === 16).pop();
        const when = h && h.updated_at ? new Date(String(h.updated_at).replace(/(\.\d+)?$/, 'Z')) : new Date(String(o.updated_at || o.inserted_at).replace(/(\.\d+)?$/, 'Z'));
        const amount = Math.round(Number(o.total_price_after_sub_discount) || (Number(o.total_price) - Number(o.total_discount)) || 0);
        const cost = (o.items || []).reduce((a, it) => { const v = it.variation_info || {}, q = Number(it.quantity) || 0;
          return a + (Number(v.last_imported_price) ? Number(v.last_imported_price) * q : Number(v.avg_price) ? Number(v.avg_price) * q : Number(v.exact_price) || 0); }, 0);
        const sug = Number(o.cash) > 0 && Number(o.cash) >= Number(o.transfer_money || 0) ? cash : bank; // ແນະນຳ: ເງິນສົດ ຖ້າໃສ່ cash · ນອກນັ້ນ BCEL
        const name = o.bill_full_name || (o.customer && o.customer.name) || '';
        rows.push({ id: newId('P'), date: Utilities.formatDate(when, TZ, 'yyyy-MM-dd'), kind: 'in', book: 'co', cat: salesCat, wallet: sug, toWallet: '',
          amount: amount, note: 'Pancake ' + ref + (name ? ' · ' + name : '') + ' · ' + (o.items || []).length + ' ລາຍການ', src: 'pancake', ref: ref,
          status: Utilities.formatDate(when, TZ, 'yyyy-MM-dd') < histBefore ? 'ok' : 'pending', cost: Math.round(cost), photo: '', by: 'Pancake', createdAt: nowFull(), updatedAt: nowFull() });
        have[ref] = rows[rows.length - 1];
      } else if (!got && t && t.status === 'pending' && o.status_name === 'canceled') {
        t.status = 'void'; t.updatedAt = nowFull(); writeRow('Tx', TX_COLS, t); voided++;
      }
    });
    if (data.length < 100) break;
  }
  if (rows.length) {
    const s = tab('Tx', TX_COLS), start = s.getLastRow() + 1;
    const rg = s.getRange(start, 1, rows.length, TX_COLS.length); rg.setNumberFormat('@');
    rg.setValues(rows.map(o => TX_COLS.map(c => String(o[c] == null ? '' : o[c]))));
  }
  forget('tx'); setSetting('lastSync', nowFull());
  if (rows.length || voided) log('Pancake', 'sync', 'ໃໝ່ ' + rows.length + ' · ຍົກເລີກ ' + voided);
  return { added: rows.length, voided: voided };
}

/* ========== ຕິດຕັ້ງຄັ້ງທຳອິດ (ກົດ Run ໃນ Apps Script) ========== */
function setup() {
  tab('Tx', TX_COLS); tab('Log', ['time', 'who', 'action', 'detail']); tab('Settings', ['key', 'value']);
  if (!readWallets().length) {
    [['co', '💵 ເງິນສົດຮ້ານ', 'cash'], ['co', '🏦 BCEL ບໍລິສັດ', 'bank'], ['me', '💵 ເງິນສົດສ່ວນຕົວ', 'cash'], ['me', '🏦 ບັນຊີສ່ວນຕົວ', 'bank']]
      .forEach((w, i) => writeRow('Wallets', W_COLS, { id: 'W' + (i + 1), book: w[0], name: w[1], type: w[2], opening: 0, openDate: today(), active: 'TRUE', sort: i + 1 }));
    forget('w');
  }
  if (!readCats().length) {
    // ໝວດເລີ່ມຕົ້ນ ເອົາຈາກ CASH_LEDGER.md (B ຄ່າຄົງທີ່, C.1 ຄອບຄົວ, D ຜັນແປ) · ງົບ = ຕົວເລກຈິງໃນ ledger
    const C = [
      ['co', 'in', '🛒 ຍອດຂາຍ (Pancake)', 'sales', 0], ['co', 'in', '🔧 ລາຍຮັບວຽກຕິດຕັ້ງ/ຮົ້ວ', 'sales', 0], ['co', 'in', '➕ ລາຍຮັບອື່ນ', 'other', 0],
      ['co', 'in', '🤝 ເງິນກູ້ຢືມເຂົ້າ', 'loan', 0],
      ['co', 'out', '🏠 ຄ່າເຊົ່າຮ້ານ', 'fixed', 3750000], ['co', 'out', '💡 ຄ່າໄຟ+ນ້ຳ ຮ້ານ', 'fixed', 1500000], ['co', 'out', '👷 ເງິນເດືອນພະນັກງານ', 'fixed', 0],
      ['co', 'out', '📱 ຜ່ອນໂທລະສັບ', 'fixed', 1627000], ['co', 'out', '🚚 ຜ່ອນລົດຮ້ານ', 'fixed', 2695218],
      ['co', 'out', '📦 ຄ່າສົ່ງເຄື່ອງ', 'var', 0], ['co', 'out', '🎁 ຄ່າແພັກ/ຫີບຫໍ່', 'var', 0], ['co', 'out', '📣 ຄ່າໂຄສະນາ', 'var', 0],
      ['co', 'out', '🛠️ ຄ່າຊ່າງຈ້າງຄັ້ງຄາວ', 'var', 0], ['co', 'out', '⛽ ນ້ຳມັນ/ເດີນທາງ', 'var', 0], ['co', 'out', '💸 ດອກເບ້ຍເງິນກູ້', 'var', 0],
      ['co', 'out', '📌 ຄ່າໃຊ້ຈ່າຍອື່ນ', 'var', 0],
      ['co', 'out', '🏭 ຊື້ສິນຄ້າ/ຈ່າຍຊັບພລາຍ', 'stock', 0], ['co', 'out', '↩️ ຈ່າຍຄືນເງິນກູ້ (ຕົ້ນ)', 'debt', 0],
      ['me', 'in', '💼 ລາຍຮັບອື່ນ', 'income', 0],
      ['me', 'out', '🧹 ຄ່າແມ່ບ້ານ', 'family', 4000000], ['me', 'out', '👴 ຄ່າຜູ້ດູແລພໍ່', 'family', 2000000], ['me', 'out', '💡 ຄ່າໄຟ+ນ້ຳ ບ້ານ', 'family', 2500000],
      ['me', 'out', '🍼 ນົມ+ຂອງໃຊ້ລູກ', 'family', 4000000], ['me', 'out', '🍚 ອາຫານ/ຕະຫຼາດ', 'living', 0], ['me', 'out', '⛽ ເດີນທາງ/ນ້ຳມັນ', 'living', 0],
      ['me', 'out', '🏥 ສຸຂະພາບ', 'living', 0], ['me', 'out', '🎓 ການສຶກສາ', 'living', 0], ['me', 'out', '🙏 ບຸນ/ສັງຄົມ', 'living', 0],
      ['me', 'out', '🛍️ ຊື້ຂອງສ່ວນຕົວ', 'living', 0], ['me', 'out', '📌 ອື່ນໆ', 'living', 0],
      ['x', 'xfer', '💰 ເງິນເດືອນເຈົ້າຂອງ+ເມຍ', 'salary', 10000000], ['x', 'xfer', '🏧 ຖອນໃຊ້ສ່ວນຕົວ', 'draw', 0],
      ['x', 'xfer', '🔁 ໂອນລະຫວ່າງກະເປົາ', 'internal', 0], ['x', 'xfer', '💵 ເອົາເງິນສ່ວນຕົວໃສ່ບໍລິສັດ', 'capital', 0]
    ];
    C.forEach((c, i) => writeRow('Cats', C_COLS, { id: 'C' + (i + 1), book: c[0], kind: c[1], name: c[2], grp: c[3], budget: c[4], active: 'TRUE', sort: i + 1 }));
    forget('c');
  }
  Logger.log('✓ ຕິດຕັ້ງແລ້ວ — ຕໍ່ໄປ: ໃສ່ PANCAKE_API_KEY ໃນ Script Properties ແລ້ວ Run setupTriggers');
}
function setupTriggers() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncPancake').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncPancake').timeBased().everyHours(1).create();
  const n = withLock(() => syncPancakeCore());
  Logger.log('✓ ດຶງ Pancake ທຸກຊົ່ວໂມງ · ຄັ້ງນີ້ໃໝ່ ' + n.added + ' ລາຍການ');
}

/* ========== ແອບຕາຕະລາງວຽກ → ສະໝຸດເງິນ (ອັດຕະໂນມັດ · 2026-10-22) ==========
   ອ່ານແທັບ Payments ຂອງ Sheet HOME_SOLAR_JOB_SCHEDULE (ບັນຊີ mee50cent ດຽວກັນ → ບໍ່ຕ້ອງໃຊ້ລະຫັດ)
   ນຳເຂົ້າ: ຈ່າຍໃບສັ່ງຊື້ (src=po → ລາຍຈ່າຍ "ຊື້ສິນຄ້າ") + ເງິນຮັບວຽກຮົ້ວ (fence=TRUE → ລາຍຮັບ "ວຽກຕິດຕັ້ງ/ຮົ້ວ")
   ເງິນວຽກດອກໄຟ ບໍ່ນຳເຂົ້າ — ເຂົ້າຜ່ານ Pancake ແລ້ວ (ເຈົ້າຂອງຢືນຢັນ 2026-10-22: ເປີດບິນ Pancake ທຸກວຽກ)
   1 ແຖວ = 1 ລາຍການ (ref = id ແຖວ Payments) · pending ລໍຢືນຢັນກະເປົາ · amount ຕິດລົບ = ແກ້ຍອດລົງ */
const JOBS_SHEET_ID = '1aZpud-C6_VgD8MQWM5US3at3ESB9toA_aRyIR5bk5_o';
function maybeImportJobs() {
  const last = Number(settingsObj().lastJobsImport || 0);
  if (Date.now() - last < 60000) return;
  try { withLock(() => importJobsCore()); } catch (e) { /* ບໍ່ໃຫ້ໜ້າຈໍລົ້ມເພາະແອບວຽກ */ }
}
function importJobsCore() {
  setSetting('lastJobsImport', String(Date.now()));
  const sh = SpreadsheetApp.openById(JOBS_SHEET_ID).getSheetByName('Payments');
  if (!sh || sh.getLastRow() < 2) return 0;
  const v = sh.getDataRange().getValues(), H = v[0].map(String), col = k => H.indexOf(k);
  const ws = readWallets(), cats = readCats();
  const bank = (ws.filter(w => w.book === 'co' && w.type === 'bank' && w.active)[0] || ws.filter(w => w.book === 'co')[0] || {}).id;
  const catIn = (cats.filter(c => c.book === 'co' && c.kind === 'in' && /ຮົ້ວ|ຕິດຕັ້ງ/.test(c.name))[0] || cats.filter(c => c.book === 'co' && c.kind === 'in' && c.grp === 'sales')[0] || {}).id;
  const catOut = (cats.filter(c => c.book === 'co' && c.kind === 'out' && c.grp === 'stock')[0] || {}).id;
  if (!bank || !catIn || !catOut) throw new Error('ບໍ່ພົບກະເປົາ/ໝວດ ສຳລັບນຳເຂົ້າ');
  const have = {}; readTx().forEach(t => { if (t.src === 'jobs') have[t.ref] = 1; });
  const histBefore = ws.filter(w => w.book === 'co').map(w => w.openDate || '').sort()[0] || today(); // ກ່ອນວັນຍົກຍອດ = ປະຫວັດ (ok · ບໍ່ກະທົບຍອດກະເປົາ)
  const rows = [];
  for (let i = 1; i < v.length; i++) {
    const g = k => v[i][col(k)], id = String(g('id') || '');
    if (!id || have[id]) continue;
    const src = String(g('src')), fence = String(g('fence')).toUpperCase() === 'TRUE', kind = String(g('kind'));
    if (!(src === 'po' && kind === 'out') && !(fence && kind === 'in')) continue; // ວຽກດອກໄຟ → ຜ່ານ Pancake
    const amount = Math.round(Number(g('amount')) || 0); if (!amount) continue;
    const d = g('date'), date = d instanceof Date ? Utilities.formatDate(d, TZ, 'yyyy-MM-dd') : String(d).slice(0, 10);
    const party = String(g('party') || ''), note = String(g('note') || '');
    rows.push({ id: newId('J'), date: date, kind: kind, book: 'co', cat: kind === 'in' ? catIn : catOut, wallet: bank, toWallet: '', amount: amount,
      note: '📋 ' + (kind === 'out' ? 'ຈ່າຍ ' + (party || 'ຜູ້ສະໜອງ') : party) + (note ? ' · ' + note : '') + (amount < 0 ? ' · ⚠️ ແກ້ຍອດລົງ' : ''),
      src: 'jobs', ref: id, status: date < histBefore ? 'ok' : 'pending', cost: 0, photo: '', by: String(g('by') || 'ແອບວຽກ'), createdAt: nowFull(), updatedAt: nowFull() });
    have[id] = 1;
  }
  if (rows.length) {
    const s = tab('Tx', TX_COLS), start = s.getLastRow() + 1, rg = s.getRange(start, 1, rows.length, TX_COLS.length);
    rg.setNumberFormat('@'); rg.setValues(rows.map(o => TX_COLS.map(c => String(o[c] == null ? '' : o[c]))));
    forget('tx'); log('ແອບວຽກ', 'import', 'ໃໝ່ ' + rows.length + ' ລາຍການ');
  }
  return rows.length;
}
