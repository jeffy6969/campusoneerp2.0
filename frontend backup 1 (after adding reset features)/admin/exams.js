lucide.createIcons();

async function loadCoursesForSelect() {
  const { data } = await supabaseClient.from('courses').select('id, code, name').order('code');
  document.getElementById('examCourse').innerHTML = '<option value="">Select course</option>' +
    (data || []).map(c => `<option value="${c.id}">${c.code} — ${c.name}</option>`).join('');
}

async function loadExams() {
  const tbody = document.getElementById('examsTableBody');
  const { data, error } = await supabaseClient
    .from('exams')
    .select('exam_type, exam_date, max_marks, courses(code, name)')
    .order('exam_date');

  if (error) { tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Could not load.</td></tr>`; return; }
  tbody.innerHTML = data.length ? data.map(e => `
    <tr>
      <td>${e.courses?.code} — ${e.courses?.name}</td>
      <td><span class="badge badge-neutral" style="text-transform:capitalize;">${e.exam_type.replace('_', ' ')}</span></td>
      <td class="text-muted">${new Date(e.exam_date).toLocaleDateString()}</td>
      <td class="text-muted">${e.max_marks}</td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="text-muted">No exams scheduled yet.</td></tr>`;
}

document.getElementById('examForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('examError');
  errorBox.classList.remove('visible');

  const courseId = document.getElementById('examCourse').value;
  if (!courseId) { errorBox.textContent = 'Pick a course.'; errorBox.classList.add('visible'); return; }

  const { error } = await supabaseClient.from('exams').insert({
    course_id: courseId,
    exam_type: document.getElementById('examType').value,
    exam_date: document.getElementById('examDate').value,
    start_time: document.getElementById('examStart').value || null,
    end_time: document.getElementById('examEnd').value || null,
    max_marks: Number(document.getElementById('examMaxMarks').value) || 100,
    academic_year: document.getElementById('examYear').value.trim(),
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('examForm').reset();
  document.getElementById('examMaxMarks').value = 100;
  showToast('Exam scheduled');
  loadExams();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadCoursesForSelect();
  loadExams();
});
