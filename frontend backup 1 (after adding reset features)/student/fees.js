lucide.createIcons();

async function loadFees() {
  const list = document.getElementById('feesList');

  const { data: studentDetails } = await supabaseClient
    .from('student_details')
    .select('department_id, batch_year, current_semester')
    .eq('profile_id', window.currentUser.id)
    .single();

  if (!studentDetails) {
    list.innerHTML = '<p class="text-muted">Could not load your enrollment details.</p>';
    return;
  }

  const { data: structures } = await supabaseClient
    .from('fee_structures')
    .select('id, fee_type, amount, due_date, semester')
    .eq('department_id', studentDetails.department_id)
    .eq('batch_year', studentDetails.batch_year)
    .lte('semester', studentDetails.current_semester)
    .order('semester');

  const { data: payments } = await supabaseClient
    .from('fee_payments')
    .select('fee_structure_id, payment_status, receipt_number')
    .eq('student_id', window.currentUser.id);

  const paymentMap = Object.fromEntries((payments || []).map(p => [p.fee_structure_id, p]));

  if (!structures || !structures.length) {
    list.innerHTML = '<p class="text-muted">No fees due yet.</p>';
    return;
  }

  document.getElementById('feesNote').textContent =
    "Online payment isn't connected yet — this shows what's due and paid. Contact the accounts office to settle any pending amount.";

  list.innerHTML = structures.map(fs => {
    const payment = paymentMap[fs.id];
    const isPaid = payment?.payment_status === 'success';
    return `
      <div class="list-item">
        <div class="list-item-header">
          <div>
            <div class="list-item-title" style="text-transform:capitalize;">${fs.fee_type} — Semester ${fs.semester}</div>
            <div class="text-muted" style="margin-top:4px;">
              \u20b9${Number(fs.amount).toLocaleString('en-IN')}${fs.due_date ? ` · Due ${new Date(fs.due_date).toLocaleDateString()}` : ''}${isPaid && payment.receipt_number ? ` · Receipt ${payment.receipt_number}` : ''}
            </div>
          </div>
          <span class="badge badge-${isPaid ? 'safe' : 'at_risk'}">${isPaid ? 'Paid' : 'Unpaid'}</span>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Student`;
  loadFees();
});
