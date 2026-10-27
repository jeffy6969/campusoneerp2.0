lucide.createIcons();

const REQUIRED_ATTENDANCE = 75;

async function loadStats() {
  const { data: gpa, error: gpaError } = await supabaseClient
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
    .maybeSingle();

  if (!studentDetails) {
    document.getElementById('feesValue').textContent = '—';
    return;
  }

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
  document.getElementById('feesValue').textContent = `₹${totalDue.toLocaleString('en-IN')}`;
}

async function loadAttendance() {
  const list = document.getElementById('attendanceList');
  const { data, error } = await supabaseClient.rpc('predict_attendance_all', {
    p_student_id: window.currentUser.id,
    p_required_percentage: REQUIRED_ATTENDANCE
  });

  if (error) {
    console.error('Attendance prediction error:', error);
    list.innerHTML = '<p class="text-muted">Could not load attendance predictions. Check the Supabase RPC permissions described in SETUP-AI.md.</p>';
    return;
  }
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="text-muted">No course attendance records are available yet.</p>';
    return;
  }

  const trendIcon = { improving: 'trending-up', declining: 'trending-down', stable: 'minus' };
  const trendClass = { improving: 'trend-up', declining: 'trend-down', stable: 'trend-stable' };
  list.innerHTML = data.map(c => {
    const pct = Number(c.current_percentage || 0);
    const recent = Number(c.recent_percentage || 0);
    const safePct = Math.max(0, Math.min(100, pct));
    const trend = trendIcon[c.trend] ? c.trend : 'stable';
    const predictionText = Number(c.sessions_needed) > 0
      ? `Attend the next ${c.sessions_needed} classes consecutively to reach ${REQUIRED_ATTENDANCE}% (assuming no further absences).`
      : `You can miss up to ${c.sessions_can_skip || 0} future classes and remain at or above ${REQUIRED_ATTENDANCE}% (assuming each future class counts equally).`;
    const status = pct < REQUIRED_ATTENDANCE ? 'Below target' : 'On target';
    return `
      <div class="attendance-item" style="align-items:flex-start;gap:14px;">
        <div style="flex:1;min-width:0;">
          <div class="course-name">${escapeHtml(c.course_code || '')} — ${escapeHtml(c.course_name || 'Course')}</div>
          <div class="course-meta">${Number(c.attended_sessions || 0)} attended out of ${Number(c.total_sessions || 0)} recorded classes</div>
          <div style="height:7px;background:var(--border-color, #e5e7eb);border-radius:99px;overflow:hidden;margin:10px 0 8px;">
            <div style="height:100%;width:${safePct}%;background:${pct < REQUIRED_ATTENDANCE ? '#dc6262' : '#36a58a'};border-radius:99px;"></div>
          </div>
          <div class="course-meta">${predictionText}</div>
          <div class="course-meta" style="margin-top:5px;">Recent 10 classes: ${recent.toFixed(1)}% · ${status}</div>
        </div>
        <div style="text-align:right;display:flex;align-items:center;gap:6px;white-space:nowrap;">
          <span class="pct">${pct.toFixed(1)}%</span>
          <i data-lucide="${trendIcon[trend]}" class="trend-icon ${trendClass[trend]}"></i>
        </div>
      </div>`;
  }).join('');
  lucide.createIcons();
}

