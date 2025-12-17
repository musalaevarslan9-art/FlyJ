/**
 * Lucky Jet — Crash demo (static)
 * - No backend, no real money.
 * - Balance & history stored in localStorage.
 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmtUsd = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const toNum = (v, fallback = 0) => {
  const x = Number(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : fallback;
};

const LS = {
  balance: 'lj_demo_balance_v1',
  history: 'lj_demo_history_v1',
};

const DEFAULT_BALANCE = 10000;

function loadBalance() {
  const raw = localStorage.getItem(LS.balance);
  const val = raw ? toNum(raw, DEFAULT_BALANCE) : DEFAULT_BALANCE;
  return clamp(val, 0, 1e12);
}

function saveBalance(v) {
  localStorage.setItem(LS.balance, String(v));
}

function loadHistory() {
  const raw = localStorage.getItem(LS.history);
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return arr.slice(0, 30).filter((x) => typeof x === 'number' && x >= 1);
  } catch {}
  return [];
}
function saveHistory(arr) {
  localStorage.setItem(LS.history, JSON.stringify(arr.slice(0, 30)));
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

function modal(title, bodyHtml) {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = bodyHtml;
  $('#modal').classList.add('show');
}
function closeModal() {
  $('#modal').classList.remove('show');
}

function jitterName() {
  const a = ['Nova','Jet','Lucky','Sky','Wolf','Zero','Kite','Echo','Drift','Milo','Niko','Vega','Rex','Ivy','Panda','Frost'];
  const b = ['X','_','-',''];
  const c = ['1','7','11','99','42',''];
  const pick = (x) => x[Math.floor(Math.random() * x.length)];
  return pick(a) + pick(b) + pick(a).slice(0, 2) + pick(c);
}

function crashPoint() {
  // Heavy-tail-ish demo distribution (NOT provably fair; just for UI testing).
  //  - Majority in 1.1x–3x, sometimes bigger.
  const u = Math.random();
  const houseEdge = 0.01;
  const x = (1 - houseEdge) / (1 - u);   // ~ Pareto-like
  const cp = Math.max(1.01, Math.min(250, Math.floor(x * 100) / 100));
  return cp;
}

class BetSlot {
  constructor(slot) {
    this.slot = slot;
    this.amountEl = $(`#amount${slot}`);
    this.autoEl = $(`#auto${slot}`);
    this.btnBet = $(`#btnBet${slot}`);
    this.statusEl = $(`#status${slot}`);
    this.hintEl = $(`#hint${slot}`);
    this.btnHalf = $(`#btnHalf${slot}`);
    this.btnDouble = $(`#btnDouble${slot}`);
    this.card = $(`.bet-card[data-slot="${slot}"]`);

    this.state = 'idle'; // idle | queued | active | cashed | lost
    this.amount = toNum(this.amountEl.value, 100);
    this.auto = null;
    this.cashMultiplier = null;

    this._wire();
    this.render();
  }

  _wire() {
    this.amountEl.addEventListener('input', () => {
      this.amount = clamp(toNum(this.amountEl.value, this.amount), 0, 1e9);
    });
    this.autoEl.addEventListener('input', () => {
      const v = toNum(this.autoEl.value, NaN);
      this.auto = Number.isFinite(v) ? clamp(v, 1.01, 999) : null;
    });

    this.card.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-act]');
      if (!btn) return;
      const act = btn.getAttribute('data-act');
      if (act === 'minus') this.amount = clamp(this.amount - 10, 0, 1e9);
      if (act === 'plus') this.amount = clamp(this.amount + 10, 0, 1e9);
      this.amountEl.value = String(Math.round(this.amount));
      this.render();
    });

    this.btnHalf.addEventListener('click', () => {
      this.amount = Math.max(0, Math.floor(this.amount / 2));
      this.amountEl.value = String(this.amount);
      this.render();
    });
    this.btnDouble.addEventListener('click', () => {
      this.amount = Math.min(1e9, Math.floor(this.amount * 2));
      this.amountEl.value = String(this.amount);
      this.render();
    });

    this.btnBet.addEventListener('click', () => {
      window.engine.onBetClick(this);
    });
  }

  resetForNextRound() {
    if (this.state === 'cashed' || this.state === 'lost') {
      this.state = 'idle';
      this.cashMultiplier = null;
    }
    this.render();
  }

  setState(st, info = {}) {
    this.state = st;
    if ('cashMultiplier' in info) this.cashMultiplier = info.cashMultiplier;
    this.render();
  }

  render() {
    const st = this.state;
    const labelMap = {
      idle: '—',
      queued: 'Готово',
      active: 'В игре',
      cashed: 'Кэшаут',
      lost: 'Сгорело',
    };
    this.statusEl.textContent = labelMap[st] || '—';

    // Button
    if (st === 'active') {
      this.btnBet.textContent = 'Кэшаут';
      this.btnBet.classList.remove('primary');
      this.btnBet.classList.add('danger');
    } else if (st === 'queued') {
      this.btnBet.textContent = 'Отменить';
      this.btnBet.classList.remove('danger');
      this.btnBet.classList.add('primary');
    } else {
      this.btnBet.textContent = 'Сделать ставку';
      this.btnBet.classList.remove('danger');
      this.btnBet.classList.add('primary');
    }

    // Hint
    if (st === 'cashed') {
      this.hintEl.innerHTML = `Выигрыш: <b>${fmtUsd(this.amount * (this.cashMultiplier || 1))}</b>`;
    } else if (st === 'lost') {
      this.hintEl.innerHTML = `Проигрыш: <b>${fmtUsd(this.amount)}</b>`;
    } else if (st === 'active') {
      this.hintEl.innerHTML = `Жмите “Кэшаут” до краша. Авто: ${this.auto ? `<b>${this.auto.toFixed(2)}x</b>` : '—'}`;
    } else if (st === 'queued') {
      this.hintEl.textContent = 'Ставка будет активна со стартом раунда.';
    } else {
      this.hintEl.textContent = this.slot === 'A'
        ? 'Можно поставить в ожидании. Кэшаут — во время полёта.'
        : 'Можно вести две независимые ставки.';
    }
  }
}

class CrashEngine {
  constructor() {
    this.canvas = $('#graph');
    this.ctx = this.canvas.getContext('2d');
    this.scene = $('#scene');
    this.joe = $('#joe');
    this.multValue = $('#multValue');
    this.multSub = $('#multSub');
    this.roundPill = $('#roundPill');
    this.crashOverlay = $('#crashOverlay');
    this.crashValue = $('#crashValue');
    this.historyChips = $('#historyChips');
    this.betsList = $('#betsList');

    this.audBg = $('#audBg');
    this.audFly = $('#audFly');
    this.audBeep = $('#audBeep');
    this.soundDot = $('#soundDot');

    this.soundOn = true;
    this.balance = loadBalance();
    this.history = loadHistory(); // newest first
    this.tab = 'all';

    this.slots = {
      A: new BetSlot('A'),
      B: new BetSlot('B'),
    };

    this.round = {
      state: 'WAITING', // WAITING | RUNNING | CRASHED
      t0: performance.now(),
      waitMs: 4200,
      crashAt: crashPoint(),
      growth: 0.23,
      elapsed: 0,
      multiplier: 1.0,
      maxMultShown: 10,
      points: [],
    };

    this.fakeBets = [];
    this.myBetsLog = []; // last ~30 entries
    this._wireUI();
    this._renderBalance();
    this._renderHistory();
    this._renderList();
    this._resizeCanvas();
    window.addEventListener('resize', () => this._resizeCanvas());

    this._kickAudio();
    requestAnimationFrame((t) => this._loop(t));
  }

  _wireUI() {
    // Tabs
    $$('.tab').forEach((b) => {
      b.addEventListener('click', () => {
        $$('.tab').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        this.tab = b.getAttribute('data-tab');
        this._renderList();
      });
    });

    // Modal / buttons
    const demoPopup = (title) =>
      modal(title, `<p>Это демо‑кнопка. В этой версии нет сервера, депозитов и выводов.</p>
      <p style="color:rgba(255,255,255,.72)">Можно спокойно тестировать UI, анимации, звук и механику ставок.</p>`);

    $('#btnWallet').addEventListener('click', () => demoPopup('Wallet'));
    $('#btnGift').addEventListener('click', () => demoPopup('Gifts'));
    $('#btnLimits').addEventListener('click', () => demoPopup('Limits'));
    $('#btnSupport').addEventListener('click', () => demoPopup('Support'));
    $('#btnLogout').addEventListener('click', () => demoPopup('Logout'));
    $('#btnMenu').addEventListener('click', () => demoPopup('Menu'));

    $('#btnHowTo').addEventListener('click', () => {
      modal('Как играть (демо)', `
        <p><b>Crash</b>: коэффициент растёт, и в случайный момент раунд “крашится”.</p>
        <ul>
          <li>Поставь ставку в ожидании.</li>
          <li>Когда начался полёт — нажми <b>Кэшаут</b> до краша.</li>
          <li>Можно задать <b>Авто‑кэшаут</b>, например 2.00x.</li>
        </ul>
        <div class="htp">
          <img src="./assets/htp1.png" alt="">
          <img src="./assets/htp2.png" alt="">
          <img src="./assets/htp3.png" alt="">
        </div>
      `);
    });

    $('#btnResetBalance').addEventListener('click', () => {
      this.balance = DEFAULT_BALANCE;
      saveBalance(this.balance);
      this._renderBalance();
      toast('Баланс сброшен: $10,000');
    });

    $('#btnSound').addEventListener('click', async () => {
      this.soundOn = !this.soundOn;
      this.soundDot.style.background = this.soundOn ? 'var(--good)' : 'var(--bad)';
      if (!this.soundOn) {
        this.audBg.pause();
        this.audFly.pause();
      } else {
        await this._kickAudio();
        if (this.round.state === 'RUNNING') this.audFly.play().catch(() => {});
      }
      toast(this.soundOn ? 'Звук включён' : 'Звук выключен');
    });

    // Modal closing
    $('#modal').addEventListener('click', (e) => {
      if (e.target.closest('[data-close]')) closeModal();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  async _kickAudio() {
    // iOS requires user gesture; we try, but if blocked, it will start after any click.
    if (!this.soundOn) return;
    try {
      this.audBg.volume = 0.15;
      this.audFly.volume = 0.18;
      this.audBeep.volume = 0.25;
      await this.audBg.play();
    } catch {}
  }

  _resizeCanvas() {
    // Match device pixel ratio for crisp lines
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _renderBalance() {
    $('#balanceValue').textContent = fmtUsd(this.balance);
  }

  _renderHistory() {
    const chips = this.history.slice(0, 12);
    this.historyChips.innerHTML = chips.map((x) => {
      const cls = x < 1.4 ? 'bad' : x < 2.2 ? 'warn' : 'good';
      return `<div class="chip ${cls}">${x.toFixed(2)}x</div>`;
    }).join('');
  }

  _renderList() {
    let rows = [];
    if (this.tab === 'all') rows = this.fakeBets.slice(0, 22);
    if (this.tab === 'top') rows = this._topBets().slice(0, 22);
    if (this.tab === 'my') rows = this.myBetsLog.slice(0, 22);

    this.betsList.innerHTML = rows.map((r) => {
      const cls = r.state === 'won' ? 'good' : r.state === 'lost' ? 'bad' : 'neutral';
      const win = r.state === 'won' ? fmtUsd(r.win) : r.state === 'lost' ? '—' : fmtUsd(r.bet);
      const mult = r.mult ? `${r.mult.toFixed(2)}x` : '—';
      return `
        <div class="row ${cls}">
          <div class="name">${r.name}</div>
          <div class="mult">${mult}</div>
          <div class="win">${win}</div>
        </div>
      `;
    }).join('');
  }

  _topBets() {
    // Top bets by win in last rounds (fake + my)
    const all = [...this.fakeBets, ...this.myBetsLog];
    return all
      .filter((x) => x.state === 'won')
      .sort((a, b) => b.win - a.win);
  }

  onBetClick(slot) {
    const st = this.round.state;

    if (slot.state === 'queued') {
      // cancel queued bet
      slot.setState('idle');
      this.balance += slot.amount;
      saveBalance(this.balance);
      this._renderBalance();
      toast(`Ставка ${slot.slot} отменена`);
      return;
    }

    if (slot.state === 'active') {
      // cash out now
      this._cashOut(slot, this.round.multiplier);
      return;
    }

    // placing bet is allowed only in WAITING
    if (st !== 'WAITING') {
      toast('Ставки принимаются только в ожидании раунда');
      return;
    }

    const amt = Math.floor(clamp(slot.amount, 1, 1e9));
    if (amt <= 0) {
      toast('Введите сумму ставки');
      return;
    }
    if (this.balance < amt) {
      toast('Недостаточно средств (демо)');
      return;
    }

    this.balance -= amt;
    saveBalance(this.balance);
    this._renderBalance();

    slot.amount = amt;
    slot.amountEl.value = String(amt);
    slot.setState('queued');
    toast(`Ставка ${slot.slot} принята: ${fmtUsd(amt)}`);
  }

  _startRound(now) {
    this.round.state = 'RUNNING';
    this.round.t0 = now;
    this.round.elapsed = 0;
    this.round.multiplier = 1.0;
    this.round.crashAt = crashPoint();
    this.round.maxMultShown = Math.max(10, this.round.crashAt);
    this.round.points = [];

    this.crashOverlay.classList.remove('show');

    // Activate queued bets
    Object.values(this.slots).forEach((s) => {
      if (s.state === 'queued') s.setState('active');
      else if (s.state === 'idle') s.setState('idle');
    });

    // Fake bets for list
    this.fakeBets = [];
    const n = 16 + Math.floor(Math.random() * 10);
    for (let i = 0; i < n; i++) {
      const bet = Math.floor(10 + Math.random() * 900);
      this.fakeBets.push({
        name: jitterName(),
        bet,
        state: 'playing',
        mult: null,
        win: bet,
        auto: Math.random() < 0.55 ? clamp(1.2 + Math.random() * 6, 1.05, 12) : null,
      });
    }

    this.roundPill.textContent = 'Раунд идёт…';
    this.multSub.textContent = 'Жмите кэшаут до краша';
    this._renderList();

    if (this.soundOn) {
      this.audBeep.currentTime = 0;
      this.audBeep.play().catch(() => {});
      this.audFly.currentTime = 0;
      this.audFly.play().catch(() => {});
    }
  }

  _crash(now) {
    this.round.state = 'CRASHED';
    this.round.t0 = now;

    const crashAt = this.round.crashAt;
    this.crashValue.textContent = `${crashAt.toFixed(2)}x`;
    this.crashOverlay.classList.add('show');

    // settle bets
    Object.values(this.slots).forEach((s) => {
      if (s.state === 'active') {
        s.setState('lost');
        this.myBetsLog.unshift({ name: 'You', bet: s.amount, mult: crashAt, win: 0, state: 'lost' });
      } else if (s.state === 'cashed') {
        // already logged in cashout
      }
    });

    // settle fake bets (some cash out earlier)
    this.fakeBets = this.fakeBets.map((b) => {
      const auto = b.auto;
      let cash = null;
      if (auto && auto < crashAt) cash = auto;
      else if (Math.random() < 0.35 && 1.1 + Math.random() * 3 < crashAt) cash = 1.1 + Math.random() * 3;
      if (cash) {
        const win = b.bet * cash;
        return { ...b, state: 'won', mult: cash, win };
      }
      return { ...b, state: 'lost', mult: crashAt, win: 0 };
    });

    // history
    this.history.unshift(crashAt);
    this.history = this.history.slice(0, 20);
    saveHistory(this.history);
    this._renderHistory();

    this.roundPill.textContent = 'Краш!';
    this.multSub.textContent = 'Следующий раунд скоро…';

    if (this.soundOn) {
      this.audFly.pause();
      this.audBeep.currentTime = 0;
      this.audBeep.play().catch(() => {});
    }

    this._renderList();

    // Reset bet slots visuals for next round after small delay
    setTimeout(() => {
      Object.values(this.slots).forEach((s) => s.resetForNextRound());
    }, 900);
  }

  _cashOut(slot, atMult) {
    if (slot.state !== 'active') return;
    const m = clamp(atMult, 1.0, 9999);
    slot.setState('cashed', { cashMultiplier: m });
    const win = slot.amount * m;
    this.balance += win;
    saveBalance(this.balance);
    this._renderBalance();

    this.myBetsLog.unshift({ name: 'You', bet: slot.amount, mult: m, win, state: 'won' });
    this.myBetsLog = this.myBetsLog.slice(0, 30);

    toast(`Кэшаут ${slot.slot}: ${m.toFixed(2)}x → ${fmtUsd(win)}`);
    this._renderList();
  }

  _updateAutoCashouts() {
    Object.values(this.slots).forEach((s) => {
      if (s.state !== 'active') return;
      if (s.auto && this.round.multiplier >= s.auto) {
        this._cashOut(s, s.auto);
      }
    });
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.canvas.getBoundingClientRect().width;
    const h = this.canvas.getBoundingClientRect().height;

    ctx.clearRect(0, 0, w, h);

    // subtle grid
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    const stepX = 80, stepY = 60;
    for (let x = 0; x <= w; x += stepX) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y <= h; y += stepY) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    // path
    const pts = this.round.points;
    if (pts.length < 2) return;

    // glow
    ctx.save();
    ctx.lineWidth = 6;
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = '#8a5cff';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.92;
    ctx.strokeStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.restore();
  }

  _updateJoe() {
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;

    const t = this.round.elapsed / 1000;
    const maxT = Math.max(0.25, Math.log(this.round.crashAt) / this.round.growth);
    const p = clamp(t / maxT, 0, 1);
    const logm = Math.log(this.round.multiplier);
    const logMax = Math.log(this.round.maxMultShown);

    const x = 0.08 * w + p * 0.78 * w;
    const yCurve = (logm / logMax) * 0.68 * h;
    const y = 0.78 * h - yCurve - 12 * Math.sin(t * 2.2);

    const angle = clamp(-18 + (logm / logMax) * -12, -35, -8);

    this.joe.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;

    if (this.round.state === 'CRASHED') {
      // tiny shake after crash
      const k = 1 + 2 * Math.sin(performance.now() * 0.06);
      this.joe.style.transform = `translate(${x + k}px, ${y + k}px) rotate(${angle}deg)`;
    }
  }

  _loop(now) {
    const r = this.round;

    if (r.state === 'WAITING') {
      const dt = now - r.t0;
      const left = Math.max(0, r.waitMs - dt);
      const s = Math.ceil(left / 1000);
      this.roundPill.textContent = left > 0 ? `Старт через ${s}s` : 'Старт…';
      this.multValue.textContent = '1.00x';
      this.multSub.textContent = 'Ожидание следующего раунда…';

      // keep joe near start
      r.elapsed = 0;
      r.multiplier = 1.0;
      r.points = [{ x: 90, y: this.canvas.getBoundingClientRect().height * 0.78 }];

      this._draw();
      this._updateJoe();

      if (left <= 0) {
        this._startRound(now);
      }
    }

    if (r.state === 'RUNNING') {
      r.elapsed = now - r.t0;
      const t = r.elapsed / 1000;

      // multiplier growth
      r.multiplier = Math.exp(r.growth * t);
      if (r.multiplier >= r.crashAt) {
        r.multiplier = r.crashAt;
      }

      this.multValue.textContent = `${r.multiplier.toFixed(2)}x`;

      // Add path point
      const rect = this.canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      const maxT = Math.max(0.25, Math.log(r.crashAt) / r.growth);
      const p = clamp(t / maxT, 0, 1);

      const logm = Math.log(r.multiplier);
      const logMax = Math.log(r.maxMultShown);
      const x = 0.08 * w + p * 0.78 * w;
      const y = 0.78 * h - (logm / logMax) * 0.68 * h;

      r.points.push({ x, y });
      if (r.points.length > 240) r.points.shift();

      // Auto cashouts
      this._updateAutoCashouts();

      // Fake list: update some as "won" during run
      for (const b of this.fakeBets) {
        if (b.state !== 'playing') continue;
        if (b.auto && r.multiplier >= b.auto) {
          b.state = 'won';
          b.mult = b.auto;
          b.win = b.bet * b.auto;
        }
      }

      this._draw();
      this._updateJoe();

      if (r.multiplier >= r.crashAt - 1e-9) {
        this._crash(now);
      }
    }

    if (r.state === 'CRASHED') {
      const dt = now - r.t0;
      this.multValue.textContent = `${r.crashAt.toFixed(2)}x`;
      this._draw();
      this._updateJoe();

      if (dt > 1600) {
        r.state = 'WAITING';
        r.t0 = now;
        r.waitMs = 3800 + Math.floor(Math.random() * 1800);
        r.crashAt = crashPoint();
      }
    }

    requestAnimationFrame((t) => this._loop(t));
  }
}

window.engine = new CrashEngine();
