lucide.createIcons();

async function loadDepartmentsForSelect() {
  const { data } = await supabaseClient.from('departments').select('id, name, code').order('name');
  document.getElementById('courseDept').innerHTML = '<option value="">Select department</option>' +
    (data || []).map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
}

async function loadCourses() {
  const tbody = document.getElementById('coursesTableBody');
  const { data, error } = await supabaseClient
    .from('courses')
    .select('code, name, semester, course_type, departments(code)')
    .order('semester');

  if (error) { tbody.innerHTML = `<tr><td colspan="5" class="text-muted">Could not load.</td></tr>`; return; }
  tbody.innerHTML = data.length ? data.map(c => `
    <tr>
      <td>${c.code}</td>
      <td>${c.name}</td>
      <td class="text-muted">${c.departments?.code || ''}</td>
      <td class="text-muted">${c.semester}</td>
      <td><span class="badge badge-neutral" style="text-transform:capitalize;">${c.course_type}</span></td>
    </tr>
  `).join('') : `<tr><td colspan="5" class="text-muted">No courses yet.</td></tr>`;
}

document.getElementById('courseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('courseError');
  errorBox.classList.remove('visible');

  const deptId = document.getElementById('courseDept').value;
  if (!deptId) { errorBox.textContent = 'Pick a department.'; errorBox.classList.add('visible'); return; }

  const { error } = await supabaseClient.from('courses').insert({
    code: document.getElementById('courseCode').value.trim(),
    name: document.getElementById('courseName').value.trim(),
    department_id: deptId,
    semester: Number(document.getElementById('courseSemester').value),
    credits: Number(document.getElementById('courseCredits').value),
    course_type: document.getElementById('courseType').value,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('courseForm').reset();
  showToast('Course added');
  loadCourses();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadDepartmentsForSelect();
  loadCourses();
});
