lucide.createIcons();

async function loadDepartments() {
  const { data, error } = await supabaseClient.from('departments').select('id, name, code').order('name');
  const listEl = document.getElementById('deptList');
  const selectEl = document.getElementById('sectionDept');

  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  listEl.innerHTML = data.length ? data.map(d => `
    <div class="simple-row">
      <div><div class="row-main">${d.name}</div><div class="row-sub">${d.code}</div></div>
    </div>
  `).join('') : '<p class="text-muted">No departments yet.</p>';

  selectEl.innerHTML = '<option value="">Select department</option>' +
    data.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
}

async function loadSections() {
  const { data, error } = await supabaseClient
    .from('sections')
    .select('id, name, batch_year, departments(name, code)')
    .order('batch_year', { ascending: false });
  const listEl = document.getElementById('sectionList');

  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  listEl.innerHTML = data.length ? data.map(s => `
    <div class="simple-row">
      <div>
        <div class="row-main">${s.departments?.code || '?'} - ${s.name}</div>
        <div class="row-sub">Batch ${s.batch_year}</div>
      </div>
    </div>
  `).join('') : '<p class="text-muted">No sections yet.</p>';
}

document.getElementById('deptForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('deptError');
  errorBox.classList.remove('visible');

  const { error } = await supabaseClient.from('departments').insert({
    name: document.getElementById('deptName').value.trim(),
    code: document.getElementById('deptCode').value.trim().toUpperCase(),
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('deptForm').reset();
  showToast('Department added');
  loadDepartments();
});

document.getElementById('sectionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('sectionError');
  errorBox.classList.remove('visible');

  const deptId = document.getElementById('sectionDept').value;
  if (!deptId) { errorBox.textContent = 'Pick a department.'; errorBox.classList.add('visible'); return; }

  const { error } = await supabaseClient.from('sections').insert({
    department_id: deptId,
    batch_year: Number(document.getElementById('sectionBatchYear').value),
    name: document.getElementById('sectionName').value.trim(),
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('sectionForm').reset();
  showToast('Section added');
  loadSections();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadDepartments();
  loadSections();
});
