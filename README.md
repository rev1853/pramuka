# Pramuka Quiz Host

A real-time multiplayer **Pramuka (Indonesian Scouting)** quiz host. Practice solo with randomized questions across 13 categories, or create a room and race a friend on the buzzer.

## Modes

- **Solo practice** — pick a category (or "all"), answer N randomized questions with immediate feedback, end with a score tally. No timer, no negative scoring.
- **Multiplayer room** — host creates a room (short ID), a second player joins by ID. Both see the same question. **Buzzer model**: the first to answer locks the question.
  - Correct answer → `+points`
  - Wrong answer → `−penalty`, other player gets `0`
  - No answer before the timer → both `0`
  - Points, penalty, timer, and question count are **configurable per room** by the host.

## Tech stack

- **Backend:** Node.js + Express + Socket.IO v4 (server-authoritative rooms, in-memory state)
- **Frontend:** Vite + vanilla JS + Tailwind CSS (CDN)
- **Shared:** `shared/events.js` event constants

## Getting started

```bash
npm run install:all   # installs root + server + client deps
npm run dev           # server (backend) on :3000, client (Vite) on :3005 (proxies /socket.io)
```

Open http://localhost:3005.

### Production (single port)

```bash
npm run build   # builds client -> client/dist
npm start       # serves client/dist + Socket.IO on :3005
```

Open http://localhost:3005.

## Question pool

Questions live in `server/data/questions.json`, grouped by the 13 Pramuka categories. **See [`question-pool-guide.md`](./question-pool-guide.md) for the full authoring guide.** In short, edit `questionsByCategory.<categoryId>` — each entry:

```json
{
  "id": "Q-INT-001",
  "question": "Pertanyaan di sini?",
  "options": ["A", "B", "C", "D"],
  "answer": 0,
  "explanation": "Penjelasan singkat (opsional)"
}
```

- `options` must have exactly 4 entries (index 0–3).
- `answer` is the correct option index (0–3).
- `id` must be unique (`Q-<CAT>-###` convention).
- `explanation` is optional, shown after the answer reveal.

The server validates the pool at startup and logs warnings for any malformed entries.

## Categories

| id | Name |
|---|---|
| `internasional` | Kepramukaan Internasional |
| `istilah-umum` | Istilah Umum Pramuka |
| `upacara` | Upacara & Ritual |
| `lambang` | Lambang & Atribut Pramuka |
| `dasa-darma` | Dasa Darma & Tri Satya |
| `berkemah` | Berkemah & Bertahan Hidup |
| `navigasi` | Navigasi & Pemetaan |
| `pertolongan` | Pertolongan Pertama |
| `tali-temali` | Tali Temali |
| `sandi` | Sandi-sandi |
| `struktur` | Struktur Gerakan Pramuka |
| `sejarah-id` | Sejarah Pramuka Indonesia |
| `sejarah-dunia` | Sejarah Kepramukaan Dunia |

## Known limitations (v1)

- Reconnect-mid-question is best-effort: rejoining by the same room ID + name rehydrates your score by name match. Robust session tokens are a follow-up.
- Room state is in-memory (single server). To scale horizontally, swap in `@socket.io/redis-adapter`.# pramuka
