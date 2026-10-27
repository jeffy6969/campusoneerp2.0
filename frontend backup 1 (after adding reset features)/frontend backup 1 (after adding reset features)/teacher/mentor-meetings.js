lucide.createIcons();

async function loadMentees() {
  const { data, error } = await supabaseClient
    .from('student_details')
    .select('profile_id, roll_number')
    .eq('mentor_id', window.currentUser.id);

  const listEl = document.getElementById('menteesList');
  const selectEl = document.getElementById('meetingStudent');

  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }
  if (!data.length) {
    listEl.innerHTML = '<p class="text-muted">No mentees assigned yet.</p>';
    selectEl.innerHTML = '<option value="">No mentees</option>';
    return;
  }

  const ids = data.map(s => s.profile_id);
  const { data: names } = await supabaseClient.from('public_profiles').select('id, full_name').in('id', ids);
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  listEl.innerHTML = data.map(s => `
    <div class="simple-row">
      <div><div class="row-main">${nameMap[s.profile_id] || 'Unknown'}</div><div class="row-sub">${s.roll_number}</div></div>
    </div>
  `).join('');

  selectEl.innerHTML = '<option value="">Select mentee</option>' +
    data.map(s => `<option value="${s.profile_id}">${nameMap[s.profile_id] || s.roll_number}</option>`).join('');
}

async function loadMeetings() {
  const listEl = document.getElementById('meetingsList');
  const { data, error } = await supabaseClient
    .from('mentor_meetings')
    .select('id, student_id, scheduled_at, duration_minutes, status, notes')
    .eq('mentor_id', window.currentUser.id)
    .order('scheduled_at', { ascending: false });

  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }
  if (!data.length) { listEl.innerHTML = '<p class="text-muted">No meetings scheduled yet.</p>'; return; }

  const studentIds = [...new Set(data.map(m => m.student_id))];
  const { data: names } = await supabaseClient.from('public_profiles').select('id, full_name').in('id', studentIds);
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  listEl.innerHTML = data.map(m => `
    <div class="list-item" data-meeting-id="${m.id}">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${nameMap[m.student_id] || 'Unknown'} — ${new Date(m.scheduled_at).toLocaleString()}</div>
          <div class="text-muted" style="margin-top:4px;">${m.duration_minutes} minutes</div>
        </div>
        <select class="meeting-status-select inline-select">
          <option value="scheduled" ${m.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
          <option value="completed" ${m.status === 'completed' ? 'selected' : ''}>Completed</option>
          <option value="cancelled" ${m.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
          <option value="no_show" ${m.status === 'no_show' ? 'selected' : ''}>No show</option>
        </select>
      </div>
      <textarea class="meeting-notes" rows="2" placeholder="Session notes..." style="margin-top:10px;">${m.notes || ''}</textarea>
      <button class="btn btn-secondary save-meeting-btn" style="margin-top:8px;"><span>Save</span></button>
    </div>
  `).join('');

  listEl.querySelectorAll('.save-meeting-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.list-item');
      const meetingId = item.dataset.meetingId;
      const status = item.querySelector('.meeting-status-select').value;
      const notes = item.querySelector('.meeting-notes').value.trim();

      const { error } = await supabaseClient.from('mentor_meetings')
        .update({ status, notes: notes || null })
        .eq('id', meetingId);

      if (error) { showToast(error.message, 'error'); return; }
      showToast('Meeting updated');
      loadMeetings();
    });
  });
}

document.getElementById('meetingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('meetingError');
  errorBox.classList.remove('visible');

  const studentId = document.getElementById('meetingStudent').value;
  const dateTime = document.getElementById('meetingDateTime').value;
  if (!studentId || !dateTime) {
    errorBox.textContent = 'Mentee and date/time are required.';
    errorBox.classList.add('visible');
    return;
  }

  const { error } = await supabaseClient.from('mentor_meetings').insert({
    mentor_id: window.currentUser.id,
    student_id: studentId,
    scheduled_at: new Date(dateTime).toISOString(),
    duration_minutes: Number(document.getElementById('meetingDuration').value) || 30,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('meetingForm').reset();
  document.getElementById('meetingDuration').value = 30;
  showToast('Meeting scheduled');
  loadMeetings();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Teacher`;
  loadMentees();
  loadMeetings();
});
