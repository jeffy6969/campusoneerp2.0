lucide.createIcons();

async function loadTeachersForSelect() {
  const { data } = await supabaseClient.from('teacher_details').select('profile_id, employee_id');
  const ids = (data || []).map(t => t.profile_id);
  const { data: names } = ids.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));
  document.getElementById('designateTeacher').innerHTML = '<option value="">Select teacher</option>' +
    (data || []).map(t => `<option value="${t.profile_id}">${nameMap[t.profile_id] || t.employee_id}</option>`).join('');
}

async function loadMentors() {
  const listEl = document.getElementById('mentorsList');
  const selectEl = document.getElementById('assignMentorSelect');
  const { data, error } = await supabaseClient.from('mentor_details').select('profile_id, max_mentees');
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  const ids = data.map(m => m.profile_id);
  const { data: names } = ids.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  listEl.innerHTML = data.length ? data.map(m => `
    <div class="simple-row">
      <div><div class="row-main">${nameMap[m.profile_id] || 'Unknown'}</div><div class="row-sub">Max ${m.max_mentees} mentees</div></div>
    </div>
  `).join('') : '<p class="text-muted">No mentors designated yet.</p>';

  selectEl.innerHTML = '<option value="">Select mentor</option>' +
    data.map(m => `<option value="${m.profile_id}">${nameMap[m.profile_id] || 'Unknown'}</option>`).join('');
}

document.getElementById('designateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('mentorDesignateError');
  errorBox.classList.remove('visible');

  const teacherId = document.getElementById('designateTeacher').value;
  if (!teacherId) { errorBox.textContent = 'Pick a teacher.'; errorBox.classList.add('visible'); return; }

  const { error } = await supabaseClient.from('mentor_details').insert({
    profile_id: teacherId,
    max_mentees: Number(document.getElementById('maxMentees').value) || 15,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('designateForm').reset();
  document.getElementById('maxMentees').value = 15;
  showToast('Mentor designated');
  loadMentors();
});

let foundStudentId = null;

document.getElementById('lookupStudentBtn').addEventListener('click', async () => {
  const errorBox = document.getElementById('assignError');
  errorBox.classList.remove('visible');
  const roll = document.getElementById('studentRollLookup').value.trim();
  if (!roll) return;

  const { data: student, error } = await supabaseClient
    .from('student_details')
    .select('profile_id, mentor_id')
    .eq('roll_number', roll)
    .maybeSingle();

  if (error || !student) {
    errorBox.textContent = 'No student found with that roll number.';
    errorBox.classList.add('visible');
    document.getElementById('foundStudentInfo').style.display = 'none';
    return;
  }

  foundStudentId = student.profile_id;
  const { data: profile } = await supabaseClient.from('public_profiles').select('full_name').eq('id', student.profile_id).single();

  let mentorName = 'None assigned';
  if (student.mentor_id) {
    const { data: mentorProfile } = await supabaseClient.from('public_profiles').select('full_name').eq('id', student.mentor_id).single();
    mentorName = mentorProfile?.full_name || 'Unknown';
  }

  document.getElementById('foundStudentName').textContent = profile?.full_name || 'Unknown';
  document.getElementById('foundStudentMentor').textContent = mentorName;
  document.getElementById('foundStudentInfo').style.display = 'block';
});

document.getElementById('assignBtn').addEventListener('click', async () => {
  const errorBox = document.getElementById('assignError');
  errorBox.classList.remove('visible');

  const mentorId = document.getElementById('assignMentorSelect').value;
  if (!foundStudentId || !mentorId) {
    errorBox.textContent = 'Find a student and pick a mentor first.';
    errorBox.classList.add('visible');
    return;
  }

  const { error } = await supabaseClient.from('student_details')
    .update({ mentor_id: mentorId })
    .eq('profile_id', foundStudentId);

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  showToast('Mentor assigned');
  document.getElementById('foundStudentInfo').style.display = 'none';
  document.getElementById('studentRollLookup').value = '';
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadTeachersForSelect();
  loadMentors();
});
