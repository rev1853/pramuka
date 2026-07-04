// Hash router. Mounts the right screen and tears down the room screen
// (socket subscriptions) when navigating away.
import { renderHome } from './screens/home.js';
import { renderSolo } from './screens/solo.js';
import { renderPool } from './screens/pool.js';
import { renderRoom, cleanupRoom } from './screens/room.js';
import { leaveRoom } from './api.js';

let currentRoute = null;

export function navigate(path) {
  if (location.hash !== `#${path}`) {
    location.hash = path;
  } else {
    handleRoute();
  }
}

function handleRoute() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const parts = hash.split('/').filter(Boolean); // e.g. ['solo'] or ['room','ABCD']

  // Tear down room screen if we're leaving it.
  if (currentRoute === 'room' && !(parts[0] === 'room' && parts[1])) {
    leaveRoom();
    cleanupRoom();
  }
  currentRoute = null;

  if (parts.length === 0) {
    currentRoute = 'home';
    renderHome();
  } else if (parts[0] === 'solo') {
    currentRoute = 'solo';
    renderSolo();
  } else if (parts[0] === 'pool') {
    currentRoute = 'pool';
    renderPool();
  } else if (parts[0] === 'room' && parts[1]) {
    currentRoute = 'room';
    renderRoom(parts[1]);
  } else {
    renderHome();
  }
}

window.addEventListener('hashchange', handleRoute);
// Module scripts are deferred — the DOM is already parsed here.
handleRoute();