// Shared multi-category picker for MCQ question mixing. Renders a
// "Pilih Semua" toggle plus a checkbox grid of categories. Used by both
// the solo practice screen and the room lobby (MCQ mode). Selection is
// carried as a comma-separated string in the existing `category` field
// so no API/protocol changes are needed — see categoriesToParam/paramToCategories.
import { el } from '../ui.js';

/**
 * Convert a selection set into the `category` param string.
 * Empty or all-selected → 'all'; otherwise comma-joined ids.
 * @param {Set<string>} selected
 * @param {{id:string}[]} categories
 * @returns {string}
 */
export function categoriesToParam(selected, categories) {
  if (!selected || selected.size === 0) return 'all';
  if (selected.size >= categories.length) return 'all';
  return [...selected].filter((id) => categories.some((c) => c.id === id)).join(',');
}

/**
 * Parse a `category` param string (single id, comma list, or 'all') into a
 * Set of category ids. 'all'/empty/unknown → all ids.
 * @param {string} param
 * @param {{id:string}[]} categories
 * @returns {Set<string>}
 */
export function paramToCategories(param, categories) {
  const all = categories.map((c) => c.id);
  if (!param || param === 'all') return new Set(all);
  const ids = param.split(',').map((s) => s.trim()).filter(Boolean);
  const known = ids.filter((id) => all.includes(id));
  if (!known.length) return new Set(all);
  return new Set(known);
}

/**
 * Render a multi-select category picker.
 * @param {{ categories:{id:string,name:string}[], selected:Set<string>, onChange:(set:Set<string>)=>void, disabled?:boolean }} opts
 * @returns {HTMLElement}
 */
export function renderCategoryPicker({ categories, selected, onChange, disabled = false }) {
  const current = new Set(selected);

  const toggleAll = el(
    'label',
    {
      class:
        'flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white cursor-pointer select-none mb-3',
    },
    el('input', { type: 'checkbox', class: 'accent-brand-600', disabled: disabled || null }),
    el('span', { class: 'text-sm font-semibold text-slate-700' }, 'Pilih Semua')
  );
  const allCheckbox = toggleAll.querySelector('input');
  const syncAllCheckbox = () => {
    allCheckbox.checked = current.size >= categories.length;
  };
  syncAllCheckbox();
  allCheckbox.addEventListener('change', () => {
    if (allCheckbox.checked) categories.forEach((c) => current.add(c.id));
    else current.clear();
    syncAllCheckbox();
    grid.querySelectorAll('input[data-id]').forEach((cb) => {
      cb.checked = current.has(cb.dataset.id);
    });
    onChange(new Set(current));
  });

  const grid = el(
    'div',
    { class: 'grid grid-cols-2 sm:grid-cols-3 gap-2' },
    ...categories.map((c) => {
      const checked = current.has(c.id);
      const cb = el('input', {
        type: 'checkbox',
        class: 'sr-only',
        dataset: { id: c.id },
        disabled: disabled || null,
      });
      if (checked) cb.checked = true;
      cb.addEventListener('change', () => {
        if (cb.checked) current.add(c.id);
        else current.delete(c.id);
        syncAllCheckbox();
        onChange(new Set(current));
      });
      // Visible chip: styled via has-[:checked] so the parent label reflects
      // the checkbox state without JS class toggling.
      return el(
        'label',
        {
          class:
            'flex items-center gap-2 px-3 py-2 rounded-xl border bg-white cursor-pointer select-none text-sm text-slate-700 border-slate-200 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 has-[:checked]:text-brand-700 transition',
        },
        cb,
        el('span', { class: 'truncate' }, c.name)
      );
    })
  );

  return el('div', null, toggleAll, grid);
}