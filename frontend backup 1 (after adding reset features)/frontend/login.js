lucide.createIcons();

const form = document.getElementById('loginForm');
const errorMsg = document.getElementById('errorMsg');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const iconIdle = submitBtn.querySelector('.icon-idle');
const iconLoading = submitBtn.querySelector('.icon-loading');
const toggleBtn = document.getElementById('togglePassword');
const iconShow = toggleBtn.querySelector('.icon-show');
const iconHide = toggleBtn.querySelector('.icon-hide');
const passwordInput = document.getElementById('password');

// Toggling pre-rendered icons rather than re-running lucide.createIcons()
// on a single element — re-rendering replaces the DOM node, which would
// silently break this listener on the second click.
toggleBtn.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  iconShow.style.display = isPassword ? 'none' : '';
  iconHide.style.display = isPassword ? '' : 'none';
});

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.add('visible');
}

function clearError() {
  errorMsg.classList.remove('visible');
  errorMsg.textContent = '';
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  btnText.textContent = isLoading ? 'Signing in...' : 'Sign in';
  iconIdle.style.display = isLoading ? 'none' : '';
  iconLoading.style.display = isLoading ? '' : 'none';
}

const ROLE_REDIRECTS = {
  admin: 'admin/',
  teacher: 'teacher/',
  student: 'student/',
};

async function redirectIfLoggedIn() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile && ROLE_REDIRECTS[profile.role]) {
    window.location.href = ROLE_REDIRECTS[profile.role];
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();
  setLoading(true);

  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = passwordInput.value;

  const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (authError) {
    setLoading(false);
    showError(authError.message === 'Invalid login credentials'
      ? 'Incorrect email or password.'
      : authError.message);
    return;
  }

  const { data: profile, error: profileError } = await supabaseClient
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    setLoading(false);
    showError('Signed in, but no profile was found for this account. Contact your administrator.');
    await supabaseClient.auth.signOut();
    return;
  }

  const redirectPath = ROLE_REDIRECTS[profile.role];
  if (!redirectPath) {
    setLoading(false);
    showError('Unrecognized account role. Contact your administrator.');
    return;
  }

  window.location.href = redirectPath;
});

redirectIfLoggedIn();
