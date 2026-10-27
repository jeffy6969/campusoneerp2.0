lucide.createIcons();
const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function loadRooms() {
  const { data, error } = await supabaseClient.from('rooms').select('room_number, capacity, room_type').order('room_number');
  const listEl = document.getElementById('roomsList');
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }
  listEl.innerHTML = data.length ? data.map(r => `
    <div class="simple-row">
      <div><div class="row-main">${r.room_number}</div><div class="row-sub">${r.room_type.replace('_', ' ')}${r.capacity ? ` · Capacity ${r.capacity}` : ''}</div></div>
    </div>
  `).join('') : '<p class="text-muted">No rooms yet.</p>';
}

async function loadSlots() {
  const { data, error } = await supabaseClient
    .from('timetable_slots')
    .select('day_of_week, period_number, start_time, end_time')
    .order('day_of_week')
    .order('period_number');
  const listEl = document.getElementById('slotsList');
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }
  listEl.innerHTML = data.length ? data.map(s => `
    <div class="simple-row">
      <div><div class="row-main">${DAYS[s.day_of_week]}, Period ${s.period_number}</div><div class="row-sub">${s.start_time} \u2013 ${s.end_time}</div></div>
    </div>
  `).join('') : '<p class="text-muted">No slots yet.</p>';
}

document.getElementById('roomForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('roomError');
  errorBox.classList.remove('visible');
  const { error } = await supabaseClient.from('rooms').insert({
    room_number: document.getElementById('roomNumber').value.trim(),
    capacity: Number(document.getElementById('roomCapacity').value) || null,
    room_type: document.getElementById('roomType').value,
  });
  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('roomForm').reset();
  showToast('Room added');
  loadRooms();
});

document.getElementById('slotForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('slotError');
  errorBox.classList.remove('visible');
  const { error } = await supabaseClient.from('timetable_slots').insert({
    day_of_week: Number(document.getElementById('slotDay').value),
    period_number: Number(document.getElementById('slotPeriod').value),
    start_time: document.getElementById('slotStart').value,
    end_time: document.getElementById('slotEnd').value,
  });
  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('slotForm').reset();
  showToast('Slot added');
  loadSlots();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadRooms();
  loadSlots();
});
