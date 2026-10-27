lucide.createIcons();
const DAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

async function loadCoursesForSelect() {
  const { data } = await supabaseClient.from('courses').select('id, code, name').order('code');
  document.getElementById('offeringCourse').innerHTML = '<option value="">Select course</option>' +
    (data || []).map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join('');
}

async function loadSectionsForSelect() {
  const { data } = await supabaseClient
    .from('sections')
    .select('id, name, batch_year, departments(code)')
    .order('batch_year', { ascending: false });
  document.getElementById('offeringSection').innerHTML = '<option value="">Select section</option>' +
    (data || []).map(s => `<option value="${s.id}">${s.departments?.code || '?'}-${s.name} (${s.batch_year})</option>`).join('');
}

async function loadTeachersForSelect() {
  const { data } = await supabaseClient.from('teacher_details').select('profile_id, employee_id');
  const teacherIds = (data || []).map(t => t.profile_id);
  const { data: names } = teacherIds.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', teacherIds)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));
  document.getElementById('offeringTeacher').innerHTML = '<option value="">Select teacher</option>' +
    (data || []).map(t => `<option value="${t.profile_id}">${nameMap[t.profile_id] || t.employee_id}</option>`).join('');
}

async function loadOfferingsForSelect() {
  const { data } = await supabaseClient
    .from('course_offerings')
    .select('id, courses(code), sections(name)');
  document.getElementById('entryOffering').innerHTML = '<option value="">Select offering</option>' +
    (data || []).map(o => `<option value="${o.id}">${o.courses?.code} — Sec ${o.sections?.name}</option>`).join('');
}

async function loadSlotsForSelect() {
  const { data } = await supabaseClient.from('timetable_slots').select('id, day_of_week, period_number').order('day_of_week').order('period_number');
  document.getElementById('entrySlot').innerHTML = '<option value="">Select slot</option>' +
    (data || []).map(s => `<option value="${s.id}">${DAYS[s.day_of_week]} · Period ${s.period_number}</option>`).join('');
}

async function loadRoomsForSelect() {
  const { data } = await supabaseClient.from('rooms').select('id, room_number').order('room_number');
  document.getElementById('entryRoom').innerHTML = '<option value="">Select room</option>' +
    (data || []).map(r => `<option value="${r.id}">${r.room_number}</option>`).join('');
}

async function loadTimetableTable() {
  const tbody = document.getElementById('timetableBody');
  const { data, error } = await supabaseClient
    .from('timetable_entries')
    .select('id, rooms(room_number), timetable_slots(day_of_week, period_number), course_offerings(courses(code), sections(name), teacher_id)');

  if (error || !data) { tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Could not load.</td></tr>`; return; }

  const teacherIds = [...new Set(data.map(e => e.course_offerings?.teacher_id).filter(Boolean))];
  const { data: names } = teacherIds.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', teacherIds)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  tbody.innerHTML = data.length ? data.map(e => `
    <tr>
      <td>${e.course_offerings?.courses?.code || ''}</td>
      <td class="text-muted">${e.course_offerings?.sections?.name || ''}</td>
      <td class="text-muted">${nameMap[e.course_offerings?.teacher_id] || ''}</td>
      <td class="text-muted">${DAYS[e.timetable_slots?.day_of_week]} · P${e.timetable_slots?.period_number}</td>
      <td class="text-muted">${e.rooms?.room_number || ''}</td>
    </tr>
  `).join('') : `<tr><td colspan="5" class="text-muted">Nothing scheduled yet.</td></tr>`;
}

document.getElementById('offeringForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('offeringError');
  errorBox.classList.remove('visible');

  const courseId = document.getElementById('offeringCourse').value;
  const sectionId = document.getElementById('offeringSection').value;
  const teacherId = document.getElementById('offeringTeacher').value;
  if (!courseId || !sectionId || !teacherId) {
    errorBox.textContent = 'Course, section, and teacher are all required.';
    errorBox.classList.add('visible');
    return;
  }

  const { error } = await supabaseClient.from('course_offerings').insert({
    course_id: courseId,
    section_id: sectionId,
    teacher_id: teacherId,
    academic_year: document.getElementById('offeringYear').value.trim(),
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('offeringForm').reset();
  showToast('Offering created');
  loadOfferingsForSelect();
});

document.getElementById('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('entryError');
  errorBox.classList.remove('visible');

  const offeringId = document.getElementById('entryOffering').value;
  const slotId = document.getElementById('entrySlot').value;
  const roomId = document.getElementById('entryRoom').value;
  if (!offeringId || !slotId || !roomId) {
    errorBox.textContent = 'Offering, slot, and room are all required.';
    errorBox.classList.add('visible');
    return;
  }

  // Ask the database's own conflict-check function first, for a clear
  // message instead of a raw constraint-violation error if it clashes.
  const { data: conflict } = await supabaseClient.rpc('check_timetable_conflict', {
    p_course_offering_id: offeringId,
    p_timetable_slot_id: slotId,
    p_room_id: roomId,
  }).maybeSingle();

  if (conflict?.has_conflict) {
    errorBox.textContent = conflict.conflict_reason;
    errorBox.classList.add('visible');
    return;
  }

  const { error } = await supabaseClient.from('timetable_entries').insert({
    course_offering_id: offeringId,
    timetable_slot_id: slotId,
    room_id: roomId,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('entryForm').reset();
  showToast('Scheduled');
  loadTimetableTable();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadCoursesForSelect();
  loadSectionsForSelect();
  loadTeachersForSelect();
  loadOfferingsForSelect();
  loadSlotsForSelect();
  loadRoomsForSelect();
  loadTimetableTable();
});
