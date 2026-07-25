// Room screen: handles lobby / playing / finished states, driven by socket
// events. Server-authoritative — this view only reflects server state.
import { el, button, input, card, heading, mount, toast } from '../ui.js';
import { socket, Events, setGameConfig, startGame, submitAnswer, submitCode, leaveRoom, on, fetchCategories, fetchCodes } from '../api.js';
import { navigate } from '../main.js';
import { CODES } from '../../../shared/codes.js';
import { renderSymbol, renderPalette as renderCodePalette } from '../codes/glyphs.js';
import { renderCategoryPicker, categoriesToParam, paramToCategories } from '../components/categoryPicker.js';

let roomId = null;
let myName = '';
let unsubs = [];
let timerHandle = null;
let categories = [];
let codeList = [];

// Current view state
let roomState = null;
let question = null; // QUESTION_SHOW payload
let result = null; // ANSWER_RESULT | QUESTION_TIMEOUT payload (reveal)

// Lobby form values (preserved across re-renders triggered by ROOM_STATE).
let lobbyForm = { mode: 'mcq', category: 'all', code: 'morse', drillMode: 'choice', questionCount: 10, points: 10, penalty: 10, secondsPerQuestion: 20 };

export async function renderRoom(id) {
  roomId = id.toUpperCase();
  myName = localStorage.getItem('name') || 'Pemain';
  cleanup();
  if (!categories.length) {
    try { categories = await fetchCategories(); } catch { /* non-fatal */ }
  }
  if (!codeList.length) {
    try { codeList = await fetchCodes(); } catch { /* non-fatal */ }
  }
  subscribe();
  // Ask the server for the current room state (we may have missed the
  // initial broadcast that fired during room:create/room:join).
  socket.emit(Events.ROOM_SYNC);
  renderLoading();
}

function cleanup() {
  unsubs.forEach((u) => u());
  unsubs = [];
  stopTimer();
  result = null;
  question = null;
}

// Tear down room screen when navigating away.
export function cleanupRoom() {
  cleanup();
  roomState = null;
}

function subscribe() {
  unsubs.push(on(Events.ROOM_STATE, (snap) => { roomState = snap; render(); }));
  unsubs.push(on(Events.QUESTION_SHOW, (q) => { question = q; result = null; startTimer(q.seconds); render(); }));
  unsubs.push(on(Events.ANSWER_RESULT, (r) => { stopTimer(); applyScores(r.scores); result = r; render(); }));
  unsubs.push(on(Events.QUESTION_TIMEOUT, (r) => { stopTimer(); applyScores(r.scores); result = { timeout: true, ...r }; render(); }));
  unsubs.push(on(Events.GAME_END, (payload) => { stopTimer(); applyScores(payload.scores); result = { gameEnd: true, ...payload }; render(); }));
  unsubs.push(on(Events.ERROR, (e) => toast(e?.message || 'Terjadi kesalahan')));
}

// Merge freshly-scored values from an answer/timeout/end payload into the
// local room snapshot (the server only sends ROOM_STATE on lobby changes,
// not after every answer, so we keep scores current from these payloads).
function applyScores(scores) {
  if (!roomState || !Array.isArray(scores)) return;
  for (const s of scores) {
    const p = roomState.players.find((pl) => pl.name === s.name);
    if (p) p.score = s.score;
  }
}

// ---- Render dispatch ----
function render() {
  if (!roomState) return renderLoading();
  if (roomState.status === 'lobby') return renderLobby();
  if (roomState.status === 'playing') return renderGame();
  if (roomState.status === 'finished') return renderFinished();
}

function renderLoading() {
  mount(el('div', { class: 'max-w-2xl mx-auto px-4 py-24 text-center text-slate-500' }, 'Menghubungkan ke ruangan...'));
}

function isHost() {
  return roomState?.hostSocketId === socket.id;
}

function me() {
  return roomState?.players.find((p) => p.name === myName);
}

