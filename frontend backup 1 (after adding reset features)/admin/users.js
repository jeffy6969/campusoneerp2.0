lucide.createIcons();

const roleSelect = document.getElementById('role');
const studentFields = document.getElementById('studentFields');
const teacherFields = document.getElementById('teacherFields');
const departmentSelect = document.getElementById('department');
const sectionSelect = document.getElementById('section');
const batchYearInput = document.getElementById('batchYear');
const form = document.getElementById('createUserForm');
const createBtn = document.getElementById('createBtn');
const createBtnText = document.getElementById('createBtnText');
const iconIdle = createBtn.querySelector('.icon-idle');
const iconLoading = createBtn.querySelector('.icon-loading');
const errorBox = document.getElementById('createUserError');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[ch]);
}

function toggleRoleFields() {
  const role = roleSelect.value;
  studentFields.style.display = role === 'student' ? 'grid' : 'none';
  teacherFields.style.display = role === 'teacher' ? 'grid' : 'none';
}
roleSelect.addEventListener('change', toggleRoleFields);
toggleRoleFields();

async function loadDepartments() {
  const { data, error } = await supabaseClient.from('departments').select('id, name, code').order('name');
  if (error) { console.error(error); return; }
  departmentSelect.innerHTML = '<option value="">Select department</option>' +
    data.map(d => `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)} (${escapeHtml(d.code)})</option>`).join('');
}

async function loadSections() {
  const deptId = departmentSelect.value;
  const batchYear = batchYearInput.value;
  if (!deptId || !batchYear) {
    sectionSelect.innerHTML = '<option value="">Select department + batch year first</option>';
    return;
  }
  const { data, error } = await supabaseClient
    .from('sections')
    .select('id, name')
    .eq('department_id', deptId)
    .eq('batch_year', Number(batchYear))
    .order('name');
  if (error) { console.error(error); return; }
  sectionSelect.innerHTML = (data && data.length)
    ? data.map(s => `<option value="${escapeHtml(s.id)}">Section ${escapeHtml(s.name)}</option>`).join('')
    : '<option value="">No sections found for that department/year</option>';
}
departmentSelect.addEventListener('change', loadSections);
batchYearInput.addEventListener('change', loadSections);

function setCreating(isLoading) {
  createBtn.disabled = isLoading;
  createBtnText.textContent = isLoading ? 'Creating...' : 'Create user';
  iconIdle.style.display = isLoading ? 'none' : '';
  iconLoading.style.display = isLoading ? '' : 'none';
}

function showFormError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.add('visible');
}
function clearFormError() {
  errorBox.classList.remove('visible');
  errorBox.textContent = '';
}

