// Generates and validates sandi "code" drill questions. Parallel to
// questionBank.js but for the interactive code practice (morse, kotak, rumput).
//
// Question shapes (all carry kind:'code' so renderers can branch):
//   choice: { id, kind, codeType, mode:'choice', prompt, options:[4], answer, explanation }
//   encode: { id, kind, codeType, mode:'encode', prompt: <word>, expected: [<sym>...], explanation }
//   decode: { id, kind, codeType, mode:'decode', prompt: [<sym>...],  expected: <word>,  explanation }
//
// `expected`/`answer` are full data. Solo endpoints return them (self-checked
// client-side, like /api/quiz returns `answer`). Multiplayer sendQuestion
// strips them — the server validates CODE_SUBMIT against the stored question.
import {
  CODE_LIST,
  getCode,
  encodeLetter,
  encodeWord,
  distractors,
  randomWord,
  randomLetter,
  shuffle,
} from '../../shared/codes.js';

let counter = 0;

function nextId(code, mode) {
  counter += 1;
  return `C-${code}-${mode}-${counter}`;
}

function generateChoice(c, rng) {
  const letter = randomLetter(c, rng);
  const correct = encodeLetter(c, letter);
  const opts = shuffle([correct, ...distractors(c, correct, 3, rng)], rng);
  const answer = opts.indexOf(correct);
  const prompt =
    c.glyph === 'grid'
      ? `${c.name} untuk huruf ${letter} ada di koordinat...`
      : `${c.name} untuk huruf ${letter} adalah...`;
  const explanation =
    c.glyph === 'grid'
      ? `Huruf ${letter} berada di koordinat (${correct[0]},${correct[1]}).`
      : `Huruf ${letter} = ${correct}.`;
  return { id: nextId(c.id, 'choice'), kind: 'code', codeType: c.id, mode: 'choice', prompt, options: opts, answer, explanation };
}

function generateEncode(c, rng) {
  const word = randomWord(c, rng);
  const expected = encodeWord(c, word);
  return {
    id: nextId(c.id, 'encode'),
    kind: 'code',
    codeType: c.id,
    mode: 'encode',
    prompt: word,
    expected,
    explanation: `${word} → ${expected.join(' ')}`,
  };
}

function generateDecode(c, rng) {
  const word = randomWord(c, rng);
  const symbols = encodeWord(c, word);
  return {
    id: nextId(c.id, 'decode'),
    kind: 'code',
    codeType: c.id,
    mode: 'decode',
    prompt: symbols,
    expected: word,
    explanation: `${symbols.join(' ')} → ${word}`,
  };
}

const GENERATORS = {
  choice: generateChoice,
  encode: generateEncode,
  decode: generateDecode,
};

export function generate({ code, mode, count, rng = Math.random }) {
  const c = getCode(code);
  if (!c) throw new Error(`Unknown code: ${code}`);
  const gen = GENERATORS[mode];
  if (!gen) throw new Error(`Unknown mode: ${mode}`);
  const n = Math.max(1, Math.min(50, parseInt(count, 10) || 10));
  const out = [];
  for (let i = 0; i < n; i++) out.push(gen(c, rng));
  return out;
}

// Compare a client submission to a question's expected answer.
//   choice: submission = optionIndex (int)
//   encode: submission = [<sym>, ...]
//   decode: submission = [<letter>, ...]
export function validate(question, submission) {
  if (!question || question.kind !== 'code') return false;
  if (question.mode === 'choice') {
    return Number.isInteger(submission) && submission === question.answer;
  }
  if (question.mode === 'encode') {
    const got = Array.isArray(submission) ? submission.map((s) => String(s).trim()) : [];
    const exp = (question.expected || []).map((s) => String(s).trim());
    return got.length === exp.length && got.every((s, i) => s === exp[i]);
  }
  if (question.mode === 'decode') {
    const got = (Array.isArray(submission) ? submission : [])
      .map((s) => String(s).toUpperCase().trim())
      .join('');
    return got === String(question.expected || '').toUpperCase();
  }
  return false;
}

// Public list for the client picker (no alphabet/word data leaked beyond
// what's already in shared/codes.js, which the client imports directly).
export function listCodes() {
  return CODE_LIST.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn, glyph: c.glyph }));
}

export const codeBank = { generate, validate, listCodes };