// Shared code (sandi) definitions for the Pramuka quiz host.
// Imported by both server (Node) and client (Vite/ESM) via a relative path.
// Keep this file framework-free — plain JS data + pure helpers only.
//
// A "code" is an alphabet plus a glyph renderer. morse and rumput share the
// same alphabet (rumput = morse drawn as grass blades). kotak1/kotak2 use a
// grid where a letter's "symbol" is its (row, col) coordinate (1-indexed,
// emitted as the concatenated string `rc`, e.g. "35" for row 3 col 5).

// International Morse Code (letters + digits). Digits are included for the
// reference chart; drills use letters only.
export const MORSE_ALPHABET = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..',
  0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};

// Sandi Kotak 1: 3x3 grid of letters A-I.
export const KOTAK1_GRID = [
  ['A', 'B', 'C'],
  ['D', 'E', 'F'],
  ['G', 'H', 'I'],
];

// Sandi Kotak 2: 5x5 Polybius grid, I/J merged (matches Q-SAN-025 layout:
// A B C D E / F G H I K / L M N O P / Q R S T U / V W X Y Z).
export const KOTAK2_GRID = [
  ['A', 'B', 'C', 'D', 'E'],
  ['F', 'G', 'H', 'I/J', 'K'],
  ['L', 'M', 'N', 'O', 'P'],
  ['Q', 'R', 'S', 'T', 'U'],
  ['V', 'W', 'X', 'Y', 'Z'],
];

const LETTERS_A_Z = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const LETTERS_A_I = 'ABCDEFGHI'.split('');

// Drill words. kotak1 is restricted to letters A-I.
const MORSE_WORDS = [
  'PRAMUKA', 'PANDU', 'BENDERA', 'PELUIT', 'SENIOR', 'PENGGALANG', 'SIAGA',
  'PEMBINA', 'DUTA', 'CINTA', 'BUMI', 'LAUT', 'GUNUNG', 'HUTAN', 'BINTANG',
  'SOAL', 'JAWAB', 'BENAR', 'SALAH', 'PRAJA', 'WIRA', 'KARYA', 'BAKTI',
  'SATYA', 'DARMA', 'SAKTI', 'GARUDA', 'MERAH', 'PUTIH', 'GAGAH', 'BERANI',
  'SETIA', 'JUJUR', 'RELA', 'MUDA', 'DESA', 'KOTA', 'NEGARA', 'BANGSA',
  'DAMAI', 'RUKUN', 'HEMAT', 'TELITI', 'ULET',
];

// Kotak2 merges I/J into one cell, so words containing J are ambiguous when
// decoding. Restrict drill words to A-Z excluding J.
const KOTAK2_WORDS = MORSE_WORDS.filter((w) => !w.includes('J'));
const KOTAK1_WORDS = [
  'BAD', 'BAG', 'BED', 'BIG', 'BID', 'CAB', 'DAD', 'DEAD', 'DEAF', 'FACE',
  'FADE', 'FED', 'FIB', 'FIG', 'GAB', 'HAD', 'HEAD', 'HIDE', 'ICE', 'ADD',
  'EGG', 'AGE', 'AID', 'BEE', 'CAFE', 'CAGE', 'DICE', 'IDEA', 'ICED',
  'BADGE', 'FACED', 'CHIDE', 'ACHED', 'BEAD', 'BIDE', 'DIG', 'GIG', 'HAG',
  'ACE', 'FAD', 'GAD', 'CAD',
];

