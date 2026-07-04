// Buzzer game state machine. Server-authoritative: clients send intents,
// the server validates, mutates state, and broadcasts filtered snapshots.
import { roomStore } from '../lib/roomStore.js';
import { questionBank } from '../lib/questionBank.js';
import { Events, DEFAULT_CONFIG } from '../../shared/events.js';

const REVEAL_DELAY_MS = 3500; // how long to show the answer before advancing

const CONFIG_LIMITS = {
  questionCount: { min: 1, max: 50 },
  points: { min: 1, max: 1000 },
  penalty: { min: 0, max: 1000 },
  secondsPerQuestion: { min: 5, max: 120 },
};

export function registerGameHandlers(io, socket) {
  // Host sets room config before starting.
  socket.on(Events.GAME_CONFIG, (cfg = {}, ack) => {
    const roomId = socket.data.roomId;
    const room = roomStore.get(roomId);
    if (!room) return ack?.({ ok: false, error: 'Anda tidak ada di ruangan.' });
    if (socket.id !== room.hostSocketId) return ack?.({ ok: false, error: 'Hanya host yang bisa mengatur.' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'Permainan sudah berjalan.' });

    const config = {
      category: typeof cfg.category === 'string' ? cfg.category : DEFAULT_CONFIG.category,
      questionCount: clamp(cfg.questionCount ?? DEFAULT_CONFIG.questionCount, CONFIG_LIMITS.questionCount),
      points: clamp(cfg.points ?? DEFAULT_CONFIG.points, CONFIG_LIMITS.points),
      penalty: clamp(cfg.penalty ?? DEFAULT_CONFIG.penalty, CONFIG_LIMITS.penalty),
      secondsPerQuestion: clamp(cfg.secondsPerQuestion ?? DEFAULT_CONFIG.secondsPerQuestion, CONFIG_LIMITS.secondsPerQuestion),
    };
    room.config = config;
    roomStore.touch(roomId);
    ack?.({ ok: true });
    io.to(roomId).emit(Events.ROOM_STATE, roomStore.snapshot(room));
  });

  // Host starts the game.
  socket.on(Events.GAME_START, (_payload, ack) => {
    const roomId = socket.data.roomId;
    const room = roomStore.get(roomId);
    if (!room) return ack?.({ ok: false, error: 'Anda tidak ada di ruangan.' });
    if (socket.id !== room.hostSocketId) return ack?.({ ok: false, error: 'Hanya host yang bisa memulai.' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'Permainan sudah berjalan.' });
    if (room.players.length < 2) return ack?.({ ok: false, error: 'Butuh 2 pemain untuk memulai.' });

    const cfg = room.config || DEFAULT_CONFIG;
    try {
      room.questions = questionBank.getQuestions({ category: cfg.category, count: cfg.questionCount });
    } catch (e) {
      return ack?.({ ok: false, error: e.message });
    }
    if (room.questions.length === 0) {
      return ack?.({ ok: false, error: 'Tidak ada pertanyaan untuk kategori ini.' });
    }

    room.status = 'playing';
    room.questionIndex = -1;
    room.players.forEach((p) => (p.score = 0));
    roomStore.touch(roomId);
    ack?.({ ok: true });
    io.to(roomId).emit(Events.ROOM_STATE, roomStore.snapshot(room));
    sendQuestion(io, room);
  });

  // A player buzzes in an answer.
  socket.on(Events.ANSWER_SUBMIT, ({ roundId, optionIndex } = {}) => {
    const roomId = socket.data.roomId;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    // Stale round (lagged/duplicate) — ignore silently.
    if (roundId !== room.roundId) return;
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 3) return;
    if (room.buzzerSocketId) {
      // Someone already buzzed this round. Tell this client it was too late.
      socket.emit(Events.ANSWER_RESULT, { roundId, tooLate: true });
      return;
    }

    const player = roomStore.findPlayer(roomId, socket.id);
    if (!player) return;

    room.buzzerSocketId = socket.id;
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }

    const question = room.questions[room.questionIndex];
    const correct = optionIndex === question.answer;

    if (correct) {
      player.score += room.config.points;
    } else {
      player.score -= room.config.penalty;
    }
    roomStore.touch(roomId);

    io.to(roomId).emit(Events.ANSWER_RESULT, {
      roundId,
      winnerId: socket.id,
      winnerName: player.name,
      correct,
      chosenIndex: optionIndex,
      correctIndex: question.answer,
      explanation: question.explanation ?? null,
      scores: scoreboard(room),
    });

    scheduleAdvance(io, room);
  });
}

// Send the current question to the room (never includes the answer).
function sendQuestion(io, room) {
  room.questionIndex += 1;
  room.roundId = `${room.roomId}-${room.questionIndex}-${Date.now().toString(36)}`;
  room.buzzerSocketId = null;
  if (room.timer) clearTimeout(room.timer);

  const question = room.questions[room.questionIndex];
  io.to(room.roomId).emit(Events.QUESTION_SHOW, {
    roundId: room.roundId,
    index: room.questionIndex,
    total: room.questions.length,
    question: question.question,
    options: question.options,
    seconds: room.config.secondsPerQuestion,
  });

  // Server-owned timeout: no buzz in time => both 0, advance.
  room.timer = setTimeout(() => {
    const r = roomStore.get(room.roomId);
    if (!r || r.status !== 'playing' || r.roundId !== room.roundId) return;
    r.timer = null;
    const q = r.questions[r.questionIndex];
    io.to(r.roomId).emit(Events.QUESTION_TIMEOUT, {
      roundId: r.roundId,
      correctIndex: q.answer,
      explanation: q.explanation ?? null,
      scores: scoreboard(r),
    });
    scheduleAdvance(io, r);
  }, room.config.secondsPerQuestion * 1000);
}

// Reveal pause, then advance to next question or end.
function scheduleAdvance(io, room) {
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  room.advanceTimer = setTimeout(() => {
    const r = roomStore.get(room.roomId);
    if (!r || r.status !== 'playing') return;
    r.advanceTimer = null;
    if (r.questionIndex + 1 >= r.questions.length) {
      endGame(io, r);
    } else {
      sendQuestion(io, r);
    }
  }, REVEAL_DELAY_MS);
}

function endGame(io, room) {
  room.status = 'finished';
  if (room.timer) clearTimeout(room.timer);
  if (room.advanceTimer) clearTimeout(room.advanceTimer);
  roomStore.touch(room.roomId);
  const scores = scoreboard(room);
  const winnerScore = Math.max(...scores.map((s) => s.score));
  const winners = scores.filter((s) => s.score === winnerScore);
  io.to(room.roomId).emit(Events.GAME_END, {
    scores,
    winner: winners.length === 1 ? winners[0].name : null,
    tie: winners.length > 1,
  });
  io.to(room.roomId).emit(Events.ROOM_STATE, roomStore.snapshot(room));
}

function scoreboard(room) {
  return room.players.map((p) => ({ name: p.name, score: p.score }));
}

function clamp(value, limits) {
  const n = Number(value);
  if (!Number.isFinite(n)) return limits.min;
  return Math.max(limits.min, Math.min(limits.max, Math.floor(n)));
}