/**
 * ABCL CORE — core.js
 * Offline queue · Sync engine · Toast · IDs únicos · Storage helpers
 * Importado por todas as páginas que precisam de persistência real.
 */

// ════════════════════════════════════════════════
// CONFIG — edite aqui para apontar suas APIs
// ════════════════════════════════════════════════
const ABCL_CONFIG = {
  SALES_API:  'https://script.google.com/macros/s/AKfycbwjuO3o0J2e7hrGcwzjbtEDBk_IOHw_eHullk8pR6EAtduvpxaNwAaduf1OBJG5fFl0/exec',
  FORMS_API:  'https://script.google.com/macros/s/AKfycbxM5wW6zGEcZig-lwhAvS2TFXg3ipiH_5VVpyhWQiCRpq4X4Fw1gPcQPw2fBcxoGiE/exec',
  EVENT_NAME: '13º Acampamento Bíblico ABCL',
  MAX_RETRY:  5,
};

// ════════════════════════════════════════════════
// DEVICE ID — persiste por dispositivo
// ════════════════════════════════════════════════
const DeviceID = (() => {
  const KEY = 'abcl-device-id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    const short = Math.random().toString(36).slice(2,6).toUpperCase();
    id = 'DEV-' + short;
    localStorage.setItem(KEY, id);
  }
  return { get: () => id, set: (v) => { localStorage.setItem(KEY, v); id = v; } };
})();

// ════════════════════════════════════════════════
// ID GENERATOR — formato ABCL-DATE-DEVICE-SEQ
// ════════════════════════════════════════════════
const IDGen = (() => {
  let seq = parseInt(localStorage.getItem('abcl-seq') || '0');
  function next() {
    seq++;
    localStorage.setItem('abcl-seq', seq);
    const d   = new Date();
    const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
    const dev  = DeviceID.get().replace(/[^A-Z0-9]/g,'');
    return `ABCL-${date}-${dev}-${String(seq).padStart(4,'0')}`;
  }
  return { next };
})();

// ════════════════════════════════════════════════
// STORAGE — get / set / remove com JSON
// ════════════════════════════════════════════════
const Store = {
  get:    (k)    => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set:    (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  remove: (k)    => localStorage.removeItem(k),
  push:   (k, v) => { const arr = Store.get(k) || []; arr.push(v); Store.set(k, arr); },
  update: (k, id, patch) => {
    const arr = Store.get(k) || [];
    const i   = arr.findIndex(x => x.id === id);
    if (i !== -1) arr[i] = { ...arr[i], ...patch, updatedAt: new Date().toISOString() };
    Store.set(k, arr);
    return i !== -1;
  },
};

// ════════════════════════════════════════════════
// OFFLINE QUEUE — operações pendentes de sync
// ════════════════════════════════════════════════
const Queue = {
  KEY: 'abcl-queue',

  add(type, payload) {
    const item = {
      qid:       IDGen.next(),
      type,
      payload,
      retries:   0,
      createdAt: new Date().toISOString(),
    };
    Store.push(this.KEY, item);
    SyncEngine.updateIndicator();
    return item;
  },

  getAll()   { return Store.get(this.KEY) || []; },
  count()    { return this.getAll().length; },
  remove(qid){ Store.set(this.KEY, this.getAll().filter(x => x.qid !== qid)); },

  incrementRetry(qid) {
    const q = this.getAll();
    const i = q.findIndex(x => x.qid === qid);
    if (i !== -1) { q[i].retries++; Store.set(this.KEY, q); }
  },
};

// ════════════════════════════════════════════════
// SYNC ENGINE — processa queue quando online
// ════════════════════════════════════════════════
const SyncEngine = {
  running: false,

  async process() {
    if (this.running || !navigator.onLine) return;
    const items = Queue.getAll();
    if (!items.length) { this.updateIndicator(); return; }

    this.running = true;
    this.updateIndicator();

    for (const item of items) {
      if (item.retries >= ABCL_CONFIG.MAX_RETRY) {
        Queue.remove(item.qid);
        Toast.err(`Operação ${item.qid} descartada após ${ABCL_CONFIG.MAX_RETRY} tentativas.`);
        continue;
      }

      try {
        await this.dispatch(item);
        Queue.remove(item.qid);
        console.log('[ABCL SYNC] ok:', item.qid);
      } catch (e) {
        Queue.incrementRetry(item.qid);
        console.warn('[ABCL SYNC] fail:', item.qid, e);
        break; // stop FIFO, try again later
      }
    }

    this.running = false;
    this.updateIndicator();
    const remaining = Queue.count();
    if (remaining === 0) Toast.ok('✓ Dados sincronizados com Google Sheets');
  },

  async dispatch(item) {
    const url = item.type.startsWith('sale') ? ABCL_CONFIG.SALES_API : ABCL_CONFIG.FORMS_API;
    const res  = await fetch(url, {
      method: 'POST',
      mode: 'no-cors', // Apps Script requer no-cors
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: item.type, data: item.payload }),
    });
    // no-cors sempre retorna opaque — consideramos sucesso
    return res;
  },

  updateIndicator() {
    const count = Queue.count();
    const online = navigator.onLine;

    // Atualiza todos os elementos .sync-status na página
    document.querySelectorAll('.sync-status').forEach(el => {
      const dot = el.querySelector('.sync-dot');
      const txt = el.querySelector('.sync-text');
      if (!dot) return;

      if (!online)      { dot.className = 'sync-dot offline'; if (txt) txt.textContent = 'Offline'; }
      else if (count>0) { dot.className = 'sync-dot pending'; if (txt) txt.textContent = `${count} pendente${count>1?'s':''}`; }
      else              { dot.className = 'sync-dot';         if (txt) txt.textContent = 'Sincronizado'; }
    });

    // Badge no DOM
    document.querySelectorAll('.sync-badge').forEach(el => {
      el.textContent = count > 0 ? count : '';
      el.style.display = count > 0 ? 'inline-flex' : 'none';
    });

    // Body class
    document.body.classList.toggle('offline', !online);
  },

  init() {
    window.addEventListener('online',  () => { this.updateIndicator(); Toast.ok('🌐 Internet restaurada — sincronizando...'); this.process(); });
    window.addEventListener('offline', () => { this.updateIndicator(); Toast.warn('📵 Sem internet — operando offline'); });
    this.updateIndicator();

    // Tenta sync a cada 30 segundos
    setInterval(() => this.process(), 30_000);
  },
};