async function fetchAllRows(query, pageSize = 1000) {
  const allRows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) return { data: null, error };
    allRows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { data: allRows, error: null };
}

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Loading users...</td></tr>';

  // Real authenticated users (admins, teachers and registered students).
  const { data: profiles, error: profileError } = await fetchAllRows(
    supabaseClient.from('profiles')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: false })
  );

  if (profileError) {
    console.error('Could not load profiles:', profileError);
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">Could not load registered users. Check the browser console/RLS policies.</td></tr>';
    return;
  }

  // Dashboard-only synthetic records; these are not login accounts.
  const { data: demos, error: demoError } = await fetchAllRows(
    supabaseClient.from('demo_mentees')
      .select('id, student_name, email, roll_number, department, semester, mentor_name, teacher_name, created_at')
      .like('roll_number', 'SQLDEMO%')
      .order('roll_number', { ascending: true })
  );

  if (demoError) {
    console.error('Could not load demo students:', demoError);
  }

  const realRows = (profiles || []).map(u => ({
    sortDate: u.created_at || '',
    name: u.full_name,
    email: u.email,
    role: u.role,
    mentor: '—',
    realUser: true,
    id: u.id
  }));

  const demoRows = (demos || []).map(u => ({
    sortDate: u.created_at || '',
    name: u.student_name,
    email: u.email || `${String(u.roll_number || '').toLowerCase()}@campus-demo.invalid`,
    role: 'student (demo)',
    mentor: u.mentor_name || u.teacher_name || 'Demo mentor not assigned',
    realUser: false,
    rollNumber: u.roll_number,
    department: u.department,
    semester: u.semester
  }));

  const rows = [...realRows, ...demoRows];

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-muted">No users found.</td></tr>';
    return;
  }

  // Real users first; synthetic demo users after them, ordered by roll number.
  tbody.innerHTML = rows.map(u => `
    <tr>
      <td>
        ${escapeHtml(u.name)}
        ${u.realUser ? '' : `<div class="text-muted" style="font-size:12px;">${escapeHtml(u.rollNumber)} · ${escapeHtml(u.department || '')} · Semester ${escapeHtml(u.semester ?? '')}</div>`}
      </td>
      <td class="text-muted">${escapeHtml(u.email)}</td>
      <td><span class="badge badge-${u.realUser ? escapeHtml(u.role) : 'student'}">${escapeHtml(u.role)}</span></td>
      <td>${escapeHtml(u.mentor)}</td>
      <td>
        ${u.realUser
          ? `<button class="btn btn-secondary btn-sm" onclick="triggerPasswordReset('${escapeHtml(u.id)}', '${escapeHtml(u.name)}')">Reset Password</button>`
          : '<span class="text-muted" style="font-size:12px;">Demo record · no login</span>'}
      </td>
    </tr>
  `).join('');

  if (demoError) {
    const warning = document.createElement('div');
    warning.className = 'text-muted';
    warning.style.marginTop = '10px';
    warning.textContent = 'Demo students could not be loaded. Check that demo_mentees has a SELECT policy for admins.';
    tbody.closest('.table-wrap')?.appendChild(warning);
  }
}

// Admin password reset for real Auth-backed users only.
window.triggerPasswordReset = async function(userId, fullName) {
  const newPassword = prompt(`Enter new password for ${fullName} (minimum 8 characters):`);
  if (!newPassword) return;
  if (newPassword.length < 8) {
    alert('Password must be at least 8 characters long.');
    return;
  }

  const { error } = await supabaseClient.functions.invoke('admin-reset-password', {
    body: { targetUserId: userId, newPassword }
  });

  if (error) {
    console.error('Password reset failed:', error);
    alert('Failed to reset password. Check console for details.');
  } else {
    showToast(`Password for ${fullName} updated successfully.`);
  }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFormError();

  const role = roleSelect.value;
  const fullName = document.getElementById('fullName').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const deptId = departmentSelect.value;

  if (!fullName || !email || !deptId) {
    showFormError('Full name, email, and department are required.');
    return;
  }

  const payload = { full_name: fullName, email, role, department_id: deptId };

  if (role === 'student') {
    const rollNumber = document.getElementById('rollNumber').value.trim();
    const batchYearRaw = batchYearInput.value.trim();
    if (!rollNumber || !batchYearRaw) {
      showFormError('Roll number and batch year are required for students.');
      return;
    }
    payload.roll_number = rollNumber;
    payload.batch_year = Number(batchYearRaw);
    payload.section_id = sectionSelect.value || null;
  }

  if (role === 'teacher') {
    const employeeId = document.getElementById('employeeId').value.trim();
    if (!employeeId) {
      showFormError('Employee ID is required for teachers.');
      return;
    }
    payload.employee_id = employeeId;
    payload.designation = document.getElementById('designation').value.trim();
  }

  setCreating(true);
  const { data, error } = await supabaseClient.functions.invoke('admin-create-user', { body: payload });
  setCreating(false);

  if (error) {
    let message = error.message;
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch (_) {}
    showFormError(message);
    return;
  }

  if (data?.error) {
    showFormError(data.error);
    return;
  }

  document.getElementById('modalEmail').value = data.email;
  document.getElementById('modalPassword').value = data.temp_password;
  document.getElementById('tempPasswordModal').style.display = 'flex';
  lucide.createIcons();

  form.reset();
  toggleRoleFields();
  showToast('User created successfully');
  await loadUsers();
});

document.getElementById('closeModalBtn').addEventListener('click', () => {
  document.getElementById('tempPasswordModal').style.display = 'none';
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadDepartments();
  loadUsers();
});
