lucide.createIcons();

async function loadMyClubs() {
  const wrap = document.getElementById('clubRosterWrap');
  const { data: clubs, error } = await supabaseClient
    .from('clubs')
    .select('id, name, description')
    .eq('faculty_advisor_id', window.currentUser.id);

  if (error) { wrap.innerHTML = `<p class="text-muted">Could not load.</p>`; return; }
  if (!clubs.length) { wrap.innerHTML = '<p class="text-muted">You are not the faculty advisor for any club.</p>'; return; }

  let html = '';
  for (const club of clubs) {
    const { data: members } = await supabaseClient
      .from('club_memberships')
      .select('student_id, role')
      .eq('club_id', club.id);

    const studentIds = (members || []).map(m => m.student_id);
    const { data: names } = studentIds.length
      ? await supabaseClient.from('public_profiles').select('id, full_name').in('id', studentIds)
      : { data: [] };
    const nameMap = Object.fromEntries((names || []).map(n => [n.id, n.full_name]));

    html += `<h4 style="font-family:var(--font-display); margin: 20px 0 10px;">${club.name} (${members?.length || 0} members)</h4>`;
    html += (members && members.length) ? members.map(m => `
      <div class="simple-row">
        <div><div class="row-main">${nameMap[m.student_id] || 'Unknown'}</div></div>
        <select class="member-role-select inline-select" data-student-id="${m.student_id}" data-club-id="${club.id}">
          <option value="member" ${m.role === 'member' ? 'selected' : ''}>Member</option>
          <option value="coordinator" ${m.role === 'coordinator' ? 'selected' : ''}>Coordinator</option>
          <option value="lead" ${m.role === 'lead' ? 'selected' : ''}>Lead</option>
        </select>
      </div>
    `).join('') : '<p class="text-muted">No members yet.</p>';
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll('.member-role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const { error } = await supabaseClient.from('club_memberships')
        .update({ role: sel.value })
        .eq('club_id', sel.dataset.clubId)
        .eq('student_id', sel.dataset.studentId);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Role updated');
    });
  });
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Teacher`;
  loadMyClubs();
});