// ---- Lobby ----
function renderLobby() {
  const host = isHost();
  const players = roomState.players;
  const cfg = roomState.config; // server's current config (if host already saved)

  // Seed form from server config if present, else keep lobbyForm.
  if (cfg) {
    lobbyForm = { ...lobbyForm, ...cfg };
  }

  const modeSelect = el(
    'select',
    { class: 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500', disabled: !host },
    el('option', { value: 'mcq', selected: lobbyForm.mode === 'mcq' }, 'Quiz Kategori'),
    el('option', { value: 'code', selected: lobbyForm.mode === 'code' }, 'Latihan Sandi')
  );
  modeSelect.addEventListener('change', () => { lobbyForm.mode = modeSelect.value; render(); });

  const categoryPicker = renderCategoryPicker({
    categories,
    selected: paramToCategories(lobbyForm.category, categories),
    onChange: (set) => { lobbyForm.category = categoriesToParam(set, categories); },
    disabled: !host,
  });

  const codeSelect = el(
    'select',
    { class: 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500', disabled: !host },
    ...codeList.map((c) => el('option', { value: c.id, selected: c.id === lobbyForm.code }, c.name))
  );
  codeSelect.addEventListener('change', () => { lobbyForm.code = codeSelect.value; });

  const drillModeSelect = el(
    'select',
    { class: 'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500', disabled: !host },
    el('option', { value: 'choice', selected: lobbyForm.drillMode === 'choice' }, 'Pilihan Ganda'),
    el('option', { value: 'encode', selected: lobbyForm.drillMode === 'encode' }, 'Enkode (Isi)'),
    el('option', { value: 'decode', selected: lobbyForm.drillMode === 'decode' }, 'Dekode (Isi)')
  );
  drillModeSelect.addEventListener('change', () => { lobbyForm.drillMode = drillModeSelect.value; });

  const countInput = boundInput('number', lobbyForm.questionCount, 'questionCount');
  const pointsInput = boundInput('number', lobbyForm.points, 'points');
  const penaltyInput = boundInput('number', lobbyForm.penalty, 'penalty');
  const secondsInput = boundInput('number', lobbyForm.secondsPerQuestion, 'secondsPerQuestion');

  let applyBtn = null;
  let startBtn = null;

  async function applyConfig() {
    applyBtn.disabled = true;
    const res = await setGameConfig(lobbyForm);
    applyBtn.disabled = false;
    if (!res?.ok) toast(res?.error || 'Gagal menyimpan konfigurasi');
    else toast('Konfigurasi disimpan', 'success');
  }

  async function start() {
    startBtn.disabled = true;
    // Ensure the latest form values are saved before starting.
    await setGameConfig(lobbyForm);
    const res = await startGame();
    startBtn.disabled = false;
    if (!res?.ok) toast(res?.error || 'Gagal memulai');
  }

  applyBtn = button('Simpan Konfigurasi', { variant: 'secondary', disabled: !host }, applyConfig);
  startBtn = button('Mulai Permainan', { disabled: !host || players.length < 2 }, start);

  const view = el(
    'div',
    { class: 'max-w-2xl mx-auto px-4 py-10' },
    el('div', { class: 'flex items-center justify-between mb-6' },
      el('h1', { class: 'text-2xl font-extrabold text-slate-900' }, `Ruangan ${roomId}`),
      button('Keluar', { variant: 'ghost' }, () => { leaveRoom(); navigate('/'); })
    ),
    card(
      el('h2', { class: 'font-bold text-lg text-slate-900 mb-3' }, 'Pemain'),
      el(
        'ul',
        { class: 'space-y-2' },
        ...players.map((p) =>
          el('li', { class: 'flex items-center justify-between px-4 py-2.5 rounded-xl bg-slate-50' },
            el('span', { class: 'font-medium' }, p.name, p.isHost ? el('span', { class: 'ml-2 text-xs text-brand-600 font-semibold' }, 'HOST') : null),
            el('span', { class: 'text-sm text-slate-400' }, 'siap')
          )
        ),
        ...Array.from({ length: 2 - players.length }, () =>
          el('li', { class: 'px-4 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 text-sm text-center' }, 'Menunggu pemain...')
        )
      ),
      el('p', { class: 'text-xs text-slate-400 mt-3' }, players.length < 2 ? 'Bagikan kode ruangan ke teman untuk mengajak bermain.' : 'Pemain lengkap. Host bisa memulai.')
    ),
    host
      ? card(
          el('h2', { class: 'font-bold text-lg text-slate-900 mb-1' }, 'Konfigurasi'),
          el('p', { class: 'text-slate-500 text-sm mb-4' }, 'Atur lalu mulai permainan.'),
          field('Mode Permainan', modeSelect),
          lobbyForm.mode === 'mcq' ? field('Kategori', categoryPicker) : null,
          lobbyForm.mode === 'code' ? field('Jenis Sandi', codeSelect) : null,
          lobbyForm.mode === 'code' ? field('Mode Latihan', drillModeSelect) : null,
          grid(
            field('Jumlah Soal', countInput),
            field('Poin (+)', pointsInput),
            field('Penalti (−)', penaltyInput),
            field('Detik/Soal', secondsInput)
          ),
          el('div', { class: 'flex gap-3 mt-5' }, applyBtn, startBtn)
        )
      : card(
          el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Menunggu Host'),
          el('p', { class: 'text-slate-500 text-sm mt-1' }, 'Permainan akan dimulai oleh host sebentar lagi.')
        )
  );

  mount(view);
}

function boundInput(type, value, key) {
  const node = input({ type, value: String(value) });
  node.addEventListener('input', () => {
    const n = parseInt(node.value, 10);
    if (Number.isFinite(n)) lobbyForm[key] = n;
  });
  return node;
}

function field(label, inputNode) {
  return el('div', null,
    el('label', { class: 'block text-sm font-medium text-slate-600 mb-1.5' }, label),
    inputNode
  );
}

function grid(...fields) {
  return el('div', { class: 'grid grid-cols-2 gap-4 mt-4' }, ...fields);
}

// ---- Game ----
let timeLeft = 0;
function startTimer(seconds) {
  stopTimer();
  timeLeft = seconds;
  timerHandle = setInterval(() => {
    timeLeft = Math.max(0, timeLeft - 1);
    const t = document.getElementById('timer-text');
    if (t) t.textContent = `${timeLeft}s`;
    const ring = document.getElementById('timer-ring');
    if (ring && seconds > 0) ring.style.width = `${(timeLeft / seconds) * 100}%`;
  }, 1000);
}

function stopTimer() {
  if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
}

function renderGame() {
  if (!question) return renderLoading();

  const myScore = me()?.score ?? 0;
  const opp = roomState.players.find((p) => p.name !== myName);
  const oppScore = opp?.score ?? 0;
  const progress = `Soal ${question.index + 1} / ${question.total}`;

  const statusBar = el('div', { class: 'flex items-center justify-between mb-4' },
    el('div', { class: 'flex gap-3' },
      scoreChip(myName, myScore, true),
      scoreChip(opp?.name || '—', oppScore, false)
    ),
    el('div', { class: 'text-right' },
      el('div', { id: 'timer-text', class: 'text-sm font-bold text-slate-700' }, `${timeLeft}s`),
      el('div', { class: 'w-24 h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden' },
        el('div', { id: 'timer-ring', class: 'h-full bg-brand-500 transition-all', style: `width: ${question.seconds ? (timeLeft / question.seconds) * 100 : 0}%` })
      )
    )
  );

  const reveal = result != null && !result.tooLate;
  const tooLate = result?.tooLate === true;
  const iBuzzed = reveal && !result.timeout && result.winnerName === myName;

  const revealBox = renderRevealBox(reveal, tooLate, iBuzzed);

  const children = question.kind === 'code'
    ? renderCodeRound(opp)
    : renderMCQRound();

  const view = el(
    'div',
    { class: 'max-w-2xl mx-auto px-4 py-10' },
    el('div', { class: 'flex items-center justify-between mb-4' },
      el('span', { class: 'text-sm font-medium text-slate-500' }, progress),
      button('Keluar', { variant: 'ghost' }, () => { leaveRoom(); navigate('/'); })
    ),
    card(statusBar, ...children, revealBox)
  );

  mount(view);
}

function renderRevealBox(reveal, tooLate, iBuzzed) {
  if (reveal) {
    let title, color;
    if (result.timeout) { title = 'Waktu habis — tidak ada yang menjawab'; color = 'bg-amber-50 text-amber-700'; }
    else if (result.correct) { title = iBuzzed ? `Benar! +${roomState.config?.points ?? 0} poin` : `${result.winnerName} lebih dulu & benar (+${roomState.config?.points ?? 0})`; color = 'bg-emerald-50 text-emerald-700'; }
    else { title = iBuzzed ? `Salah! −${roomState.config?.penalty ?? 0} poin` : `${result.winnerName} salah — Anda +0`; color = 'bg-red-50 text-red-700'; }
    return el('div', { class: `p-4 rounded-xl ${color} mt-4` },
      el('p', { class: 'font-semibold' }, title),
      result?.explanation ? el('p', { class: 'text-sm mt-1 text-slate-600' }, result.explanation) : null
    );
  }
  if (tooLate) {
    return el('div', { class: 'p-4 rounded-xl bg-slate-100 text-slate-600 mt-4' },
      el('p', { class: 'font-semibold' }, 'Terlambat — lawan lebih dulu menjawab.')
    );
  }
  return null;
}

function renderMCQRound() {
  const locked = result != null;
  const optionButtons = question.options.map((opt, i) => {
    let cls = 'w-full text-left px-5 py-3.5 rounded-xl border transition disabled:opacity-70 ';
    if (locked) {
      if (result.timeout) {
        cls += i === result.correctIndex ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 opacity-60';
      } else {
        if (i === result.correctIndex) cls += 'border-emerald-500 bg-emerald-50';
        else if (i === result.chosenIndex && !result.correct) cls += 'border-red-500 bg-red-50';
        else cls += 'border-slate-200 opacity-60';
      }
    } else {
      cls += 'border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50';
    }
    return el(
      'button',
      { class: cls, disabled: locked, dataset: { index: String(i) } },
      el('span', { class: 'font-medium text-brand-600 mr-2' }, String.fromCharCode(65 + i) + '.'),
      opt
    );
  });

  optionButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (locked) return;
      const chosen = parseInt(btn.dataset.index, 10);
      submitAnswer(question.roundId, chosen);
      optionButtons.forEach((b) => (b.disabled = true));
      btn.classList.add('ring-2', 'ring-brand-500');
    });
  });

  return [
    el('h2', { class: 'text-lg font-bold text-slate-900 mb-4' }, question.question),
    el('div', { class: 'grid gap-3' }, ...optionButtons),
  ];
}

