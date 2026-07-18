// Latihan Sandi: interactive code practice (morse, kotak, rumput).
// Three drill modes: choice (MCQ with rendered symbols), encode (word ->
// symbols, pick one symbol per letter), decode (symbols -> word). Includes
// a reference chart ("Lihat Tabel"). Solo-only; self-checked client-side.
import { el, button, input, card, heading, mount, toast } from '../ui.js';
import { fetchCodeDrill } from '../api.js';
import { navigate } from '../main.js';
import { CODES } from '../../../shared/codes.js';
import { renderSymbol, renderPalette as renderCodePalette, renderPrompt, renderKotakGrid } from '../codes/glyphs.js';

const CODE_LIST = Object.values(CODES);

const MODES = [
  { id: 'choice', name: 'Pilihan Ganda', desc: 'Pilih simbol yang benar dari 4 opsi.' },
  { id: 'encode', name: 'Isi: Enkode', desc: 'Dari huruf ke simbol — pilih simbol satu per satu.' },
  { id: 'decode', name: 'Isi: Dekode', desc: 'Dari simbol ke huruf — susun kata dari simbol.' },
];

export function renderCode() {
  renderCodePicker();
}

function renderCodePicker() {
  const view = el(
    'div',
    { class: 'max-w-3xl mx-auto px-4 py-12' },
    heading('Latihan Sandi', 'Pelajari sandi morse, kotak, dan rumput'),
    el(
      'div',
      { class: 'grid md:grid-cols-2 gap-4' },
      ...CODE_LIST.map((c) =>
        card(
          el('h2', { class: 'font-bold text-lg text-slate-900' }, c.name),
          el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, c.nameEn),
          el('div', { class: 'flex gap-2' }, button('Latihan', {}, () => renderModePicker(c)), button('Lihat Tabel', { variant: 'secondary' }, () => renderTable(c)))
        )
      )
    ),
    el('div', { class: 'mt-6' }, button('Beranda', { variant: 'ghost' }, () => navigate('/')))
  );
  mount(view);
}

function renderModePicker(code) {
  const countInput = input({ type: 'number', value: '10' });

  const startBtn = button('Mulai', {}, async () => {
    const mode = document.querySelector('input[name="code-mode"]:checked')?.value || 'choice';
    const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 10));
    startBtn.disabled = true;
    startBtn.textContent = 'Memuat...';
    try {
      const questions = await fetchCodeDrill(code.id, mode, count);
      if (!questions.length) {
        toast('Tidak ada soal untuk mode ini');
        startBtn.disabled = false;
        startBtn.textContent = 'Mulai';
        return;
      }
      runDrill(questions, code, mode);
    } catch (e) {
      toast(e.message);
      startBtn.disabled = false;
      startBtn.textContent = 'Mulai';
    }
  });

  const modeCards = MODES.map((m, i) =>
    el(
      'label',
      {
        class: 'block cursor-pointer rounded-xl border border-slate-200 p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50',
      },
      el('input', { type: 'radio', name: 'code-mode', value: m.id, ...(i === 0 ? { checked: true } : {}), class: 'mb-2 accent-brand-600' }),
      el('div', { class: 'font-semibold text-slate-900' }, m.name),
      el('div', { class: 'text-sm text-slate-500 mt-0.5' }, m.desc)
    )
  );

  const view = el(
    'div',
    { class: 'max-w-2xl mx-auto px-4 py-12' },
    heading(code.name, code.nameEn),
    card(
      el('label', { class: 'block text-sm font-medium text-slate-600 mb-1.5' }, 'Mode Latihan'),
      el('div', { class: 'grid gap-3' }, ...modeCards),
      el('label', { class: 'block text-sm font-medium text-slate-600 mt-4 mb-1.5' }, 'Jumlah Pertanyaan'),
      countInput,
      el('div', { class: 'flex gap-3 mt-6' }, button('Kembali', { variant: 'ghost' }, () => renderCode()), startBtn)
    )
  );
  mount(view);
}

