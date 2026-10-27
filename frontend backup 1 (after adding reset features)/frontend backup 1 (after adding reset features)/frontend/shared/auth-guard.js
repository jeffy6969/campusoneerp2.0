// Include after supabase-client.js on every portal page.
// Set window.REQUIRED_ROLE to 'admin' | 'teacher' | 'student' before
// including this script. Sends the user back to login if they aren't
// signed in, or aren't the right role for this portal — the real data
// protection is still RLS on the database, this is just so the UI
// doesn't show the wrong shell to the wrong person.
(async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = '../';
    return;
  }

  const { data: profile } = await supabaseClient
    .from('profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role !== window.REQUIRED_ROLE) {
    window.location.href = '../';
    return;
  }

  window.currentUser = { id: session.user.id, email: session.user.email, ...profile };
  document.dispatchEvent(new CustomEvent('auth-ready'));
})();
