lucide.createIcons();

const resultBadge = (status) => {
  if (status === 'pass') return 'safe';
  if (status === 'fail') return 'at_risk';
  return 'watch';
};

async function loadResults() {
  const { data: gpa } = await supabaseClient
    .from('student_gpa_summary')
    .select('cgpa, active_backlogs')
    .eq('student_id', window.currentUser.id)
    .maybeSingle();

  document.getElementById('resultsCgpa').textContent = gpa?.cgpa ?? '—';
  document.getElementById('resultsBacklogs').textContent = gpa?.active_backlogs ?? 0;

  const tbody = document.getElementById('resultsTableBody');
  const { data, error } = await supabaseClient
    .from('student_grades')
    .select('academic_year, grade_point, result_status, attempt_number, courses(code, name)')
    .eq('student_id', window.currentUser.id)
    .order('academic_year', { ascending: false });

  if (error) { tbody.innerHTML = `<tr><td colspan="4" class="text-muted">Could not load.</td></tr>`; return; }
  tbody.innerHTML = data.length ? data.map(g => `
    <tr>
      <td>${g.courses?.code} — ${g.courses?.name}</td>
      <td class="text-muted">${g.academic_year}${g.attempt_number > 1 ? ` (Attempt ${g.attempt_number})` : ''}</td>
      <td>${g.grade_point ?? '—'}</td>
      <td><span class="badge badge-${resultBadge(g.result_status)}">${g.result_status}</span></td>
    </tr>
  `).join('') : `<tr><td colspan="4" class="text-muted">No results yet.</td></tr>`;
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadResults();
});
