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
    data.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
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
    ? data.map(s => `<option value="${s.id}">Section ${s.name}</option>`).join('')
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

async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, full_name, email, role') // ADDED: 'id' is required for password resets
    .order('created_at', { ascending: false });

  if (error) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Could not load users.</td></tr>`;
    return;
  }
  
  // ADDED: Action button to trigger password reset
  tbody.innerHTML = (data && data.length)
    ? data.map(u => `
        <tr>
          <td>${u.full_name}</td>
          <td class="text-muted">${u.email}</td>
          <td><span class="badge badge-${u.role}">${u.role}</span></td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="triggerPasswordReset('${u.id}', '${u.full_name}')">
              Reset Password
            </button>
          </td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" class="text-muted">No users yet.</td></tr>`;
}

// ADDED: Function to handle admin password reset via Edge Function
window.triggerPasswordReset = async function(userId, fullName) {
  const newPassword = prompt(`Enter new password for ${fullName} (minimum 8 characters):`);
  
  if (!newPassword) return; // Cancelled
  if (newPassword.length < 8) {
    alert('Password must be at least 8 characters long.');
    return;
  }

  const { error } = await supabaseClient.functions.invoke('admin-reset-password', {
    body: { targetUserId: userId, newPassword: newPassword }
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
    } catch (_) { }
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
  loadUsers();
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