// Socket + REST API layer. Single shared socket connection.
import { io } from 'socket.io-client';
import { Events } from '../../shared/events.js';

// In dev, Vite proxies /socket.io to the Express server. In prod, same origin.
export const socket = io({ autoConnect: true, reconnection: true });

// ---- REST ----
export async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Gagal memuat kategori');
  const data = await res.json();
  return data.categories;
}

export async function fetchQuiz(category, count) {
  const res = await fetch(`/api/quiz?category=${encodeURIComponent(category)}&count=${count}`);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Gagal memuat pertanyaan');
  }
  const data = await res.json();
  return data.questions;
}

// ---- Socket helpers (promise-based ack) ----
export function createRoom(name) {
  return new Promise((resolve) => {
    socket.emit(Events.ROOM_CREATE, { name }, (res) => resolve(res));
  });
}

export function joinRoom(roomId, name) {
  return new Promise((resolve) => {
    socket.emit(Events.ROOM_JOIN, { roomId, name }, (res) => resolve(res));
  });
}

export function leaveRoom() {
  socket.emit(Events.ROOM_LEAVE);
}

export function setGameConfig(config) {
  return new Promise((resolve) => {
    socket.emit(Events.GAME_CONFIG, config, (res) => resolve(res));
  });
}

export function startGame() {
  return new Promise((resolve) => {
    socket.emit(Events.GAME_START, null, (res) => resolve(res));
  });
}

export function submitAnswer(roundId, optionIndex) {
  socket.emit(Events.ANSWER_SUBMIT, { roundId, optionIndex });
}

// Generic event subscription. Returns an unsubscribe function.
export function on(event, handler) {
  socket.on(event, handler);
  return () => socket.off(event, handler);
}

export { Events };