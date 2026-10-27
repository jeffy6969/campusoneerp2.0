lucide.createIcons();

async function loadStats() {
  const { data: gpa } = await supabaseClient
    .from('student_gpa_summary')
    .select('cgpa, active_backlogs')
    .eq('student_id', window.currentUser.id)
    .maybeSingle();

  document.getElementById('cgpaValue').textContent = gpa?.cgpa ?? '—';
  document.getElementById('backlogsValue').textContent = gpa?.active_backlogs ?? 0;

  const { data: studentDetails } = await supabaseClient
    .from('student_details')
    .select('department_id, batch_year, current_semester')
    .eq('profile_id', window.currentUser.id)
    .single();

  if (!studentDetails) return;

  const { data: feeStructures } = await supabaseClient
    .from('fee_structures')
    .select('id, amount')
    .eq('department_id', studentDetails.department_id)
    .eq('batch_year', studentDetails.batch_year)
    .lte('semester', studentDetails.current_semester);

  const { data: payments } = await supabaseClient
    .from('fee_payments')
    .select('fee_structure_id')
    .eq('student_id', window.currentUser.id)
    .eq('payment_status', 'success');

  const paidIds = new Set((payments || []).map(p => p.fee_structure_id));
  const unpaid = (feeStructures || []).filter(fs => !paidIds.has(fs.id));
  const totalDue = unpaid.reduce((sum, fs) => sum + Number(fs.amount), 0);

  document.getElementById('feesValue').textContent = `\u20b9${totalDue.toLocaleString('en-IN')}`;
}

async function loadAttendance() {
  const { data, error } = await supabaseClient.rpc('predict_attendance_all', {
    p_student_id: window.currentUser.id,
  });

  const list = document.getElementById('attendanceList');
  if (error || !data || data.length === 0) {
    list.innerHTML = '<p class="text-muted">No attendance recorded yet.</p>';
    return;
  }

  const trendIcon = { improving: 'trending-up', declining: 'trending-down', stable: 'minus' };
  const trendClass = { improving: 'trend-up', declining: 'trend-down', stable: 'trend-stable' };

  list.innerHTML = data.map(c => `
    <div class="attendance-item">
      <div>
        <div class="course-name">${c.course_code} — ${c.course_name}</div>
        <div class="course-meta">
          ${c.sessions_needed > 0
            ? `Attend the next ${c.sessions_needed} classes to reach 75%`
            : `Can skip up to ${c.sessions_can_skip} more classes and stay at 75%+`}
        </div>
      </div>
      <div style="text-align:right; display:flex; align-items:center; gap:6px;">
        <span class="pct">${c.current_percentage}%</span>
        <i data-lucide="${trendIcon[c.trend]}" class="trend-icon ${trendClass[c.trend]}"></i>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

const advisorBtn = document.getElementById('advisorBtn');
const advisorBtnText = document.getElementById('advisorBtnText');
const advisorIconIdle = advisorBtn.querySelector('.icon-idle');
const advisorIconLoading = advisorBtn.querySelector('.icon-loading');

advisorBtn.addEventListener('click', async () => {
  advisorBtn.disabled = true;
  advisorBtnText.textContent = 'Thinking...';
  advisorIconIdle.style.display = 'none';
  advisorIconLoading.style.display = '';

  const { data, error } = await supabaseClient.functions.invoke('academic-advisor', { body: {} });

  advisorBtn.disabled = false;
  advisorBtnText.textContent = 'Ask my advisor';
  advisorIconIdle.style.display = '';
  advisorIconLoading.style.display = 'none';

  if (error) {
    let message = 'Could not reach your advisor right now';
    try {
      const body = await error.context.json();
      if (body?.error) message = body.error;
    } catch (_) { /* keep the generic message if the body isn't JSON */ }
    showToast(message, 'error');
    return;
  }

  if (data?.error) {
    showToast(data.error, 'error');
    return;
  }

  document.getElementById('advisorText').textContent = data.advice;
  document.getElementById('advisorModal').style.display = 'flex';
});

document.getElementById('closeAdvisorBtn').addEventListener('click', () => {
  document.getElementById('advisorModal').style.display = 'none';
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadStats();
  loadAttendance();
});
// Open and Close Modal Functions
window.openPasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'flex';
};

window.closePasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
};

// Handle the Password Change securely
window.submitPasswordChange = async function() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast('Please fill in all password fields');
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast('New passwords do not match');
    return;
  }

  if (newPassword.length < 8) {
    showToast('New password must be at least 8 characters long');
    return;
  }

  // 1. Re-authenticate to prove knowledge of current password
  const { error: signInError } = await supabaseClient.auth.signInWithPassword({
    email: window.currentUser.email,
    password: currentPassword
  });

  if (signInError) {
    showToast('Incorrect current password');
    return;
  }

  // 2. Update to the new password
  const { error: updateError } = await supabaseClient.auth.updateUser({
    password: newPassword
  });

  if (updateError) {
    showToast('Error updating password: ' + updateError.message);
  } else {
    showToast('Password changed successfully');
    closePasswordModal();
  }
};

/* Profile overview: uses the signed-in user's own profile and student record. */
async function loadProfileOverview() {
  const user = window.currentUser;
  if (!user) return;
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = (value === null || value === undefined || value === '') ? '—' : String(value); };
  const name = user.full_name || 'Student';
  set('profileName', name); set('profileEmail', user.email || '—'); set('profileRoleValue', 'Student'); set('profileRole', 'Student'); set('profileHeading', name);
  set('profileSubtitle', 'Your academic and account information');
  set('profileInitials', name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase() || 'S');
  const { data: details, error } = await supabaseClient.from('student_details')
    .select('roll_number, department_id, batch_year, current_semester')
    .eq('profile_id', user.id).maybeSingle();
  if (error) console.warn('Student profile details could not be loaded:', error.message);
  if (details) {
    set('profileYear', details.batch_year ? `Batch ${details.batch_year}` : 'Not provided');
    set('profileDepartment', details.department_id ? `Department ID ${details.department_id}` : 'Not provided');
    set('profileTerm', details.current_semester ? `Semester ${details.current_semester}` : 'Not provided');
    const sub = [details.roll_number ? `Roll no. ${details.roll_number}` : '', details.batch_year ? `Batch ${details.batch_year}` : ''].filter(Boolean).join(' · ');
    if (sub) set('profileSubtitle', sub);
  } else {
    set('profileYear', 'Not provided'); set('profileDepartment', 'Not provided'); set('profileTerm', 'Not provided');
  }
}
document.addEventListener('auth-ready', loadProfileOverview);
if (window.currentUser) loadProfileOverview();
