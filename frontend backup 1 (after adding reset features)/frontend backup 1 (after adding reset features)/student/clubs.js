lucide.createIcons();

async function loadClubs() {
  const list = document.getElementById('clubsList');

  const { data: clubs, error } = await supabaseClient
    .from('clubs')
    .select('id, name, description, category')
    .order('name');

  const { data: memberships } = await supabaseClient
    .from('club_memberships')
    .select('club_id, role')
    .eq('student_id', window.currentUser.id);

  const memberMap = Object.fromEntries((memberships || []).map(m => [m.club_id, m.role]));

  if (error || !clubs) {
    list.innerHTML = `<p class="text-muted">Could not load clubs.</p>`;
    return;
  }
  if (!clubs.length) {
    list.innerHTML = '<p class="text-muted">No clubs have been added yet.</p>';
    return;
  }

  list.innerHTML = clubs.map(c => {
    const isMember = !!memberMap[c.id];
    return `
      <div class="mini-card">
        ${c.category ? `<span class="badge badge-neutral" style="margin-bottom:10px;">${c.category}</span>` : ''}
        <h4>${c.name}</h4>
        <p>${c.description || ''}</p>
        <button class="btn ${isMember ? 'btn-secondary' : 'btn-primary'} btn-full" data-club-id="${c.id}" data-joined="${isMember}">
          <span>${isMember ? 'Leave club' : 'Join club'}</span>
          ${!isMember ? '<i data-lucide="arrow-right" class="arrow-icon"></i>' : ''}
        </button>
      </div>
    `;
  }).join('');
  lucide.createIcons();

  list.querySelectorAll('button[data-club-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const clubId = btn.dataset.clubId;
      const joined = btn.dataset.joined === 'true';

      if (joined) {
        const { error } = await supabaseClient.from('club_memberships').delete()
          .eq('club_id', clubId).eq('student_id', window.currentUser.id);
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Left club');
      } else {
        const { error } = await supabaseClient.from('club_memberships').insert({
          club_id: clubId, student_id: window.currentUser.id,
        });
        if (error) { showToast(error.message, 'error'); return; }
        showToast('Joined club');
      }
      loadClubs();
    });
  });
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadClubs();
});
