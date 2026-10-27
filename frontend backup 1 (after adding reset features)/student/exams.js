lucide.createIcons();

async function loadExams() {
  const listEl = document.getElementById('examsList');

  const { data: studentDetails } = await supabaseClient
    .from('student_details')
    .select('department_id, current_semester')
    .eq('profile_id', window.currentUser.id)
    .single();

  if (!studentDetails) { listEl.innerHTML = '<p class="text-muted">Could not load your enrollment details.</p>'; return; }

  const { data: courses } = await supabaseClient
    .from('courses')
    .select('id, code, name')
    .eq('department_id', studentDetails.department_id)
    .eq('semester', studentDetails.current_semester);

  const courseIds = (courses || []).map(c => c.id);
  const courseMap = Object.fromEntries((courses || []).map(c => [c.id, c]));

  if (!courseIds.length) { listEl.innerHTML = '<p class="text-muted">No courses found for your current semester yet.</p>'; return; }

  const { data: exams, error } = await supabaseClient
    .from('exams')
    .select('id, course_id, exam_type, exam_date, start_time, end_time, max_marks')
    .in('course_id', courseIds)
    .order('exam_date');

  if (error || !exams.length) { listEl.innerHTML = '<p class="text-muted">No exams scheduled yet.</p>'; return; }

  listEl.innerHTML = exams.map(e => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${courseMap[e.course_id]?.code} — ${courseMap[e.course_id]?.name}</div>
          <div class="text-muted" style="margin-top:4px;">
            ${new Date(e.exam_date).toLocaleDateString()}${e.start_time ? ` · ${e.start_time.slice(0,5)}${e.end_time ? ' - ' + e.end_time.slice(0,5) : ''}` : ''}
            &middot; Max ${e.max_marks} marks
          </div>
        </div>
        <span class="badge badge-neutral" style="text-transform:capitalize;">${e.exam_type.replace('_', ' ')}</span>
      </div>
    </div>
  `).join('');
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadExams();
});
