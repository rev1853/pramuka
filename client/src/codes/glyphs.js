// Pure DOM renderers for the sandi codes. Each returns a DOM node built with
// the el() helper from ../ui.js. No app state — just drawing.
//
// Renderers:
//   renderMorse(symbol)   — dot/dash row
//   renderGrass(symbol)   — inline-SVG grass-blade row (short=dot, tall=dash)
//   renderKotakGrid(code, opts) — a grid of cells (display + click palette)
//   renderSymbol(code, symbol) — dispatch to the right renderer for one symbol
//   renderPalette(code, opts) — the fill-in answer palette (symbol- or letter-faced)
import { el } from '../ui.js';
import { symbolTiles } from '../../../shared/codes.js';

// --- Morse: a row of dots (•) and dashes (—) ---
export function renderMorse(symbol, { compact = false } = {}) {
  const row = el('div', { class: `flex items-center ${compact ? 'gap-1' : 'gap-1.5'}` });
  for (const ch of String(symbol || '')) {
    if (ch === '.') row.append(el('span', { class: `${compact ? 'w-2 h-2' : 'w-2.5 h-2.5'} rounded-full bg-slate-800 inline-block` }));
    else if (ch === '-') row.append(el('span', { class: `${compact ? 'w-5 h-2' : 'w-7 h-2.5'} rounded-full bg-slate-800 inline-block` }));
  }
  return row;
}

// --- Rumput: same data as morse, drawn as grass blades on a ground line ---
export function renderGrass(symbol, { compact = false } = {}) {
  const chars = String(symbol || '');
  const n = Math.max(chars.length, 1);
  const bladeW = compact ? 4 : 6;
  const step = bladeW + (compact ? 2 : 4); // blade + gap
  const W = n * step;
  const H = compact ? 24 : 36;
  const ground = compact ? 20 : 30;
  const stroke = compact ? 1 : 1.5;
  let blades = '';
  for (let i = 0; i < chars.length; i++) {
    const x = i * step;
    const tall = chars[i] === '-';
    const tipY = tall ? (compact ? 6 : 4) : (compact ? 12 : 16); // tall blade = dash, short blade = dot
    blades += `<path d="M${x},${ground} Q${x + bladeW / 2},${tipY} ${x + bladeW},${ground} Z" fill="#16a34a"/>`;
  }
  const svg =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">` +
    `<line x1="0" y1="${ground}" x2="${W}" y2="${ground}" stroke="#92400e" stroke-width="${stroke}"/>` +
    `${blades}</svg>`;
  return el('div', { class: `flex items-end justify-center ${compact ? 'min-h-[24px]' : 'min-h-[36px]'}`, html: svg });
}

// --- Kotak: a grid of cells. Used as a reference chart and as the palette.
//      showLetters=false -> cells show only their (r,c) coordinate (recall);
//      showLetters=true  -> cells also show the letter (study / decode input). ---
export function renderKotakGrid(code, opts = {}) {
  const { showLetters = false, onPick = null, selected = [], disabled = false } = opts;
  const grid = code.grid;
  const cols = grid[0].length;
  const container = el('div', {
    class: 'grid gap-1.5 w-fit mx-auto',
    style: `grid-template-columns: repeat(${cols}, minmax(0, 1fr))`,
  });

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < cols; c++) {
      const letter = grid[r][c];
      const symbol = `${r + 1}${c + 1}`;
      const isSel = selected.includes(symbol);
      const clickable = onPick && !disabled;
      const cell = el(
        onPick ? 'button' : 'div',
        {
          class: [
            'relative w-16 h-16 rounded-lg border flex flex-col items-center justify-center transition',
            isSel ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white',
            clickable ? 'hover:border-brand-400 hover:bg-brand-50 cursor-pointer' : '',
            disabled && !isSel ? 'opacity-60' : '',
          ].join(' '),
          dataset: { symbol, row: String(r + 1), col: String(c + 1), letter },
          ...(clickable ? { onClick: () => onPick({ symbol, letter, row: r + 1, col: c + 1 }) } : {}),
        },
        showLetters ? el('span', { class: 'text-lg font-bold text-slate-800 leading-none' }, letter) : null,
        el('span', { class: 'absolute top-0.5 left-1 text-[10px] font-medium text-slate-400' }, `${r + 1},${c + 1}`)
      );
      container.append(cell);
    }
  }
  return container;
}

// A compact single-symbol chip for a grid coordinate, used in choice options.
export function renderKotakSymbol(symbol) {
  const s = String(symbol);
  return el(
    'span',
    { class: 'inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-mono font-semibold text-slate-700' },
    `(${s[0]},${s[1]})`
  );
}

// Dispatch: render one symbol under a code's glyph.
export function renderSymbol(code, symbol, opts = {}) {
  switch (code.glyph) {
    case 'morse':
      return renderMorse(symbol, opts);
    case 'grass':
      return renderGrass(symbol, opts);
    case 'grid':
      return renderKotakSymbol(symbol);
    default:
      return el('span', {}, String(symbol ?? ''));
  }
}

// --- The fill-in palette. face='symbol' (encode, recall) or 'letter' (decode).
//      onPick(tile) receives { letter, symbol } (grid tiles also carry row/col). ---
export function renderPalette(code, opts = {}) {
  const { face = 'symbol', onPick = null, selected = [], disabled = false } = opts;

  if (code.glyph === 'grid') {
    // Grid codes always use the grid; encode hides letters, decode shows them.
    return renderKotakGrid(code, { showLetters: face === 'letter', onPick, selected, disabled });
  }

  // morse / rumput: a wrap of tiles.
  const tiles = symbolTiles(code);
  const wrap = el('div', { class: 'flex flex-wrap justify-center gap-2 max-w-xl mx-auto' });
  for (const { letter, symbol } of tiles) {
    const isSel = selected.includes(symbol);
    const clickable = onPick && !disabled;
    const tile = el(
      onPick ? 'button' : 'div',
      {
        class: [
          'flex flex-col items-center justify-center min-w-[68px] h-20 px-3 rounded-xl border bg-white transition',
          isSel ? 'border-brand-500 bg-brand-50' : 'border-slate-200',
          clickable ? 'hover:border-brand-400 hover:bg-brand-50 cursor-pointer' : '',
          disabled && !isSel ? 'opacity-60' : '',
        ].join(' '),
        dataset: { letter, symbol },
        ...(clickable ? { onClick: () => onPick({ letter, symbol }) } : {}),
      },
      face === 'letter'
        ? el('span', { class: 'text-xl font-bold text-slate-800' }, letter)
        : renderSymbol(code, symbol)
    );
    wrap.append(tile);
  }
  return wrap;
}

// A large, presentable symbol for the question prompt (decode) — the thing
// the user must read. For grid codes, the prompt is a sequence of coords.
export function renderPrompt(code, symbols) {
  if (code.glyph === 'grid') {
    const row = el('div', { class: 'flex flex-wrap items-center justify-center gap-2' });
    for (const s of symbols) row.append(renderKotakSymbol(s));
    return row;
  }
  const row = el('div', { class: 'flex flex-wrap items-center justify-center gap-3' });
  for (const s of symbols) row.append(renderSymbol(code, s));
  return row;
}