lucide.createIcons();

const statusBadge = (status) => {
  if (status === 'completed') return 'safe';
  if (status === 'cancelled' || status === 'no_show') return 'at_risk';
  return 'watch';
};

async function loadMentorAndMeetings() {
  const { data: studentDetails } = await supabaseClient
    .from('student_details')
    .select('mentor_id')
    .eq('profile_id', window.currentUser.id)
    .single();

  const mentorInfo = document.getElementById('mentorInfo');

  if (!studentDetails?.mentor_id) {
    mentorInfo.innerHTML = '<p class="text-muted">No mentor assigned yet. Contact the admin office.</p>';
  } else {
    const { data: mentorProfile } = await supabaseClient
      .from('public_profiles')
      .select('full_name')
      .eq('id', studentDetails.mentor_id)
      .single();
    mentorInfo.innerHTML = `<p style="font-size:15px;">${mentorProfile?.full_name || 'Unknown'}</p>`;
  }

  const meetingsList = document.getElementById('meetingsList');
  const { data: meetings, error } = await supabaseClient
    .from('mentor_meetings')
    .select('id, scheduled_at, duration_minutes, status, notes')
    .eq('student_id', window.currentUser.id)
    .order('scheduled_at', { ascending: false });

  if (error) {
    meetingsList.innerHTML = `<p class="text-muted">Could not load meetings.</p>`;
    return;
  }
  if (!meetings.length) {
    meetingsList.innerHTML = '<p class="text-muted">No meetings scheduled yet. Your mentor will set these up.</p>';
    return;
  }

  meetingsList.innerHTML = meetings.map(m => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <div class="list-item-title">${new Date(m.scheduled_at).toLocaleString()}</div>
          <div class="text-muted" style="margin-top:4px;">${m.duration_minutes} minutes</div>
        </div>
        <span class="badge badge-${statusBadge(m.status)}">${m.status.replace('_', ' ')}</span>
      </div>
      ${m.notes ? `<p class="text-muted" style="margin-top:8px;">${m.notes}</p>` : ''}
    </div>
  `).join('');
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadMentorAndMeetings();
});
