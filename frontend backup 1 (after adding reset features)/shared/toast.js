// Requires a <div id="toast" class="toast"></div> somewhere on the page,
// and lucide already loaded.
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  const icon = type === 'success' ? 'check-circle-2' : 'alert-circle';
  toast.innerHTML = `<i data-lucide="${icon}"></i><span>${message}</span>`;
  toast.className = `toast toast-${type} visible`;
  lucide.createIcons();
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => { toast.classList.remove('visible'); }, 4000);
}
