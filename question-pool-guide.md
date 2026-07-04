# Question Pool Guide

How to author questions for the Pramuka Quiz Host. **You only ever edit one file: `server/data/questions.json`.**

---

## Where the questions live

`server/data/questions.json` — already structured with all 13 categories. A starter set of 1–2 example questions per category is included so the app runs immediately. Replace the placeholders with your real questions.

---

## Question shape

Each question is one object:

```json
{
  "id": "Q-IST-002",
  "question": "Apa kepanjangan dari PRAMUKA?",
  "options": ["Praja Muda Karana", "Praja Muda Karya", "Putra Muda Karana", "Praja Mulia Karana"],
  "answer": 0,
  "explanation": "Pramuka = Praja Muda Karana, berarti rakyat muda yang suka berkarya."
}
```

### Field rules

| Field      | Required | Notes                                                        |
| ---------- | -------- | ------------------------------------------------------------ |
| `id`       | ✅       | Unique. Convention: `Q-<CAT>-###` (e.g. `Q-IST-002`)         |
| `question` | ✅       | The prompt text                                              |
| `options`  | ✅       | **Exactly 4** strings, indexed 0–3                          |
| `answer`   | ✅       | Integer `0`–`3` = the correct option index                  |
| `explanation` | optional | Shown after the answer reveal                             |

---

## How the file is organized

Questions are grouped under `questionsByCategory`, keyed by category id. Add objects to the right category's array:

```json
{
  "version": 1,
  "categories": [ "…13 categories with id + name…" ],
  "questionsByCategory": {
    "istilah-umum": [
      { "id": "Q-IST-001", "question": "…", "options": ["…","…","…","…"], "answer": 0 },
      { "id": "Q-IST-002", "question": "…", "options": ["…","…","…","…"], "answer": 2 }
    ],
    "upacara": [
      { "id": "Q-UPA-001", "question": "…", "options": ["…","…","…","…"], "answer": 1 }
    ]
  }
}
```

---

## The 13 categories

| id              | Category                         |
| --------------- | -------------------------------- |
| `internasional` | Kepramukaan Internasional        |
| `istilah-umum`  | Istilah Umum Pramuka             |
| `upacara`       | Upacara & Ritual                 |
| `lambang`       | Lambang & Atribut Pramuka        |
| `dasa-darma`    | Dasa Darma & Tri Satya           |
| `berkemah`      | Berkemah & Bertahan Hidup        |
| `navigasi`      | Navigasi & Pemetaan              |
| `pertolongan`   | Pertolongan Pertama             |
| `tali-temali`   | Tali Temali                      |
| `sandi`         | Sandi-sandi                      |
| `struktur`      | Struktur Gerakan Pramuka         |
| `sejarah-id`    | Sejarah Pramuka Indonesia        |
| `sejarah-dunia` | Sejarah Kepramukaan Dunia        |

The UI category picker is generated automatically from the `categories` array — no frontend changes needed.

---

## Important details

- **Valid JSON only** — no trailing commas, no comments. A malformed file stops the server from starting (the error is logged).
- **Validation runs on startup** — the server checks each question (4 options, `answer` in 0–3, unique `id`) and **logs warnings** for any bad entries, skipping them rather than crashing. One typo won't break the rest.
- **Restart the server after editing** (`Ctrl+C` then `npm run dev` again) — the pool is loaded once at boot.
- **No other file needs editing** — the server handles randomization and slicing per game.

---

## Easiest workflow

1. Open `server/data/questions.json`.
2. Replace the placeholder objects under each category with your real questions (keep `id`, `question`, `options` (4), `answer`).
3. Save → restart the server.
4. Done. Solo mode and multiplayer rooms draw from your pool.

---

## Example: a complete category block

```json
"berkemah": [
  {
    "id": "Q-BER-001",
    "question": "Apakah nama tenda berbentuk segitiga yang umum dipakai pramuka?",
    "options": ["Tenda dome", "TendA alpha / wedish", "Tenda tunnel", "Tenda cabin"],
    "answer": 1,
    "explanation": "Tenda alpha (wedish) adalah tenda segitiga klasik yang lazim dipakai dalam berkemah pramuka."
  },
  {
    "id": "Q-BER-002",
    "question": "Berapa jarak ideal dari sumber air ketika mendirikan tenda?",
    "options": ["Tepat di tepi sumber air", "Sekitar 50–200 meter dari sumber air", "Lebih dari 5 km", "Tidak perlu air"],
    "answer": 1
  }
]
```

> Replace the placeholder option text above with your own accurate distractors before using.