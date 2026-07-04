// Solo practice: pick category + count, answer randomized questions,
// see immediate feedback, end with a score tally. No timer, no penalty.
import { el, button, input, card, heading, mount, toast } from '../ui.js';
import { fetchCategories, fetchQuiz } from '../api.js';
import { navigate } from '../main.js';

export async function renderSolo() {
  const name = localStorage.getItem('name') || 'Pemain';
  let categories = [];
  try {
    categories = await fetchCategories();
  } catch (e) {
    toast(e.message);
  }
  renderPicker(categories, name);
}

function renderPicker(categories, name) {
  const countInput = input({ type: 'number', value: '10', dataset: { key: 'count' } });

  const categorySelect = el(
    'select',
    {
      class:
        'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500',
    },
    el('option', { value: 'all' }, 'Semua Kategori'),
    ...categories.map((c) => el('option', { value: c.id }, c.name))
  );

  const startBtn = button('Mulai', {}, async () => {
    const category = categorySelect.value;
    const count = Math.max(1, Math.min(50, parseInt(countInput.value, 10) || 10));
    startBtn.disabled = true;
    startBtn.textContent = 'Memuat...';
    try {
      const questions = await fetchQuiz(category, count);
      if (!questions.length) {
        toast('Tidak ada pertanyaan untuk kategori ini');
        startBtn.disabled = false;
        startBtn.textContent = 'Mulai';
        return;
      }
      runQuiz(questions, name);
    } catch (e) {
      toast(e.message);
      startBtn.disabled = false;
      startBtn.textContent = 'Mulai';
    }
  });

  const view = el(
    'div',
    { class: 'max-w-2xl mx-auto px-4 py-12' },
    heading('Latihan Solo', `Selamat datang, ${name}`),
    card(
      el('label', { class: 'block text-sm font-medium text-slate-600 mb-1.5' }, 'Kategori'),
      categorySelect,
      el('label', { class: 'block text-sm font-medium text-slate-600 mt-4 mb-1.5' }, 'Jumlah Pertanyaan'),
      countInput,
      el('div', { class: 'flex gap-3 mt-6' }, button('Kembali', { variant: 'ghost' }, () => navigate('/')), startBtn)
    )
  );

  mount(view);
}

function runQuiz(questions, name) {
  let index = 0;
  let correct = 0;
  let answered = false;

  function renderQuestion() {
    answered = false;
    const q = questions[index];
    const progress = `Pertanyaan ${index + 1} dari ${questions.length}`;

    const optionButtons = q.options.map((opt, i) =>
      el(
        'button',
        {
          class:
            'w-full text-left px-5 py-3.5 rounded-xl border border-slate-200 bg-white hover:border-brand-500 hover:bg-brand-50 transition disabled:opacity-60',
          dataset: { index: String(i) },
        },
        el('span', { class: 'font-medium text-brand-600 mr-2' }, String.fromCharCode(65 + i) + '.'),
        opt
      )
    );

    const questionCard = card(
      el('div', { class: 'flex justify-between items-center mb-4' },
        el('span', { class: 'text-sm font-medium text-slate-500' }, progress),
        el('span', { id: 'solo-score', class: 'text-sm font-semibold text-emerald-600' }, `Benar: ${correct}`)
      ),
      el('h2', { class: 'text-lg font-bold text-slate-900 mb-4' }, q.question),
      el('div', { class: 'grid gap-3', dataset: { key: 'options' } }, ...optionButtons)
    );

    // Reveal area (filled after answering)
    const reveal = el('div', { class: 'mt-4', dataset: { key: 'reveal' } });
    questionCard.append(reveal);

    optionButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        if (answered) return;
        answered = true;
        const chosen = parseInt(btn.dataset.index, 10);
        const isCorrect = chosen === q.answer;
        if (isCorrect) correct++;
        const scoreEl = document.getElementById('solo-score');
        if (scoreEl) scoreEl.textContent = `Benar: ${correct}`;

        // Color the options
        optionButtons.forEach((b, i) => {
          b.disabled = true;
          if (i === q.answer) {
            b.className = b.className.replace('hover:bg-brand-50', '') + ' border-emerald-500 bg-emerald-50';
          } else if (i === chosen && !isCorrect) {
            b.className = b.className.replace('hover:bg-brand-50', '') + ' border-red-500 bg-red-50';
          } else {
            b.className = b.className.replace('hover:bg-brand-50', '') + ' opacity-60';
          }
        });

        reveal.append(
          el(
            'div',
            { class: `p-4 rounded-xl ${isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}` },
            el('p', { class: 'font-semibold' }, isCorrect ? 'Benar!' : 'Belum tepat.'),
            q.explanation ? el('p', { class: 'text-sm mt-1 text-slate-600' }, q.explanation) : null
          ),
          el('div', { class: 'mt-4' }, button(index + 1 < questions.length ? 'Pertanyaan Berikutnya' : 'Lihat Hasil', {}, () => {
            index++;
            if (index >= questions.length) showResult();
            else renderQuestion();
          }))
        );
      });
    });

    mount(el('div', { class: 'max-w-2xl mx-auto px-4 py-12' }, questionCard));
  }

  function showResult() {
    const pct = Math.round((correct / questions.length) * 100);
    const view = el(
      'div',
      { class: 'max-w-2xl mx-auto px-4 py-12' },
      heading('Hasil Latihan', name),
      card(
        el('div', { class: 'text-center py-6' },
          el('div', { class: 'text-6xl font-extrabold text-brand-600' }, `${correct}/${questions.length}`),
          el('div', { class: 'text-slate-500 mt-2' }, `${pct}% benar`)
        ),
        el('div', { class: 'flex gap-3 mt-6 justify-center' },
          button('Latihan Lagi', { variant: 'secondary' }, () => renderSolo()),
          button('Beranda', { variant: 'ghost' }, () => navigate('/'))
        )
      )
    );
    mount(view);
  }

  renderQuestion();
}