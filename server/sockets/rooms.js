// Room lifecycle handlers: create / join / leave.
import { customAlphabet } from 'nanoid';
import { roomStore } from '../lib/roomStore.js';
import { Events, MAX_PLAYERS } from '../../shared/events.js';

// 4-char room codes, unambiguous alphabet (no look-alikes).
const generateId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);

export function registerRoomHandlers(io, socket) {
  // Create a room. The creator becomes the host.
  socket.on(Events.ROOM_CREATE, ({ name } = {}, ack) => {
    const playerName = (name || 'Host').toString().slice(0, 24);
    let roomId;
    do {
      roomId = generateId();
    } while (roomStore.has(roomId));

    socket.join(roomId);
    const room = roomStore.create(roomId, socket.id, playerName);
    socket.data.roomId = roomId;
    socket.data.name = playerName;

    console.log(`[rooms] ${playerName} created room ${roomId}`);
    ack?.({ ok: true, roomId });
    io.to(roomId).emit(Events.ROOM_STATE, roomStore.snapshot(room));
  });

  // Join an existing room by ID.
  socket.on(Events.ROOM_JOIN, ({ roomId, name } = {}, ack) => {
    const id = (roomId || '').toString().toUpperCase();
    const playerName = (name || 'Player').toString().slice(0, 24);
    const room = roomStore.get(id);

    if (!room) return ack?.({ ok: false, error: 'Room tidak ditemukan.' });
    if (room.status !== 'lobby') return ack?.({ ok: false, error: 'Permainan sudah dimulai.' });
    if (room.players.length >= MAX_PLAYERS) return ack?.({ ok: false, error: 'Ruangan sudah penuh.' });
    if (room.players.some((p) => p.name === playerName)) {
      return ack?.({ ok: false, error: 'Nama sudah dipakai di ruangan ini.' });
    }

    socket.join(id);
    room.players.push({ socketId: socket.id, name: playerName, score: 0 });
    socket.data.roomId = id;
    socket.data.name = playerName;
    roomStore.touch(id);

    console.log(`[rooms] ${playerName} joined room ${id}`);
    ack?.({ ok: true, roomId: id });
    io.to(id).emit(Events.ROOM_STATE, roomStore.snapshot(room));
  });

  // Leave the current room.
  socket.on(Events.ROOM_LEAVE, () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.leave(roomId);
    handleDeparture(io, socket, roomId);
  });

  // Request current state for this socket's room (handles the race where
  // the client subscribes after the room-creation/join broadcast fired).
  socket.on(Events.ROOM_SYNC, () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;
    socket.emit(Events.ROOM_STATE, roomStore.snapshot(room));
  });
}

// Shared by ROOM_LEAVE and disconnecting.
export function handleDeparture(io, socket, roomId) {
  const room = roomStore.removePlayer(roomId, socket.id);
  if (socket.data.roomId === roomId) {
    delete socket.data.roomId;
  }
  if (room) {
    io.to(roomId).emit(Events.ROOM_STATE, roomStore.snapshot(room));
  }
}