async function loadRiskAnalysis() {
  const container = document.getElementById('riskContent');
  const { data, error } = await supabaseClient.rpc('student_risk_score', {
    p_student_id: window.currentUser.id
  });
  if (error) {
    console.error('Risk analysis error:', error);
    container.innerHTML = '<p class="text-muted">Could not calculate your academic risk profile. Check the student_risk_score RPC permissions and function in Supabase.</p>';
    return;
  }
  const risk = Array.isArray(data) ? data[0] : data;
  if (!risk) {
    container.innerHTML = '<p class="text-muted">There is not enough academic data to calculate a risk profile yet.</p>';
    return;
  }
  const score = Math.max(0, Math.min(100, Number(risk.risk_score || 0)));
  const tier = String(risk.risk_tier || 'Unknown');
  const tierLower = tier.toLowerCase();
  const color = tierLower.includes('high') ? '#dc6262' : tierLower.includes('medium') || tierLower.includes('moderate') ? '#d99a35' : '#36a58a';
  const reasons = [];
  if (risk.avg_attendance != null) reasons.push(`Average attendance: ${Number(risk.avg_attendance).toFixed(1)}%`);
  if (risk.cgpa != null) reasons.push(`CGPA: ${Number(risk.cgpa).toFixed(2)}`);
  if (risk.active_backlogs != null) reasons.push(`Active backlogs: ${Number(risk.active_backlogs)}`);
  if (risk.open_grievances != null) reasons.push(`Open grievances: ${Number(risk.open_grievances)}`);
  if (risk.unpaid_required_fees != null) reasons.push(`Unpaid fee items: ${Number(risk.unpaid_required_fees)}`);
  let recommendation = 'Keep monitoring your attendance and academic progress.';
  if (tierLower.includes('high')) recommendation = 'Consider meeting your mentor soon to make a concrete attendance and study recovery plan.';
  else if (tierLower.includes('medium') || tierLower.includes('moderate')) recommendation = 'Review the indicators below and address the weakest area before it affects your results.';
  else recommendation = 'Maintain your current study routine and check this profile regularly.';
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;">
      <div><div class="text-muted" style="font-size:13px;">Academic risk indicator</div><div style="font-size:30px;font-weight:700;margin-top:4px;">${score.toFixed(0)}<span style="font-size:15px;font-weight:500;"> / 100</span></div></div>
      <span style="display:inline-block;padding:7px 12px;border-radius:999px;background:${color}20;color:${color};font-weight:700;">${escapeHtml(tier)} risk</span>
    </div>
    <div style="height:8px;background:var(--border-color, #e5e7eb);border-radius:99px;overflow:hidden;margin:14px 0 16px;"><div style="height:100%;width:${score}%;background:${color};border-radius:99px;"></div></div>
    <p style="margin:0 0 12px;">${escapeHtml(recommendation)}</p>
    ${reasons.length ? `<div class="course-meta">${reasons.map(escapeHtml).join(' · ')}</div>` : '<p class="text-muted">Some contributing indicators are not available yet.</p>'}
    <p class="text-muted" style="font-size:12px;margin-top:12px;">This is a rule-based support indicator, not a diagnosis or final academic decision. Missing data may affect the score.</p>`;
  lucide.createIcons();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
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
  try {
    const question = document.getElementById('advisorQuestion').value.trim();
    const { data, error } = await supabaseClient.functions.invoke('academic-advisor', {
      body: { question }
    });
    if (error) {
      let message = 'Could not reach your advisor. Confirm the Edge Function is deployed and OPENAI_API_KEY is configured.';
      try { const body = await error.context.json(); if (body?.error) message = body.error; } catch (_) {}
      showToast(message, 'error');
      return;
    }
    if (data?.error) { showToast(data.error, 'error'); return; }
    document.getElementById('advisorText').textContent = data.advice || 'No advice was returned.';
    document.getElementById('advisorModal').style.display = 'flex';
  } catch (err) {
    console.error(err);
    showToast('Something went wrong while contacting the academic advisor.', 'error');
  } finally {
    advisorBtn.disabled = false;
    advisorBtnText.textContent = 'Ask my advisor';
    advisorIconIdle.style.display = '';
    advisorIconLoading.style.display = 'none';
  }
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
  loadRiskAnalysis();
});

// Existing password-change flow retained.
window.openPasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'flex';
};
window.closePasswordModal = function() {
  document.getElementById('passwordModal').style.display = 'none';
  document.getElementById('currentPassword').value = '';
  document.getElementById('newPassword').value = '';
  document.getElementById('confirmPassword').value = '';
};
window.submitPasswordChange = async function() {
  const currentPassword = document.getElementById('currentPassword').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  if (!currentPassword || !newPassword || !confirmPassword) return showToast('Please fill in all password fields.', 'error');
  if (newPassword.length < 8) return showToast('New password must be at least 8 characters.', 'error');
  if (newPassword !== confirmPassword) return showToast('New passwords do not match.', 'error');
  const { error: verifyError } = await supabaseClient.auth.signInWithPassword({ email: window.currentUser.email, password: currentPassword });
  if (verifyError) return showToast('Current password is incorrect.', 'error');
  const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
  if (error) return showToast(error.message || 'Could not update password.', 'error');
  showToast('Password updated successfully.', 'success');
  closePasswordModal();
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
