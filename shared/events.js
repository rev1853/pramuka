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
  // MCQ payload: { kind:'mcq', roundId, index, total, question, options, seconds }
  // Code payload:  { kind:'code', roundId, index, total, codeType, mode, prompt, seconds }
  QUESTION_SHOW: 'question:show',
  ANSWER_SUBMIT: 'answer:submit', // client->server { roundId, optionIndex }
  // For code fill-in rounds (encode/decode). submission = array of symbols/letters.
  CODE_SUBMIT: 'code:submit', // client->server { roundId, submission }
  // MCQ result: { ..., correctIndex }
  // Code result: { ..., correct }
  ANSWER_RESULT: 'answer:result',
  // MCQ timeout: { correctIndex }
  // Code timeout: { correctSequence }
  QUESTION_TIMEOUT: 'question:timeout',
  QUESTION_NEXT: 'question:next', // server->room: { index } (advance signal)

  // Errors
  ERROR: 'error', // server->client: { message }
};

// Default room config. Host can override via game:config.
export const DEFAULT_CONFIG = {
  mode: 'mcq', // 'mcq' or 'code'
  category: 'all', // 'all' or a category id
  questionCount: 10,
  points: 10, // awarded for correct (first buzz)
  penalty: 10, // subtracted for wrong (first buzz)
  secondsPerQuestion: 20, // server-side timer; 0 buzz in time => both 0
  // code-mode defaults
  code: 'morse',
  drillMode: 'choice',
};

export const MAX_PLAYERS = 2;