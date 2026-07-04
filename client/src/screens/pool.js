// Question pool (Bank Soal): browse all questions by category with the
// answer + explanation shown openly. Study mode — no guessing, no scoring.
import { el, button, input, card, heading, mount, toast } from '../ui.js';
import { fetchCategories, fetchPool } from '../api.js';
import { navigate } from '../main.js';

export async function renderPool() {
  let categories = [];
  try {
    categories = await fetchCategories();
  } catch (e) {
    toast(e.message);
  }
  renderBrowser(categories);
}

function renderBrowser(categories) {
  // Current category's full question list (cached for client-side search).
  let currentQuestions = [];
  let loadedCategory = 'all';
  let loading = false;

  const categorySelect = el(
    'select',
    {
      class:
        'w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500',
    },
    el('option', { value: 'all' }, 'Semua Kategori'),
    ...categories.map((c) => el('option', { value: c.id }, c.name))
  );

  const searchInput = input({ placeholder: 'Cari pertanyaan…', dataset: { key: 'search' } });

  const countLine = el('p', { class: 'text-sm text-slate-500' }, 'Memuat…');

  const results = el('div', { class: 'mt-6 grid gap-4', dataset: { key: 'results' } });

  function renderResults() {
    results.innerHTML = '';
    const term = searchInput.value.trim().toLowerCase();
    const filtered = term
      ? currentQuestions.filter((q) => q.question.toLowerCase().includes(term))
      : currentQuestions;

    countLine.textContent =
      currentQuestions.length === 0
        ? loading
          ? 'Memuat…'
          : 'Tidak ada soal untuk kategori ini.'
        : `Menampilkan ${filtered.length} dari ${currentQuestions.length} soal${term ? ` untuk "${searchInput.value.trim()}"` : ''}`;

    if (filtered.length === 0) {
      results.append(
        el(
          'div',
          { class: 'text-center text-slate-400 py-10' },
          term ? 'Tidak ada soal yang cocok dengan pencarian.' : 'Belum ada soal di kategori ini.'
        )
      );
      return;
    }

    for (const q of filtered) {
      results.append(renderQuestionCard(q));
    }
  }

  async function loadCategory(category) {
    if (loading) return;
    loading = true;
    loadedCategory = category;
    searchInput.value = '';
    countLine.textContent = 'Memuat…';
    results.innerHTML = '';
    results.append(el('div', { class: 'text-center text-slate-400 py-10' }, 'Memuat soal…'));
    try {
      currentQuestions = await fetchPool(category);
    } catch (e) {
      toast(e.message);
      currentQuestions = [];
    } finally {
      loading = false;
      renderResults();
    }
  }

  categorySelect.addEventListener('change', () => loadCategory(categorySelect.value));
  searchInput.addEventListener('input', renderResults);

  const view = el(
    'div',
    { class: 'max-w-3xl mx-auto px-4 py-12' },
    heading('Bank Soal', 'Jelajahi semua pertanyaan beserta jawaban dan penjelasannya'),
    card(
      el('label', { class: 'block text-sm font-medium text-slate-600 mb-1.5' }, 'Kategori'),
      categorySelect,
      el('label', { class: 'block text-sm font-medium text-slate-600 mt-4 mb-1.5' }, 'Cari'),
      searchInput,
      el('div', { class: 'mt-3' }, countLine)
    ),
    results,
    el('div', { class: 'mt-8' }, button('Kembali', { variant: 'ghost' }, () => navigate('/')))
  );

  mount(view);
  loadCategory('all');
}

function renderQuestionCard(q) {
  const options = q.options.map((opt, i) => {
    const isAnswer = i === q.answer;
    return el(
      'div',
      {
        class: `flex items-start px-5 py-3.5 rounded-xl border ${
          isAnswer
            ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
            : 'border-slate-200 bg-white text-slate-700'
        }`,
      },
      el(
        'span',
        { class: `font-medium mr-2 ${isAnswer ? 'text-emerald-600' : 'text-brand-600'}` },
        String.fromCharCode(65 + i) + '.'
      ),
      el('span', { class: isAnswer ? 'font-semibold' : '' }, opt),
      isAnswer ? el('span', { class: 'ml-auto text-xs font-semibold text-emerald-600' }, '✓ Jawaban') : null
    );
  });

  return card(
    el(
      'div',
      { class: 'flex items-center gap-2 mb-3' },
      el('span', { class: 'text-xs font-mono text-slate-400' }, q.id)
    ),
    el('h2', { class: 'text-lg font-bold text-slate-900 mb-4' }, q.question),
    el('div', { class: 'grid gap-3' }, ...options),
    q.explanation
      ? el(
          'div',
          { class: 'p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm mt-3' },
          el('p', { class: 'font-semibold mb-1' }, 'Penjelasan'),
          el('p', {}, q.explanation)
        )
      : null
  );
}