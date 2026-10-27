lucide.createIcons();

const courseSelect = document.getElementById('courseSelect');
const slotSelect = document.getElementById('slotSelect');
const sessionDateInput = document.getElementById('sessionDate');
const openSessionBtn = document.getElementById('openSessionBtn');
const rosterWrap = document.getElementById('rosterWrap');
const rosterList = document.getElementById('rosterList');

sessionDateInput.valueAsDate = new Date();

async function loadCourses() {
  const { data, error } = await supabaseClient
    .from('course_offerings')
    .select('id, courses(code, name), sections(name)')
    .eq('teacher_id', window.currentUser.id);

  if (error || !data || data.length === 0) {
    courseSelect.innerHTML = '<option value="">No courses assigned</option>';
    return;
  }
  courseSelect.innerHTML = data.map(co =>
    `<option value="${co.id}">${co.courses.code} — ${co.courses.name} (Sec ${co.sections.name})</option>`
  ).join('');
  loadSlots();
}

async function loadSlots() {
  const offeringId = courseSelect.value;
  if (!offeringId) return;

  const { data, error } = await supabaseClient
    .from('timetable_entries')
    .select('id, timetable_slots(day_of_week, period_number)')
    .eq('course_offering_id', offeringId);

  const days = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (error || !data || data.length === 0) {
    slotSelect.innerHTML = '<option value="">No timetable slot found</option>';
    return;
  }
  slotSelect.innerHTML = data.map(te =>
    `<option value="${te.id}">${days[te.timetable_slots.day_of_week]} · Period ${te.timetable_slots.period_number}</option>`
  ).join('');
}
courseSelect.addEventListener('change', loadSlots);

openSessionBtn.addEventListener('click', async () => {
  const timetableEntryId = slotSelect.value;
  const sessionDate = sessionDateInput.value;
  if (!timetableEntryId || !sessionDate) {
    showToast('Pick a course, slot, and date first', 'error');
    return;
  }

  let { data: existing } = await supabaseClient
    .from('class_sessions')
    .select('id')
    .eq('timetable_entry_id', timetableEntryId)
    .eq('session_date', sessionDate)
    .maybeSingle();

  let sessionId = existing?.id;

  if (!sessionId) {
    const { data: created, error: createError } = await supabaseClient
      .from('class_sessions')
      .insert({ timetable_entry_id: timetableEntryId, session_date: sessionDate })
      .select('id')
      .single();
    if (createError) {
      showToast(createError.message, 'error');
      return;
    }
    sessionId = created.id;
  }

  await loadRoster(sessionId);
});

async function loadRoster(sessionId) {
  const { data, error } = await supabaseClient
    .from('attendance_records')
    .select('id, status, student_id, student_details(roll_number)')
    .eq('session_id', sessionId);

  if (error) {
    showToast('Could not load roster: ' + error.message, 'error');
    return;
  }

  const studentIds = data.map(r => r.student_id);
  const { data: names } = await supabaseClient
    .from('public_profiles')
    .select('id, full_name')
    .in('id', studentIds);
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  rosterWrap.style.display = 'block';
  rosterList.innerHTML = data.map(r => `
    <div class="roster-row" data-record-id="${r.id}">
      <div>
        <div class="roster-name">${nameMap[r.student_id] || 'Unknown'}</div>
        <div class="roster-roll">${r.student_details?.roll_number || ''}</div>
      </div>
      <div class="status-toggle-group">
        ${['present', 'absent', 'late', 'excused'].map(s =>
          `<button class="status-btn ${r.status === s ? 'active-' + s : ''}" data-status="${s}">${s}</button>`
        ).join('')}
      </div>
    </div>
  `).join('');

  rosterList.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('.roster-row');
      const recordId = row.dataset.recordId;
      const newStatus = btn.dataset.status;

      const { error } = await supabaseClient
        .from('attendance_records')
        .update({ status: newStatus, marked_by: window.currentUser.id, marked_at: new Date().toISOString() })
        .eq('id', recordId);

      if (error) {
        showToast('Could not update: ' + error.message, 'error');
        return;
      }
      row.querySelectorAll('.status-btn').forEach(b => b.className = 'status-btn');
      btn.classList.add('active-' + newStatus);
      showToast('Attendance updated');
    });
  });
}

async function loadRiskDashboard() {
  const tbody = document.getElementById('riskTableBody');
  const { data, error } = await supabaseClient.rpc('at_risk_students_for_teacher');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Could not load: ${error.message}</td></tr>`;
    return;
  }
  tbody.innerHTML = (data && data.length)
    ? data.map(s => `
        <tr>
          <td>${s.full_name}</td>
          <td class="text-muted">${s.roll_number}</td>
          <td>${s.risk_score}</td>
          <td><span class="badge badge-${s.risk_tier}">${s.risk_tier.replace('_', ' ')}</span></td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" class="text-muted">No students found for your courses/mentees yet.</td></tr>`;
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Teacher`;
  loadCourses();
  loadRiskDashboard();
});
// Open and Close Password Modal
window.openPasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'flex';
  if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closePasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
};

// Handle Password Change Verification and Update
window.submitPasswordChange = async function() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Please fill in all password fields');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match');
    return;
  }

  // Enforce complexity: 8+ chars, upper, lower, number, special character
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!strongPasswordRegex.test(newPassword)) {
    showToast('Weak password: Must contain uppercase, lowercase, number, and special character.');
    return;
  }

  // 1. Re-authenticate to verify the current password
  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: window.currentUser.email,
    password: currentPassword
  });

  if (signInError) {
    showToast('Incorrect current password');
    return;
  }

  // 2. Update to the new password
  const { error: updateError } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (updateError) {
    showToast('Error: ' + updateError.message);
  } else {
    showToast('Password changed successfully');
    closePasswordModal();
  }
};

/* Profile overview: show account details and assigned-course summary. */
async function loadProfileOverview() {
  const user = window.currentUser;
  if (!user) return;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = (value === null || value === undefined || value === '') ? '—' : String(value); };
  const name = user.full_name || 'Teacher';
  set('profileHeading', name); set('profileName', name); set('profileEmail', user.email || '—'); set('profileRoleValue', 'Teacher'); set('profileRole', 'Teacher');
  set('profileSubtitle', 'Your faculty account and teaching overview');
  set('profileInitials', name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'T');
  set('profileYear', 'Faculty'); set('profileDepartment', 'Loading assigned courses…'); set('profileTerm', 'Teaching dashboard');
  const { count, error } = await supabaseClient.from('course_offerings').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id);
  if (error) { console.warn('Assigned-course count could not be loaded:', error.message); set('profileDepartment', 'See assigned courses below'); }
  else set('profileDepartment', `${count || 0} assigned course${count === 1 ? '' : 's'}`);
}
document.addEventListener('auth-ready', loadProfileOverview);
if (window.currentUser) loadProfileOverview();
