// In-memory store of active rooms. Single-server is fine for v1.
// To scale horizontally, swap in @socket.io/redis-adapter + a shared store.

const ROOM_TTL_MS = 2 * 60 * 60 * 1000; // reap rooms idle > 2h
const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // sweep every 10 min

export class RoomStore {
  constructor() {
    /** @type {Map<string, object>} roomId -> RoomState */
    this.rooms = new Map();
    this._sweeper = setInterval(() => this._sweep(), SWEEP_INTERVAL_MS);
    this._sweeper.unref?.(); // don't keep process alive
  }

  create(roomId, hostSocketId, name) {
    const room = {
      roomId,
      hostSocketId,
      status: 'lobby', // 'lobby' | 'playing' | 'finished'
      players: [{ socketId: hostSocketId, name, score: 0 }],
      config: null, // set via game:config
      questions: [],
      questionIndex: -1,
      roundId: null,
      buzzerSocketId: null,
      timer: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  get(roomId) {
    return this.rooms.get(roomId);
  }

  has(roomId) {
    return this.rooms.has(roomId);
  }

  removePlayer(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    room.players = room.players.filter((p) => p.socketId !== socketId);
    if (room.hostSocketId === socketId) {
      // Promote the next remaining player to host, if any.
      room.hostSocketId = room.players[0]?.socketId ?? null;
    }
    room.updatedAt = Date.now();
    if (room.players.length === 0) {
      this._destroy(roomId);
      return null;
    }
    return room;
  }

  findPlayer(roomId, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;
    return room.players.find((p) => p.socketId === socketId) ?? null;
  }

  touch(roomId) {
    const room = this.rooms.get(roomId);
    if (room) room.updatedAt = Date.now();
  }

  _destroy(roomId) {
    const room = this.rooms.get(roomId);
    if (room?.timer) clearTimeout(room.timer);
    this.rooms.delete(roomId);
  }

  _sweep() {
    const now = Date.now();
    for (const [roomId, room] of this.rooms) {
      if (now - room.updatedAt > ROOM_TTL_MS) {
        console.log(`[roomStore] reaping idle room ${roomId}`);
        this._destroy(roomId);
      }
    }
  }

  /** Build a safe, broadcast-ready snapshot of room state. */
  snapshot(room) {
    return {
      roomId: room.roomId,
      status: room.status,
      hostSocketId: room.hostSocketId,
      players: room.players.map((p) => ({ name: p.name, score: p.score, isHost: p.socketId === room.hostSocketId })),
      config: room.config,
      questionIndex: room.status === 'playing' ? room.questionIndex : -1,
      totalQuestions: room.questions.length,
    };
  }
}

export const roomStore = new RoomStore();