function renderCodeRound(opp) {
  const locked = result != null;
  const code = CODES[question.codeType];

  if (question.mode === 'choice') {
    const optionButtons = question.options.map((opt, i) => {
      let cls = 'flex items-center justify-center min-h-[64px] px-5 py-3.5 rounded-xl border transition disabled:opacity-70 ';
      if (locked) {
        if (result.timeout) {
          cls += i === result.correctIndex ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 opacity-60';
        } else {
          if (i === result.correctIndex) cls += 'border-emerald-500 bg-emerald-50';
          else if (i === result.chosenIndex && !result.correct) cls += 'border-red-500 bg-red-50';
          else cls += 'border-slate-200 opacity-60';
        }
      } else {
        cls += 'border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50';
      }
      return el('button', { class: cls, disabled: locked, dataset: { index: String(i) } }, renderSymbol(code, opt));
    });

    optionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        const chosen = parseInt(btn.dataset.index, 10);
        submitAnswer(question.roundId, chosen);
        optionButtons.forEach((b) => (b.disabled = true));
        btn.classList.add('ring-2', 'ring-brand-500');
      });
    });

    return [
      el('h2', { class: 'text-lg font-bold text-slate-900 mb-4' }, question.prompt),
      el('div', { class: 'grid sm:grid-cols-2 gap-3' }, ...optionButtons),
    ];
  }

  // fill-in (encode / decode)
  const encode = question.mode === 'encode';
  const targets = encode ? question.prompt.split('') : question.prompt;
  const build = [];
  const buildArea = el('div', { class: 'flex flex-wrap items-center justify-center gap-2 min-h-[56px] py-2' });
  const targetArea = el('div', { class: 'flex flex-wrap items-center justify-center gap-2 mb-4' });

  function renderTargets() {
    targetArea.innerHTML = '';
    if (encode) {
      targets.forEach((letter, i) => {
        const done = i < build.length;
        const current = i === build.length && !locked;
        targetArea.append(
          el('span', { class: `w-10 h-12 flex items-center justify-center rounded-lg border text-lg font-bold ${current ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200' : done ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white text-slate-700'}` }, letter)
        );
      });
    } else {
      targets.forEach((sym, i) => {
        const current = i === build.length && !locked;
        targetArea.append(
          el('div', { class: `flex flex-col items-center justify-center min-w-[72px] h-20 rounded-lg border p-2 ${current ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white'}` }, renderSymbol(code, sym))
        );
      });
    }
  }

  function renderBuild() {
    buildArea.innerHTML = '';
    build.forEach((picked) => {
      const inner = encode ? renderSymbol(code, picked) : el('span', { class: 'text-lg font-bold' }, picked === 'I/J' ? 'I/J' : picked);
      buildArea.append(el('div', { class: 'flex items-center justify-center min-w-[64px] h-14 rounded-lg border border-brand-200 bg-white px-2' }, inner));
    });
    if (build.length === 0) buildArea.append(el('span', { class: 'text-sm text-slate-400' }, 'Pilih simbol di bawah untuk menyusun jawaban...'));
  }

  const full = () => build.length === targets.length;

  function sendSubmission() {
    if (locked || !full()) return;
    submitCode(question.roundId, build.slice());
  }

  function renderPalette() {
    const palette = renderCodePalette(code, {
      face: encode ? 'symbol' : 'letter',
      onPick: (tile) => {
        if (locked || full()) return;
        build.push(encode ? tile.symbol : tile.letter);
        renderTargets();
        renderBuild();
        submitBtn.disabled = !full() || locked;
        if (full()) sendSubmission();
      },
      selected: [],
      disabled: locked,
    });
    return palette;
  }

  const submitBtn = button('Kirim Jawaban', {}, () => {
    sendSubmission();
    submitBtn.disabled = true;
  });
  submitBtn.disabled = !full() || locked;

  const hapusBtn = button('Hapus', { variant: 'ghost' }, () => {
    if (locked || build.length === 0) return;
    build.pop();
    renderTargets();
    renderBuild();
    submitBtn.disabled = !full() || locked;
  });

  renderTargets();
  renderBuild();

  const promptHeading = encode
    ? el('h2', { class: 'text-lg font-bold text-slate-900 mb-1' }, `Enkode kata: "${question.prompt}"`)
    : el('h2', { class: 'text-lg font-bold text-slate-900 mb-1' }, 'Dekode simbol berikut menjadi kata:');

  return [
    promptHeading,
    targetArea,
    el('div', { class: 'border-t border-slate-100 pt-3' },
      el('div', { class: 'text-xs font-medium text-slate-400 mb-1 text-center' }, 'Jawaban Anda'),
      buildArea
    ),
    el('div', { class: 'flex gap-3 justify-center mt-2' }, hapusBtn, submitBtn),
    renderPalette(),
  ];
}

