lucide.createIcons();

async function loadTeachersForSelect() {
  const { data } = await supabaseClient.from('teacher_details').select('profile_id');
  const ids = (data || []).map(t => t.profile_id);
  const { data: names } = ids.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', ids)
    : { data: [] };
  document.getElementById('clubAdvisor').innerHTML = '<option value="">Select teacher</option>' +
    (names || []).map(n => `<option value="${n.id}">${n.full_name}</option>`).join('');
}

async function loadClubs() {
  const listEl = document.getElementById('clubsList');
  const { data, error } = await supabaseClient.from('clubs').select('name, description, category').order('name');
  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }
  listEl.innerHTML = data.length ? data.map(c => `
    <div class="mini-card">
      ${c.category ? `<span class="badge badge-neutral" style="margin-bottom:10px;">${c.category}</span>` : ''}
      <h4>${c.name}</h4>
      <p>${c.description || ''}</p>
    </div>
  `).join('') : '<p class="text-muted">No clubs yet.</p>';
}

document.getElementById('clubForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('clubError');
  errorBox.classList.remove('visible');

  const { error } = await supabaseClient.from('clubs').insert({
    name: document.getElementById('clubName').value.trim(),
    category: document.getElementById('clubCategory').value.trim() || null,
    description: document.getElementById('clubDescription').value.trim() || null,
    faculty_advisor_id: document.getElementById('clubAdvisor').value || null,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('clubForm').reset();
  showToast('Club added');
  loadClubs();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadTeachersForSelect();
  loadClubs();
});
