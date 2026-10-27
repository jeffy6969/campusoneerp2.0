lucide.createIcons();

async function loadJobs() {
  const list = document.getElementById('jobsList');

  const { data: jobs, error } = await supabaseClient
    .from('job_postings')
    .select('id, title, job_type, min_cgpa, application_deadline, status, companies(name)')
    .eq('status', 'open')
    .order('application_deadline');

  const { data: applications } = await supabaseClient
    .from('job_applications')
    .select('job_posting_id, status')
    .eq('student_id', window.currentUser.id);

  const appMap = Object.fromEntries((applications || []).map(a => [a.job_posting_id, a.status]));

  if (error || !jobs) {
    list.innerHTML = `<p class="text-muted">Could not load postings.</p>`;
    return;
  }
  if (!jobs.length) {
    list.innerHTML = '<p class="text-muted">No open positions right now.</p>';
    return;
  }

  list.innerHTML = jobs.map(j => {
    const appliedStatus = appMap[j.id];
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title">${j.title} — ${j.companies?.name || 'Unknown company'}</div>
            <div class="text-muted" style="margin-top:4px;">
              ${j.job_type.replace('_', ' ')}${j.min_cgpa ? ` · Min CGPA ${j.min_cgpa}` : ''}${j.application_deadline ? ` · Apply by ${new Date(j.application_deadline).toLocaleDateString()}` : ''}
            </div>
          </div>
          ${appliedStatus
            ? `<span class="badge badge-watch" style="text-transform:capitalize;">${appliedStatus.replace('_', ' ')}</span>`
            : `<button class="btn btn-primary" data-job-id="${j.id}"><span>Apply</span><i data-lucide="arrow-right" class="arrow-icon"></i></button>`}
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();

  list.querySelectorAll('button[data-job-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const { error } = await supabaseClient.from('job_applications').insert({
        job_posting_id: jobId, student_id: window.currentUser.id,
      });
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Application submitted');
      loadJobs();
    });
  });
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadJobs();
});
