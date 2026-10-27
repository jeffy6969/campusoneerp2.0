lucide.createIcons();

async function loadDepartmentsForSelect() {
  const { data } = await supabaseClient.from('departments').select('id, name, code').order('name');
  document.getElementById('feeDept').innerHTML = '<option value="">Select department</option>' +
    (data || []).map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
}

async function loadFees() {
  const listEl = document.getElementById('feesList');
  const { data, error } = await supabaseClient
    .from('fee_structures')
    .select('fee_type, amount, due_date, semester, batch_year, departments(code)')
    .order('batch_year', { ascending: false });

  if (error || !data) { listEl.innerHTML = '<p class="text-muted">Could not load.</p>'; return; }

  listEl.innerHTML = data.length ? data.map(f => `
    <div class="simple-row">
      <div>
        <div class="row-main" style="text-transform:capitalize;">${f.fee_type} — ${f.departments?.code || ''} Sem ${f.semester}</div>
        <div class="row-sub">Batch ${f.batch_year}${f.due_date ? ` · Due ${new Date(f.due_date).toLocaleDateString()}` : ''}</div>
      </div>
      <div class="row-main">\u20b9${Number(f.amount).toLocaleString('en-IN')}</div>
    </div>
  `).join('') : '<p class="text-muted">No fee structures yet.</p>';
}

document.getElementById('feeForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorBox = document.getElementById('feeError');
  errorBox.classList.remove('visible');

  const deptId = document.getElementById('feeDept').value;
  if (!deptId) { errorBox.textContent = 'Pick a department.'; errorBox.classList.add('visible'); return; }

  const { error } = await supabaseClient.from('fee_structures').insert({
    department_id: deptId,
    batch_year: Number(document.getElementById('feeBatchYear').value),
    semester: Number(document.getElementById('feeSemester').value),
    fee_type: document.getElementById('feeType').value,
    amount: Number(document.getElementById('feeAmount').value),
    due_date: document.getElementById('feeDueDate').value || null,
  });

  if (error) { errorBox.textContent = error.message; errorBox.classList.add('visible'); return; }
  document.getElementById('feeForm').reset();
  showToast('Fee structure added');
  loadFees();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabaseClient.auth.signOut();
  window.location.href = '../';
});

let currentDueStructures = [];

document.getElementById('lookupPaymentStudentBtn').addEventListener('click', async () => {
  const errorBox = document.getElementById('paymentError');
  errorBox.classList.remove('visible');
  const roll = document.getElementById('paymentRollLookup').value.trim();
  const listEl = document.getElementById('paymentDuesList');
  if (!roll) return;

  const { data: student, error } = await supabaseClient
    .from('student_details')
    .select('profile_id, department_id, batch_year, current_semester')
    .eq('roll_number', roll)
    .maybeSingle();

  if (error || !student) {
    errorBox.textContent = 'No student found with that roll number.';
    errorBox.classList.add('visible');
    listEl.innerHTML = '';
    return;
  }

  const { data: structures } = await supabaseClient
    .from('fee_structures')
    .select('id, fee_type, amount, semester')
    .eq('department_id', student.department_id)
    .eq('batch_year', student.batch_year)
    .lte('semester', student.current_semester);

  currentDueStructures = structures || [];

  const { data: payments } = await supabaseClient
    .from('fee_payments')
    .select('fee_structure_id, payment_status')
    .eq('student_id', student.profile_id);

  const paidMap = Object.fromEntries((payments || []).filter(p => p.payment_status === 'success').map(p => [p.fee_structure_id, true]));

  listEl.innerHTML = currentDueStructures.length ? currentDueStructures.map(fs => `
    <div class="simple-row" data-fee-id="${fs.id}">
      <div>
        <div class="row-main" style="text-transform:capitalize;">${fs.fee_type} — Sem ${fs.semester}</div>
        <div class="row-sub">\u20b9${Number(fs.amount).toLocaleString('en-IN')}</div>
      </div>
      ${paidMap[fs.id]
        ? '<span class="badge badge-safe">Paid</span>'
        : `<button class="btn btn-primary mark-paid-btn" type="button" data-fee-id="${fs.id}" data-student-id="${student.profile_id}"><span>Mark paid</span></button>`}
    </div>
  `).join('') : '<p class="text-muted">No dues found for this student.</p>';

  listEl.querySelectorAll('.mark-paid-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const feeId = btn.dataset.feeId;
      const studentId = btn.dataset.studentId;
      const structure = currentDueStructures.find(s => s.id === feeId);

      const { error: payError } = await supabaseClient.from('fee_payments').insert({
        student_id: studentId,
        fee_structure_id: feeId,
        amount_paid: structure.amount,
        payment_status: 'success',
      });

      if (payError) { showToast(payError.message, 'error'); return; }
      showToast('Payment recorded');
      document.getElementById('lookupPaymentStudentBtn').click();
    });
  });
});

document.addEventListener('auth-ready', () => {
  document.getElementById('welcomeText').textContent = `${window.currentUser.full_name} · Admin`;
  loadDepartmentsForSelect();
  loadFees();
});
