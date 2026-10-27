lucide.createIcons();

const form = document.getElementById('grievanceForm');
const errorBox = document.getElementById('grievanceError');
const submitBtn = document.getElementById('submitGrievanceBtn');
const submitBtnText = document.getElementById('submitGrievanceBtnText');
const iconIdle = submitBtn.querySelector('.icon-idle');
const iconLoading = submitBtn.querySelector('.icon-loading');

function setSubmitting(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtnText.textContent = isLoading ? 'Submitting...' : 'Submit';
  iconIdle.style.display = isLoading ? 'none' : '';
  iconLoading.style.display = isLoading ? '' : 'none';
}

const statusBadge = (status) => {
  if (status === 'resolved') return 'safe';
  if (status === 'rejected') return 'at_risk';
  return 'watch';
};

async function loadGrievances() {
  const list = document.getElementById('grievancesList');
  const { data, error } = await supabaseClient
    .from('grievances')
    .select('id, category, subject, description, status, is_anonymous, created_at')
    .eq('student_id', window.currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="text-muted">Could not load: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    list.innerHTML = '<p class="text-muted">No grievances submitted yet.</p>';
    return;
  }

  list.innerHTML = data.map(g => `
    <div class="list-item">
      <div class="list-item-header">
        <div style="display:flex; gap:8px; align-items:center;">
          <span class="badge badge-neutral" style="text-transform:capitalize;">${g.category}</span>
          ${g.is_anonymous ? '<span class="badge badge-neutral">Anonymous</span>' : ''}
        </div>
        <span class="badge badge-${statusBadge(g.status)}">${g.status.replace('_', ' ')}</span>
      </div>
      <div class="list-item-title" style="margin-top:10px;">${g.subject}</div>
      <p class="text-muted" style="margin:6px 0 0;">${g.description}</p>
      <div class="text-muted" style="margin-top:8px; font-size:12px;">${new Date(g.created_at).toLocaleDateString()}</div>
    </div>
  `).join('');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.remove('visible');

  const subject = document.getElementById('subject').value.trim();
  const description = document.getElementById('description').value.trim();
  if (!subject || !description) {
    errorBox.textContent = 'Subject and description are required.';
    errorBox.classList.add('visible');
    return;
  }

  setSubmitting(true);

  const { error } = await supabaseClient.from('grievances').insert({
    student_id: window.currentUser.id,
    category: document.getElementById('category').value,
    subject,
    description,
    is_anonymous: document.getElementById('isAnonymous').checked,
  });

  setSubmitting(false);

  if (error) {
    errorBox.textContent = error.message;
    errorBox.classList.add('visible');
    return;
  }

  form.reset();
  showToast('Grievance submitted');
  loadGrievances();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadGrievances();
});
