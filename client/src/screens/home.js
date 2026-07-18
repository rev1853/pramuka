// Landing screen: solo practice, create room, join room.
import { el, button, input, card, heading, mount, toast } from '../ui.js';
import { createRoom, joinRoom } from '../api.js';
import { navigate } from '../main.js';

export function renderHome() {
  const nameInput = input({ placeholder: 'Nama Anda' });

  const startSolo = button('Solo Practice', {}, () => {
    localStorage.setItem('name', nameInput.value || 'Pemain');
    navigate('/solo');
  });

  const poolBtn = button('Bank Soal', { variant: 'secondary' }, () => navigate('/pool'));

  const sandiBtn = button('Latihan Sandi', {}, () => navigate('/sandi'));

  const roomIdInput = input({ placeholder: 'KODE RUANGAN', dataset: { key: 'roomid' } });

  const createBtn = button('Create Room', { variant: 'secondary' }, async () => {
    const name = nameInput.value || 'Host';
    localStorage.setItem('name', name);
    const res = await createRoom(name);
    if (res?.ok) navigate(`/room/${res.roomId}`);
    else toast(res?.error || 'Gagal membuat ruangan');
  });

  const joinBtn = button('Join Room', {}, async () => {
    const id = roomIdInput.value.trim().toUpperCase();
    if (!id) return toast('Masukkan kode ruangan');
    const name = nameInput.value || 'Player';
    localStorage.setItem('name', name);
    const res = await joinRoom(id, name);
    if (res?.ok) navigate(`/room/${id}`);
    else toast(res?.error || 'Gagal bergabung');
  });

  const view = el(
    'div',
    { class: 'max-w-3xl mx-auto px-4 py-12' },
    heading('Pramuka Quiz Host', 'Uji pengetahuan kepramukaan Anda'),
    card(
      el('label', { class: 'block text-sm font-medium text-slate-600 mb-1.5' }, 'Nama'),
      nameInput
    ),
    el(
      'div',
      { class: 'grid md:grid-cols-2 gap-4 mt-4' },
      card(
        el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Latihan Solo'),
        el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, 'Pilih kategori, jawab acak, lihat skor akhir.'),
        startSolo
      ),
      card(
        el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Buat Ruangan'),
        el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, 'Buat ruangan, beri kode ke teman, adu cepat.'),
        createBtn
      ),
      card(
        el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Latihan Sandi'),
        el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, 'Pelajari sandi morse, kotak, dan rumput secara interaktif.'),
        sandiBtn
      ),
      card(
        el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Bank Soal'),
        el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, 'Lihat semua soal, jawaban, dan penjelasan per kategori.'),
        poolBtn
      )
    ),
    card(
      el('h2', { class: 'font-bold text-lg text-slate-900' }, 'Gabung Ruangan'),
      el('p', { class: 'text-slate-500 text-sm mt-1 mb-4' }, 'Masukkan kode ruangan dari host.'),
      el('div', { class: 'flex gap-3' }, roomIdInput, joinBtn)
    )
  );

  mount(view);
}