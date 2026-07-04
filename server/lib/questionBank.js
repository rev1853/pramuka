// Loads + validates the question pool, builds per-category indexes, and
// serves randomized question subsets. The server never mutates originals.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const QUESTIONS_PATH = join(__dirname, '..', 'data', 'questions.json');

/** @typedef {{ id:string, question:string, options:string[], answer:number, explanation?:string }} Question */
/** @typedef {{ id:string, name:string, nameEn:string }} Category */

export class QuestionBank {
  constructor() {
    /** @type {Category[]} */
    this.categories = [];
    /** @type {Map<string, Question[]>} category id -> questions (includes 'all') */
    this.byCategory = new Map();
    this.loaded = false;
  }

  async load() {
    const raw = await readFile(QUESTIONS_PATH, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.categories) || !data.questionsByCategory) {
      throw new Error('questions.json: missing "categories" or "questionsByCategory"');
    }

    this.categories = data.categories;
    const seenIds = new Set();
    const all = [];

    for (const cat of this.categories) {
      const list = data.questionsByCategory[cat.id];
      if (!Array.isArray(list)) {
        console.warn(`[questionBank] category "${cat.id}" has no questions array; using []`);
        this.byCategory.set(cat.id, []);
        continue;
      }
      const validated = [];
      for (const q of list) {
        const err = this._validate(q, cat.id);
        if (err) {
          console.warn(`[questionBank] ${cat.id}: ${err} (skipping)`);
          continue;
        }
        if (seenIds.has(q.id)) {
          console.warn(`[questionBank] duplicate id "${q.id}" (skipping)`);
          continue;
        }
        seenIds.add(q.id);
        validated.push({ ...q }); // shallow copy so callers can't mutate originals
      }
      this.byCategory.set(cat.id, validated);
      all.push(...validated);
    }
    this.byCategory.set('all', all);
    this.loaded = true;

    const counts = [...this.byCategory.entries()]
      .filter(([k]) => k !== 'all')
      .map(([k, v]) => `${k}:${v.length}`)
      .join(' ');
    console.log(`[questionBank] loaded ${all.length} questions across ${this.categories.length} categories [${counts}]`);
  }

  _validate(q, catId) {
    if (!q || typeof q !== 'object') return 'entry is not an object';
    if (typeof q.id !== 'string' || !q.id) return 'missing id';
    if (typeof q.question !== 'string' || !q.question) return 'missing question';
    if (!Array.isArray(q.options) || q.options.length !== 4) return 'options must have exactly 4 entries';
    if (q.options.some((o) => typeof o !== 'string' || !o)) return 'options must all be non-empty strings';
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) return 'answer must be an integer 0-3';
    if (q.explanation != null && typeof q.explanation !== 'string') return 'explanation must be a string if present';
    return null;
  }

  /** Return the public list of categories for the client picker. */
  listCategories() {
    return this.categories.map((c) => ({ id: c.id, name: c.name, nameEn: c.nameEn }));
  }

  countFor(category) {
    return (this.byCategory.get(category) || []).length;
  }

  /**
   * Get a randomized subset of questions for a category.
   * Returns copies; originals are untouched.
   * @param {{ category:string, count:number }} opts
   * @returns {Question[]}
   */
  getQuestions({ category, count }) {
    const pool = this.byCategory.get(category) || [];
    if (pool.length === 0) {
      throw new Error(`No questions available for category "${category}"`);
    }
    const shuffled = this._shuffle(pool).map((q) => ({ ...q }));
    const n = Math.min(count, shuffled.length);
    return shuffled.slice(0, n);
  }

  /** Fisher–Yates shuffle (returns a new array). */
  _shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

// Singleton
export const questionBank = new QuestionBank();