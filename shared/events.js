// Shared event-name constants for the Pramuka quiz host.
// Imported by both server (Node) and client (Vite/ESM) via a relative path.
// Keep this file framework-free — plain JS constants only.

export const Events = {
  // Room lifecycle
  ROOM_CREATE: 'room:create', // client->server { name } -> ack { roomId, error? }
  ROOM_JOIN: 'room:join', // client->server { roomId, name } -> ack { ok, error? }
  ROOM_LEAVE: 'room:leave', // client->server
  ROOM_SYNC: 'room:sync', // client->server (request current state for this socket's room)
  ROOM_STATE: 'room:state', // server->room: { roomId, status, players, config }

  // Game flow (host-only writes)
  GAME_CONFIG: 'game:config', // host->server { category, questionCount, points, penalty, secondsPerQuestion }
  GAME_START: 'game:start', // host->server
  GAME_END: 'game:end', // server->room: { scores: [{name, score}], winner }

  // Question round
  QUESTION_SHOW: 'question:show', // server->room: { roundId, index, total, question, options, seconds }
  ANSWER_SUBMIT: 'answer:submit', // client->server { roundId, optionIndex }
  ANSWER_RESULT: 'answer:result', // server->room: { roundId, winnerId, winnerName, correct, chosenIndex, correctIndex, scores }
  QUESTION_TIMEOUT: 'question:timeout', // server->room: { roundId, correctIndex, scores }
  QUESTION_NEXT: 'question:next', // server->room: { index } (advance signal)

  // Errors
  ERROR: 'error', // server->client: { message }
};

// Default room config. Host can override via game:config.
export const DEFAULT_CONFIG = {
  category: 'all', // 'all' or a category id
  questionCount: 10,
  points: 10, // awarded for correct (first buzz)
  penalty: 10, // subtracted for wrong (first buzz)
  secondsPerQuestion: 20, // server-side timer; 0 buzz in time => both 0
};

export const MAX_PLAYERS = 2;