// ════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════
const Toast = (() => {
  function getContainer() {
    let c = document.querySelector('.toast-container');
    if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
    return c;
  }

  function show(msg, type = 'ok', duration = 3000) {
    const icons = { ok: '✓', warn: '⚠', err: '✕', info: 'ℹ' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type]||'•'}</span><span>${msg}</span>`;
    getContainer().appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut .3s ease forwards';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  return {
    ok:   (m, d) => show(m, 'ok',   d),
    warn: (m, d) => show(m, 'warn', d),
    err:  (m, d) => show(m, 'err',  d),
    info: (m, d) => show(m, 'info', d),
  };
})();

// ════════════════════════════════════════════════
// AUTH — sessão simples
// ════════════════════════════════════════════════
const Auth = {
  USERS: {
    'naasson': 'abcl2026',
    'haniel':  'abcl2026',
    'mauri':   'abcl2026',
    'caixa':   'vendinha',
    'admin':   'abcl@admin',
  },

  login(user, pass) {
    const u = user.trim().toLowerCase();
    if (this.USERS[u] && this.USERS[u] === pass) {
      sessionStorage.setItem('abcl-session', JSON.stringify({ user: u, at: Date.now() }));
      return true;
    }
    return false;
  },

  logout() { sessionStorage.removeItem('abcl-session'); },

  session() {
    try { return JSON.parse(sessionStorage.getItem('abcl-session')); } catch { return null; }
  },

  check(redirectTo = 'login.html') {
    if (!this.session()) { window.location.href = redirectTo; return false; }
    return true;
  },
};

// ════════════════════════════════════════════════
// MODAIS — helper genérico
// ════════════════════════════════════════════════
const Modal = {
  open(id)  { document.getElementById(id)?.classList.add('open'); },
  close(id) { document.getElementById(id)?.classList.remove('open'); },
  closeAll() { document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open')); },
};

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) Modal.closeAll();
});

// ════════════════════════════════════════════════
// FORMATOS — helpers de apresentação
// ════════════════════════════════════════════════
const Fmt = {
  brl:  (v) => `R$ ${Number(v||0).toFixed(2).replace('.',',')}`,
  date: (s) => s ? new Date(s).toLocaleDateString('pt-BR') : '—',
  time: (s) => s ? new Date(s).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—',
  short: (s, n=28) => s && s.length > n ? s.slice(0, n) + '…' : (s || '—'),
};

// ════════════════════════════════════════════════
// INIT GLOBAL
// ════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  SyncEngine.init();

  // Botões de sync manual
  document.querySelectorAll('[data-sync]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!navigator.onLine) { Toast.warn('Sem internet no momento.'); return; }
      Toast.info('Sincronizando...');
      SyncEngine.process();
    });
  });

  // Device ID nas labels
  document.querySelectorAll('[data-device-id]').forEach(el => {
    el.textContent = DeviceID.get();
  });
});