// --- Reference chart ---
function renderTable(code) {
let body;
  if (code.glyph === 'grid') {
    body = renderKotakGrid(code, { showLetters: true });
  } else {
    // Alphabet reference: compact multi-column chart. Each row is a letter +
    // symbol pair with aligned baselines, flowing into 2-3 columns so the
    // whole A-Z chart fits on screen without endless scrolling.
    function refRow(label, sym) {
      return el('div', { class: 'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 overflow-hidden' },
        el('span', { class: 'inline-flex items-center justify-center w-10 h-10 rounded-lg bg-slate-50 border border-slate-200 text-base font-bold text-slate-700 shrink-0' }, label),
        el('div', { class: 'min-w-0 flex-1 flex items-center max-w-full' }, renderSymbol(code, sym, { compact: true }))
      );
    }

    const letters = code.letters.map((letter) => refRow(letter, code.alphabet[letter]));
    const letterGrid = el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2' }, ...letters);

    let digitsSection = null;
    if (code.alphabet[0]) {
      const digits = '0123456789'.split('').map((d) => refRow(d, code.alphabet[d]));
      digitsSection = el('div', { class: 'mt-5' },
        el('h3', { class: 'text-sm font-semibold text-slate-700 mb-2' }, 'Angka'),
        el('div', { class: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2' }, ...digits)
      );
    }

    body = el('div', {}, letterGrid, digitsSection);
  }

  const view = el(
    'div',
    { class: 'max-w-3xl mx-auto px-4 py-12' },
    heading(code.name, 'Tabel referensi simbol'),
    card(el('p', { class: 'text-sm text-slate-500 mb-4' }, code.glyph === 'grid' ? 'Klik sel untuk melihat koordinatnya.' : 'Setiap huruf dipasangkan dengan simbolnya.'), body),
    el('div', { class: 'mt-6' }, button('Kembali', { variant: 'ghost' }, () => renderModePicker(code)))
  );
  mount(view);
}

// --- Drill runner ---
function runDrill(questions, code, mode) {
  let index = 0;
  let correct = 0;

  function showResult() {
    const pct = Math.round((correct / questions.length) * 100);
    const view = el(
      'div',
      { class: 'max-w-2xl mx-auto px-4 py-12' },
      heading('Hasil Latihan', code.name),
      card(
        el('div', { class: 'text-center py-6' },
          el('div', { class: 'text-6xl font-extrabold text-brand-600' }, `${correct}/${questions.length}`),
          el('div', { class: 'text-slate-500 mt-2' }, `${pct}% benar`)
        ),
        el('div', { class: 'flex gap-3 mt-6 justify-center' },
          button('Latihan Lagi', { variant: 'secondary' }, () => renderModePicker(code)),
          button('Beranda', { variant: 'ghost' }, () => navigate('/'))
        )
      )
    );
    mount(view);
  }

  function renderTop() {
    return el('div', { class: 'flex justify-between items-center mb-4' },
      el('span', { class: 'text-sm font-medium text-slate-500' }, `Pertanyaan ${index + 1} dari ${questions.length}`),
      el('span', { id: 'code-score', class: 'text-sm font-semibold text-emerald-600' }, `Benar: ${correct}`)
    );
  }

  function nextOrResult() {
    index++;
    if (index >= questions.length) showResult();
    else renderQuestion();
  }

  function revealBox(isCorrect, explanation, onNext) {
    return el(
      'div',
      { class: 'mt-4' },
      el('div', { class: `p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}` },
        el('p', { class: 'font-semibold' }, isCorrect ? 'Benar!' : 'Belum tepat.'),
        el('p', { class: 'text-sm mt-1 text-slate-600' }, explanation || '')
      ),
      el('div', { class: 'mt-4' }, button(index + 1 < questions.length ? 'Pertanyaan Berikutnya' : 'Lihat Hasil', {}, onNext))
    );
  }

  function renderQuestion() {
    const q = questions[index];
    let reveal;

    if (q.mode === 'choice') {
      const optionButtons = q.options.map((opt, i) =>
        el('button', { class: 'flex items-center justify-center min-h-[64px] px-5 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50 transition', dataset: { index: String(i) } }, renderSymbol(code, opt))
      );

      const onAnswer = (btn) => {
        const chosen = parseInt(btn.dataset.index, 10);
        const isCorrect = chosen === q.answer;
        if (isCorrect) correct++;
        const scoreEl = document.getElementById('code-score');
        if (scoreEl) scoreEl.textContent = `Benar: ${correct}`;
        optionButtons.forEach((b, i) => {
          b.disabled = true;
          if (i === q.answer) b.className = b.className.replace('hover:bg-brand-50', '') + ' border-emerald-500 bg-emerald-50';
          else if (i === chosen) b.className = b.className.replace('hover:bg-brand-50', '') + ' border-red-500 bg-red-50';
          else b.className = b.className.replace('hover:bg-brand-50', '') + ' opacity-60';
        });
        reveal.append(revealBox(isCorrect, q.explanation, nextOrResult));
      };
      optionButtons.forEach((btn) => btn.addEventListener('click', () => onAnswer(btn)));

      reveal = el('div', { class: 'mt-4', dataset: { key: 'reveal' } });
      const view = el('div', { class: 'max-w-2xl mx-auto px-4 py-12' },
        card(renderTop(), el('h2', { class: 'text-lg font-bold text-slate-900 mb-4' }, q.prompt), el('div', { class: 'grid sm:grid-cols-2 gap-3' }, ...optionButtons), reveal)
      );
      mount(view);
      return;
    }

    // fill-in (encode / decode)
    renderFillIn(q, code, renderTop(), index + 1 >= questions.length, (isCorrect) => {
      if (isCorrect) correct++;
      const scoreEl = document.getElementById('code-score');
      if (scoreEl) scoreEl.textContent = `Benar: ${correct}`;
    }, nextOrResult);
  }

  renderQuestion();
}

// A picked build item matches the expected char. Grid codes use an "I/J"
// merged cell, so a pick of "I/J" satisfies either I or J.
function matchesPicked(picked, exp) {
  if (picked === exp) return true;
  if (picked === 'I/J' && (exp === 'I' || exp === 'J')) return true;
  return false;
}

function renderFillIn(q, code, top, isLast, onCheck, onNext) {
  const encode = q.mode === 'encode';
  const targets = encode ? q.prompt.split('') : q.prompt; // encode: letters; decode: symbol strings
  const expected = q.expected; // encode: [sym]; decode: word string
  const expectedAt = (i) => (encode ? expected[i] : expected[i]);
  const build = []; // encode: picked symbols; decode: picked letters
  let checked = false;

  const buildArea = el('div', { class: 'flex flex-wrap items-center justify-center gap-2 min-h-[56px] py-2' });
  const targetArea = el('div', { class: 'flex flex-wrap items-center justify-center gap-2 mb-4' });

  function renderTargets() {
    targetArea.innerHTML = '';
    if (encode) {
      // the word, with the current letter highlighted
      targets.forEach((letter, i) => {
        const done = i < build.length;
        const current = i === build.length && !checked;
        targetArea.append(
          el('span', { class: `w-10 h-12 flex items-center justify-center rounded-lg border text-lg font-bold ${current ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-200' : done ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-200 bg-white text-slate-700'}` }, letter)
        );
      });
    } else {
      // the symbol prompt; current symbol highlighted
      targets.forEach((sym, i) => {
        const current = i === build.length && !checked;
        const wrap = el('div', { class: `flex flex-col items-center justify-center min-w-[72px] h-20 rounded-lg border p-2 ${current ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-200' : 'border-slate-200 bg-white'}` }, renderSymbol(code, sym));
        targetArea.append(wrap);
      });
    }
  }

  function renderBuild() {
    buildArea.innerHTML = '';
    build.forEach((picked, i) => {
      const ok = matchesPicked(picked, expectedAt(i));
      const inner = encode ? renderSymbol(code, picked) : el('span', { class: 'text-lg font-bold' }, picked === 'I/J' ? 'I/J' : picked);
      buildArea.append(el('div', { class: `flex items-center justify-center min-w-[64px] h-14 rounded-lg border px-2 ${ok ? 'border-emerald-500 bg-emerald-50' : 'border-red-500 bg-red-50'}` }, inner));
    });
    if (build.length === 0) buildArea.append(el('span', { class: 'text-sm text-slate-400' }, 'Pilih simbol di bawah untuk menyusun jawaban...'));
  }

  const full = () => build.length === targets.length;

  const paletteHost = el('div', { class: 'mt-2' });

  function renderAnswerPalette() {
    paletteHost.innerHTML = '';
    const onPick = (tile) => {
      if (checked || full()) return;
      build.push(encode ? tile.symbol : tile.letter);
      renderTargets();
      renderBuild();
      if (full()) renderAnswerPalette(); // disable further picks
      refreshButtons();
    };
    const palette = renderCodePalette(code, { face: encode ? 'symbol' : 'letter', onPick, selected: [], disabled: checked || full() });
    paletteHost.append(palette);
  }

  const checkBtn = button('Periksa Jawaban', {}, () => {
    checked = true;
    const isCorrect = build.every((p, i) => matchesPicked(p, expectedAt(i)));
    onCheck(isCorrect);
    renderAnswerPalette();
    refreshButtons();
    revealHost.append(
      el(
        'div',
        { class: 'mt-4' },
        el('div', { class: `p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}` },
          el('p', { class: 'font-semibold' }, isCorrect ? 'Benar!' : 'Belum tepat.'),
          el('p', { class: 'text-sm mt-1 text-slate-600' }, q.explanation || '')
        ),
        el('div', { class: 'mt-4' }, button(isLast ? 'Lihat Hasil' : 'Pertanyaan Berikutnya', {}, onNext))
      )
    );
    hapusBtn.disabled = true;
    checkBtn.disabled = true;
  });

  const hapusBtn = button('Hapus', { variant: 'ghost' }, () => {
    if (checked || build.length === 0) return;
    build.pop();
    renderTargets();
    renderBuild();
    if (!full()) renderAnswerPalette();
    refreshButtons();
  });

  function refreshButtons() {
    hapusBtn.disabled = checked || build.length === 0;
    checkBtn.disabled = checked || !full();
  }

  const revealHost = el('div', { class: 'mt-2' });
  const controls = el('div', { class: 'flex gap-3 justify-center mt-4' }, hapusBtn, checkBtn);

  renderTargets();
  renderBuild();
  renderAnswerPalette();
  refreshButtons();

  const promptHeading = encode
    ? el('h2', { class: 'text-lg font-bold text-slate-900 mb-1' }, `Enkode kata: "${q.prompt}"`)
    : el('h2', { class: 'text-lg font-bold text-slate-900 mb-1' }, 'Dekode simbol berikut menjadi kata:');

  const view = el('div', { class: 'max-w-2xl mx-auto px-4 py-12' },
    card(top, promptHeading, targetArea, el('div', { class: 'border-t border-slate-100 pt-3' }, el('div', { class: 'text-xs font-medium text-slate-400 mb-1 text-center' }, 'Jawaban Anda'), buildArea), controls, paletteHost, revealHost)
  );
  mount(view);
}