export const CODES = {
  morse: {
    id: 'morse',
    name: 'Sandi Morse',
    nameEn: 'Morse Code',
    glyph: 'morse',
    alphabet: MORSE_ALPHABET,
    letters: LETTERS_A_Z,
    words: MORSE_WORDS,
  },
  rumput: {
    id: 'rumput',
    name: 'Sandi Rumput',
    nameEn: 'Grass Code',
    glyph: 'grass',
    alphabet: MORSE_ALPHABET, // rumput = morse rendered as grass blades
    letters: LETTERS_A_Z,
    words: MORSE_WORDS,
  },
  kotak1: {
    id: 'kotak1',
    name: 'Sandi Kotak 1',
    nameEn: 'Box Code 1 (3x3)',
    glyph: 'grid',
    grid: KOTAK1_GRID,
    letters: LETTERS_A_I,
    words: KOTAK1_WORDS,
  },
  kotak2: {
    id: 'kotak2',
    name: 'Sandi Kotak 2',
    nameEn: 'Box Code 2 (5x5)',
    glyph: 'grid',
    grid: KOTAK2_GRID,
    letters: LETTERS_A_Z,
    words: KOTAK2_WORDS, // I/J merged; J excluded from drills
  },
};

export const CODE_LIST = Object.values(CODES);

export function getCode(id) {
  return CODES[id] || null;
}

// --- Grid helpers (kotak) ---

// Find the (row, col) of a letter in a grid, 1-indexed. Handles the merged
// I/J cell: both 'I' and 'J' resolve to the cell whose label contains 'I'.
export function coordinateOf(grid, letter) {
  const L = letter.toUpperCase();
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      if (cell === L) return { row: r + 1, col: c + 1, label: cell };
      if (cell.includes('/') && cell.split('/').includes(L)) return { row: r + 1, col: c + 1, label: cell };
    }
  }
  return null;
}

// The symbol string for a letter under a code.
// morse/rumput: the morse string (e.g. '.-.').
// kotak: the concatenated rowcol coordinate (e.g. '35'), matching Q-SAN-025.
export function encodeLetter(code, letter) {
  if (code.glyph === 'grid') {
    const coord = coordinateOf(code.grid, letter);
    return coord ? `${coord.row}${coord.col}` : null;
  }
  return code.alphabet[letter.toUpperCase()] || null;
}

// The letter(s) a symbol decodes to. For kotak a coordinate string '35'
// returns the cell label (e.g. 'P' or 'I/J'); the caller resolves J.
export function decodeSymbol(code, symbol) {
  if (code.glyph === 'grid') {
    const s = String(symbol);
    const row = parseInt(s[0], 10);
    const col = parseInt(s[1], 10);
    if (!row || !col || row > code.grid.length || col > code.grid[0].length) return null;
    return code.grid[row - 1][col - 1];
  }
  const entry = Object.entries(code.alphabet).find(([, v]) => v === symbol);
  return entry ? entry[0] : null;
}

// Encode a whole word into an array of per-letter symbol strings.
export function encodeWord(code, word) {
  return word
    .toUpperCase()
    .split('')
    .map((ch) => encodeLetter(code, ch))
    .filter((s) => s != null);
}

// Decode an array of symbol strings back into a word (uppercase). For grid
// codes, 'J' is collapsed into 'I' (the I/J cell) per the merged layout.
export function decodeWord(code, symbols) {
  return symbols
    .map((s) => decodeSymbol(code, s))
    .filter(Boolean)
    .join('')
    .replace(/^I\/J$/, 'I') // single-letter I/J cell -> I for drill comparison
    .replace(/I\/J/g, 'I');
}

// All (letter, symbol) pairs for a code's drill alphabet. Used by the
// reference chart and the fill-in palette.
export function symbolTiles(code) {
  return code.letters.map((letter) => ({ letter, symbol: encodeLetter(code, letter) }));
}

// Pick a random word from a code's word list.
export function randomWord(code, rng = Math.random) {
  const list = code.words;
  return list[Math.floor(rng() * list.length)];
}

// Pick a random drill letter from a code's alphabet.
export function randomLetter(code, rng = Math.random) {
  const letters = code.letters;
  return letters[Math.floor(rng() * letters.length)];
}

// n distinct distractor symbols, different from `correct` and each other.
export function distractors(code, correct, n, rng = Math.random) {
  const pool = code.letters
    .map((l) => encodeLetter(code, l))
    .filter((s) => s && s !== correct);
  // Fisher-Yates shuffle the pool, take the first n.
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Shuffle helper (Fisher-Yates), returns a new array.
export function shuffle(arr, rng = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}