function scoreChip(name, score, isMe) {
  return el('div', { class: `px-4 py-2 rounded-xl ${isMe ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700'}` },
    el('div', { class: 'text-xs font-medium opacity-80' }, name),
    el('div', { class: 'text-xl font-extrabold' }, String(score))
  );
}

// ---- Finished ----
function renderFinished() {
  const scores = result?.scores || roomState.players.map((p) => ({ name: p.name, score: p.score }));
  const winner = result?.winner;
  const tie = result?.tie;
  const sorted = [...scores].sort((a, b) => b.score - a.score);

  const view = el(
    'div',
    { class: 'max-w-2xl mx-auto px-4 py-12' },
    heading('Permainan Selesai', tie ? 'Seri!' : winner ? `Pemenang: ${winner}` : ''),
    card(
      el('ul', { class: 'space-y-2' },
        ...sorted.map((s, i) =>
          el('li', { class: `flex items-center justify-between px-5 py-3 rounded-xl ${i === 0 ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50'}` },
            el('span', { class: 'font-semibold' }, `#${i + 1} ${s.name}`),
            el('span', { class: 'text-xl font-extrabold' }, String(s.score))
          )
        )
      ),
      el('div', { class: 'flex gap-3 mt-6 justify-center' },
        button('Beranda', { variant: 'ghost' }, () => { leaveRoom(); navigate('/'); })
      )
    )
  );
  mount(view);
}