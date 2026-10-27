lucide.createIcons();

async function loadUnassigned() {
  const listEl = document.getElementById('unassignedList');
  const { data, error } = await supabaseClient
    .from('grievances')
    .select('id, category, subject, description, is_anonymous, created_at')
    .is('assigned_to', null)
    .order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = `<p class="text-muted">Could not load.</p>`; return; }
  if (!data.length) { listEl.innerHTML = '<p class="text-muted">Nothing unassigned right now.</p>'; return; }

  listEl.innerHTML = data.map(g => `
    <div class="list-item" data-grievance-id="${g.id}">
      <div class="list-item-header">
        <div>
          <span class="badge badge-neutral" style="text-transform:capitalize;">${g.category}</span>
          ${g.is_anonymous ? '<span class="badge badge-neutral">Anonymous</span>' : ''}
          <div class="list-item-title" style="margin-top:8px;">${g.subject}</div>
        </div>
        <button class="btn btn-primary claim-btn"><span>Claim</span><i data-lucide="arrow-right" class="arrow-icon"></i></button>
      </div>
      <p class="text-muted" style="margin-top:8px;">${g.description}</p>
    </div>
  `).join('');
  lucide.createIcons();

  listEl.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.closest('.list-item').dataset.grievanceId;
      const { error } = await supabaseClient.from('grievances')
        .update({ assigned_to: window.currentUser.id })
        .eq('id', id);
      if (error) { showToast(error.message, 'error'); return; }
      showToast('Grievance claimed');
      loadUnassigned();
      loadAssigned();
    });
  });
}

async function loadAssigned() {
  const listEl = document.getElementById('assignedList');
  const { data, error } = await supabaseClient
    .from('grievances')
    .select('id, category, subject, description, status, created_at')
    .eq('assigned_to', window.currentUser.id)
    .order('created_at', { ascending: false });

  if (error) { listEl.innerHTML = `<p class="text-muted">Could not load.</p>`; return; }
  if (!data.length) { listEl.innerHTML = '<p class="text-muted">Nothing assigned to you yet.</p>'; return; }

  listEl.innerHTML = data.map(g => `
    <div class="list-item" data-grievance-id="${g.id}">
      <div class="list-item-header">
        <div>
          <span class="badge badge-neutral" style="text-transform:capitalize;">${g.category}</span>
          <div class="list-item-title" style="margin-top:8px;">${g.subject}</div>
        </div>
        <select class="grievance-status-select inline-select">
          <option value="submitted" ${g.status === 'submitted' ? 'selected' : ''}>Submitted</option>
          <option value="in_review" ${g.status === 'in_review' ? 'selected' : ''}>In review</option>
          <option value="resolved" ${g.status === 'resolved' ? 'selected' : ''}>Resolved</option>
          <option value="rejected" ${g.status === 'rejected' ? 'selected' : ''}>Rejected</option>
        </select>
      </div>
      <p class="text-muted" style="margin-top:8px;">${g.description}</p>
      <div class="field" style="margin-top:10px;">
        <textarea class="grievance-response-input" rows="2" placeholder="Add a response..."></textarea>
      </div>
      <button class="btn btn-secondary save-grievance-btn"><span>Save</span></button>
    </div>
  `).join('');

  listEl.querySelectorAll('.save-grievance-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const item = btn.closest('.list-item');
      const id = item.dataset.grievanceId;
      const status = item.querySelector('.grievance-status-select').value;
      const responseText = item.querySelector('.grievance-response-input').value.trim();

      const { error: updateError } = await supabaseClient.from('grievances')
        .update({ status })
        .eq('id', id);

      if (updateError) { showToast(updateError.message, 'error'); return; }

      if (responseText) {
        await supabaseClient.from('grievance_responses').insert({
          grievance_id: id,
          responder_id: window.currentUser.id,
          message: responseText,
        });
      }

      showToast('Updated');
      loadAssigned();
    });
  });
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Teacher`;
  loadUnassigned();
  loadAssigned();
});
