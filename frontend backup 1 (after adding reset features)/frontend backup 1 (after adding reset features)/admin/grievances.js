lucide.createIcons();

const statusBadge = (status) => {
  if (status === 'resolved') return 'safe';
  if (status === 'rejected') return 'at_risk';
  return 'watch';
};

async function loadAllGrievances() {
  const listEl = document.getElementById('allGrievancesList');
  const { data, error } = await supabaseClient
    .from('grievances')
    .select('id, category, subject, description, status, assigned_to, is_anonymous, created_at, student_id')
    .order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = `<p class="text-muted">Could not load.</p>`; return; }
  if (!data.length) { listEl.innerHTML = '<p class="text-muted">No grievances yet.</p>'; return; }

  const peopleIds = [...new Set([...data.map(g => g.student_id), ...data.map(g => g.assigned_to).filter(Boolean)])];
  const { data: names } = peopleIds.length
    ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', peopleIds)
    : { data: [] };
  const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

  listEl.innerHTML = data.map(g => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <span class="badge badge-neutral" style="text-transform:capitalize;">${g.category}</span>
          ${g.is_anonymous ? '<span class="badge badge-neutral">Anonymous</span>' : ''}
          <div class="list-item-title" style="margin-top:8px;">${g.subject}</div>
          <div class="text-muted" style="margin-top:4px;">
            ${g.is_anonymous ? 'Filed anonymously' : `By ${nameMap[g.student_id] || 'Unknown'}`}
            &middot; ${g.assigned_to ? `Assigned to ${nameMap[g.assigned_to] || 'Unknown'}` : 'Unassigned'}
          </div>
        </div>
        <span class="badge badge-${statusBadge(g.status)}">${g.status.replace('_', ' ')}</span>
      </div>
      <p class="text-muted" style="margin-top:8px;">${g.description}</p>
    </div>
  `).join('');
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadAllGrievances();
});
