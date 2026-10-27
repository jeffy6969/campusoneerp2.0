lucide.createIcons();

async function loadCompanies() {
  const listEl = document.getElementById('companiesList');
  const selectEl = document.getElementById('jobCompany');
  const { data, error } = await supabaseClient.from('companies').select('id, name, website').order('name');
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  listEl.innerHTML = data.length ? data.map(c => `
    <div class="simple-row">
      <div><div class="row-main">${c.name}</div>${c.website ? `<div class="row-sub">${c.website}</div>` : ''}</div>
    </div>
  `).join('') : '<p class="text-muted">No companies yet.</p>';

  selectEl.innerHTML = '<option value="">Select company</option>' +
    data.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

async function loadDepartmentCheckboxes() {
  const { data } = await supabaseClient.from('departments').select('id, code').order('code');
  document.getElementById('jobDeptCheckboxes').innerHTML = (data || []).map(d => `
    <label class="checkbox-label">
      <input type="checkbox" value="${d.id}" class="dept-checkbox" />
      <span>${d.code}</span>
    </label>
  `).join('');
}

async function loadJobs() {
  const listEl = document.getElementById('jobsList');
  const { data, error } = await supabaseClient
    .from('job_postings')
    .select('title, job_type, min_cgpa, status, companies(name)')
    .order('created_at', { ascending: false });
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  listEl.innerHTML = data.length ? data.map(j => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${j.title} — ${j.companies?.name || ''}</div>
          <div class="text-muted" style="margin-top:4px;">${j.job_type.replace('_', ' ')}${j.min_cgpa ? ` · Min CGPA ${j.min_cgpa}` : ''}</div>
        </div>
        <span class="badge badge-${j.status === 'open' ? 'safe' : 'neutral'}">${j.status}</span>
      </div>
    </div>
  `).join('') : '<p class="text-muted">No postings yet.</p>';
}

document.getElementById('companyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('companyError');
  errorBox.classList.remove('visible');

  const { error } = await supabaseClient.from('companies').insert({
    name: document.getElementById('companyName').value.trim(),
    website: document.getElementById('companyWebsite').value.trim() || null,
    description: document.getElementById('companyDescription').value.trim() || null,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('companyForm').reset();
  showToast('Company added');
  loadCompanies();
});

document.getElementById('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('jobError');
  errorBox.classList.remove('visible');

  const companyId = document.getElementById('jobCompany').value;
  const title = document.getElementById('jobTitle').value.trim();
  if (!companyId || !title) {
    errorBox.textContent = 'Company and title are required.';
    errorBox.classList.add('visible');
    return;
  }

  const { data: job, error } = await supabaseClient.from('job_postings').insert({
    company_id: companyId,
    title,
    description: document.getElementById('jobDescription').value.trim() || null,
    job_type: document.getElementById('jobType').value,
    min_cgpa: Number(document.getElementById('jobMinCgpa').value) || null,
    application_deadline: document.getElementById('jobDeadline').value || null,
  }).select('id').single();

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }

  const selectedDepts = [...document.querySelectorAll('.dept-checkbox:checked')].map(cb => cb.value);
  if (selectedDepts.length) {
    await supabaseClient.from('job_posting_eligibility').insert(
      selectedDepts.map(deptId => ({ job_posting_id: job.id, department_id: deptId }))
    );
  }

  document.getElementById('jobForm').reset();
  showToast('Job posted');
  loadJobs();
});

async function loadJobsForApplicantSelect() {
  const { data } = await supabaseClient.from('job_postings').select('id, title').order('created_at', { ascending: false });
  document.getElementById('applicantsJobSelect').innerHTML = '<option value="">Select a posting</option>' +
    (data || []).map(j => `<option value="${j.id}">${j.title}</option>`).join('');
}

document.getElementById('applicantsJobSelect').addEventListener('change', async () => {
  const jobId = document.getElementById('applicantsJobSelect').value;
  const listEl = document.getElementById('applicantsList');
  if (!jobId) { listEl.innerHTML = '<p class="text-muted">Select a posting to see applicants.</p>'; return; }

  const { data: apps, error } = await supabaseClient
    .from('job_applications')
    .select('id, student_id, status')
    .eq('job_posting_id', jobId)
    .order('applied_at', { ascending: false });

  if (error || !apps.length) { listEl.innerHTML = '<p class="text-muted">No applicants yet.</p>'; return; }

  const studentIds = apps.map(a => a.student_id);
  const { data: students } = await supabaseClient.from('student_details').select('profile_id, roll_number').in('profile_id', studentIds);
  const rollMap = Object.fromEntries((students || []).map(s => [s.profile_id, s.roll_number]));
  const { data: names } = await supabaseClient.from('public_profiles').select('id, full_name').in('id', studentIds);
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  listEl.innerHTML = apps.map(a => `
    <div class="list-item" data-app-id="${a.id}">
      <div class="list-item-header">
        <div><div class="list-item-title">${nameMap[a.student_id] || 'Unknown'}</div><div class="text-muted">${rollMap[a.student_id] || ''}</div></div>
        <select class="app-status-select inline-select">
          <option value="applied" ${a.status === 'applied' ? 'selected' : ''}>Applied</option>
          <option value="shortlisted" ${a.status === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
          <option value="interview_scheduled" ${a.status === 'interview_scheduled' ? 'selected' : ''}>Interview scheduled</option>
          <option value="selected" ${a.status === 'selected' ? 'selected' : ''}>Selected</option>
          <option value="rejected" ${a.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.app-status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const appId = sel.closest('.list-item').dataset.appId;
      const { error: updateError } = await supabaseClient.from('job_applications').update({ status: sel.value }).eq('id', appId);
      if (updateError) { showToast(updateError.message, 'error'); return; }
      showToast('Status updated');
    });
  });
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadCompanies();
  loadDepartmentCheckboxes();
  loadJobs();
  loadJobsForApplicantSelect();
});
