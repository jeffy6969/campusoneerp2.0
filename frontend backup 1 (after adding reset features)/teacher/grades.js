lucide.createIcons();

let currentOfferings = [];

async function loadCourses() {
  const { data, error } = await supabaseClient
    .from('course_offerings')
    .select('id, course_id, section_id, courses(code, name), sections(name)')
    .eq('teacher_id', window.currentUser.id);

  const select = document.getElementById('gradeCourseSelect');
  if (error || !data || !data.length) {
    select.innerHTML = '<option value="">No courses assigned</option>';
    return;
  }
  currentOfferings = data;
  select.innerHTML = data.map(co =>
    `<option value="${co.id}">${co.courses.code} — ${co.courses.name} (Sec ${co.sections.name})</option>`
  ).join('');
}

async function loadRosterForGrades() {
  const offeringId = document.getElementById('gradeCourseSelect').value;
  if (!offeringId) { showToast('Select a course first', 'error'); return; }

  const offering = currentOfferings.find(o => o.id === offeringId);
  const courseId = offering.course_id;

  const { data: students, error } = await supabaseClient
    .from('student_details')
    .select('profile_id, roll_number')
    .eq('section_id', offering.section_id);

  if (error || !students) { showToast('Could not load roster', 'error'); return; }

  const studentIds = students.map(s => s.profile_id);
  const { data: names } = studentIds.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', studentIds)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  const { data: existingGrades } = studentIds.length
    ? await supabaseClient.from('student_grades').select('student_id, grade_point, result_status').eq('course_id', courseId).in('student_id', studentIds)
    : { data: [] };
  const gradeMap = Object.fromEntries((existingGrades || []).map(g => [g.student_id, g]));

  document.getElementById('gradesRosterWrap').style.display = 'block';
  document.getElementById('gradesRosterWrap').dataset.courseId = courseId;

  document.getElementById('gradesRosterList').innerHTML = students.map(s => {
    const existing = gradeMap[s.profile_id];
    return `
      <div class="roster-row" data-student-id="${s.profile_id}">
        <div>
          <div class="roster-name">${nameMap[s.profile_id] || 'Unknown'}</div>
          <div class="roster-roll">${s.roll_number}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <input type="number" class="grade-input" step="0.1" min="0" max="10" placeholder="GP" value="${existing?.grade_point ?? ''}" />
          <select class="grade-status-select inline-select">
            <option value="pending" ${!existing || existing.result_status === 'pending' ? 'selected' : ''}>Pending</option>
            <option value="pass" ${existing?.result_status === 'pass' ? 'selected' : ''}>Pass</option>
            <option value="fail" ${existing?.result_status === 'fail' ? 'selected' : ''}>Fail</option>
          </select>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('loadRosterBtn').addEventListener('click', loadRosterForGrades);

document.getElementById('saveGradesBtn').addEventListener('click', async () => {
  const courseId = document.getElementById('gradesRosterWrap').dataset.courseId;
  const academicYear = document.getElementById('gradeYear').value.trim() || 'Unspecified';
  const rows = document.querySelectorAll('#gradesRosterList .roster-row');

  let successCount = 0;
  let errorCount = 0;

  for (const row of rows) {
    const studentId = row.dataset.studentId;
    const gradePointRaw = row.querySelector('.grade-input').value;
    const resultStatus = row.querySelector('.grade-status-select').value;

    if (!gradePointRaw && resultStatus === 'pending') continue; // skip untouched rows

    const { error } = await supabaseClient.from('student_grades').upsert({
      student_id: studentId,
      course_id: courseId,
      academic_year: academicYear,
      attempt_number: 1,
      grade_point: gradePointRaw ? Number(gradePointRaw) : null,
      result_status: resultStatus,
    }, { onConflict: 'student_id,course_id,attempt_number' });

    if (error) errorCount++; else successCount++;
  }

  showToast(`Saved ${successCount} grade(s)${errorCount ? `, ${errorCount} failed` : ''}`, errorCount ? 'error' : 'success');
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Teacher`;
  loadCourses();
});
