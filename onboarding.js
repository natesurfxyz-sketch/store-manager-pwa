(() => {
  'use strict';
  const cfg = window.STORE_CONFIG || {};
  const client = window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;
  const $ = (selector, root = document) => root.querySelector(selector);
  // Layout fixes: bottom menu fits 6 buttons, order status buttons wrap, no sideways scrolling.
  const layoutFix = document.createElement('style');
  layoutFix.textContent = 'html,body{overflow-x:hidden}#navigation{display:flex!important;justify-content:space-between!important;gap:0!important;padding-left:2px!important;padding-right:2px!important}#navigation button{flex:1 1 0!important;min-width:0!important;max-width:none!important;padding:8px 1px!important;font-size:11.5px!important;line-height:1.15;text-align:center;white-space:nowrap;overflow:hidden}#navigation .onboarding-nav-button{display:flex;flex-direction:column;align-items:center;justify-content:center}#orders-list .row{flex-wrap:wrap}#orders-list .row button{flex:1 1 40%}';
  document.head.append(layoutFix);
  let toastRegion;
  function toast(message, error = false) {
    if (!toastRegion) {
      toastRegion = document.createElement('div');
      toastRegion.className = 'onboarding-toast-region';
      document.body.append(toastRegion);
    }
    const node = document.createElement('div');
    node.className = `onboarding-toast${error ? ' error' : ''}`;
    node.textContent = message || 'Something went wrong. Please try again.';
    toastRegion.append(node);
    setTimeout(() => node.remove(), 4000);
  }
  // Retain the app's existing validation and error messages but display them as toasts.
  window.alert = message => toast(String(message));
  const friendly = error => {
    const text = error?.message || '';
    if (/could not find the function/i.test(text)) return 'Database setup is incomplete (a function is missing). Run the setup SQL in Supabase, then try again.';
    return text || 'Something went wrong. Please try again.';
  };
  const root = document.createElement('div');
  root.id = 'onboarding-root';
  document.body.append(root);
  const app = $('#app'), navigation = $('#navigation'), authView = $('#auth-view');
  let currentUser = null, currentProfile = null;

  function hideApp() {
    app?.classList.add('hidden'); navigation?.classList.add('hidden'); authView?.classList.add('hidden');
  }
  function showApp() {
    root.classList.add('hidden');
    app?.classList.remove('hidden'); navigation?.classList.remove('hidden');
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    $('#home-view')?.classList.add('active');
  }
  function showAuth(html) {
    hideApp(); root.classList.remove('hidden'); root.innerHTML = `
      <div class="onboarding-brand"><div class="onboarding-brand-mark">▦</div><h1>Store Manager</h1><p>Simple tools for your store</p></div>
      <section class="onboarding-panel">${html}</section>`;
  }
  function authError(text) { const el = $('#onboarding-error', root); if (el) el.textContent = text; else toast(text, true); }
  function loginScreen(message = '') {
    showAuth(`<h2>Welcome back</h2><p>Sign in to manage your store.</p>
      <form id="onboarding-login"><label for="onb-email">Email</label><input id="onb-email" type="email" autocomplete="username" required>
      <label for="onb-password">Password</label><input id="onb-password" type="password" autocomplete="current-password" required>
      <button type="submit">Sign in</button><p class="onboarding-error" id="onboarding-error">${message}</p></form>
      <div class="onboarding-link-row"><button class="onboarding-link" id="go-signup">Create account</button><button class="onboarding-link" id="go-reset">Forgot password?</button></div>`);
    $('#onboarding-login').onsubmit = async e => {
      e.preventDefault(); if (!client) return authError('Supabase is not configured.');
      const button = $('button[type=submit]', e.currentTarget); button.disabled = true; button.textContent = 'Signing in…';
      const { data, error } = await client.auth.signInWithPassword({ email: $('#onb-email').value.trim(), password: $('#onb-password').value });
      if (error) { button.disabled = false; button.textContent = 'Sign in'; return authError(friendly(error)); }
      currentUser = data.user; await routeSignedIn();
    };
    $('#go-signup').onclick = () => signupScreen();
    $('#go-reset').onclick = () => resetScreen();
  }
  function signupScreen(message = '') {
    showAuth(`<button class="onboarding-back" id="signup-back">← Back to sign in</button><h2>Create your account</h2><p>Set up your login, then create a store or join one.</p>
      <form id="onboarding-signup"><label for="onb-email">Email</label><input id="onb-email" type="email" autocomplete="email" required>
      <label for="onb-password">Password</label><input id="onb-password" type="password" autocomplete="new-password" minlength="8" required><p class="muted">Use at least 8 characters.</p>
      <button type="submit">Continue</button><p class="onboarding-error" id="onboarding-error">${message}</p></form>
      <p class="muted">By creating an account, you agree to our <button class="onboarding-link" id="terms-link">Terms</button> and <button class="onboarding-link" id="privacy-link">Privacy Policy</button>.</p>`);
    $('#signup-back').onclick = () => loginScreen(); $('#terms-link').onclick = () => legalPage('Terms'); $('#privacy-link').onclick = () => legalPage('Privacy Policy');
    $('#onboarding-signup').onsubmit = async e => {
      e.preventDefault(); if (!client) return authError('Supabase is not configured.');
      const email = $('#onb-email').value.trim(), password = $('#onb-password').value;
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) return authError(friendly(error));
      if (!data.session) { signupScreen('Check your email to confirm your account, then sign in to finish setup.'); toast('Confirmation email sent.'); return; }
      currentUser = data.user; choiceScreen();
    };
  }
  function resetScreen() {
    showAuth(`<button class="onboarding-back" id="reset-back">← Back</button><h2>Reset password</h2><p>We’ll email you a secure password reset link.</p><form id="reset-form"><label for="reset-email">Email</label><input id="reset-email" type="email" autocomplete="email" required><button>Send reset link</button><p class="onboarding-error" id="onboarding-error"></p></form>`);
    $('#reset-back').onclick = () => loginScreen();
    $('#reset-form').onsubmit = async e => { e.preventDefault(); const email = $('#reset-email').value.trim(); const redirectTo = `${location.origin}${location.pathname}?reset=1`; const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo }); if (error) return authError(friendly(error)); toast('Password reset link sent. Check your email.'); loginScreen(); };
  }
  function newPasswordScreen() {
    showAuth(`<h2>Choose a new password</h2><p>Set a new password for your account.</p><form id="new-password-form"><label for="new-password">New password</label><input id="new-password" type="password" minlength="8" autocomplete="new-password" required><label for="new-password-confirm">Confirm password</label><input id="new-password-confirm" type="password" minlength="8" required><button>Update password</button><p class="onboarding-error" id="onboarding-error"></p></form>`);
    $('#new-password-form').onsubmit = async e => { e.preventDefault(); const password = $('#new-password').value; if (password !== $('#new-password-confirm').value) return authError('Passwords do not match.'); const { error } = await client.auth.updateUser({ password }); if (error) return authError(friendly(error)); history.replaceState({}, '', location.pathname); toast('Password updated. Sign in with your new password.'); await client.auth.signOut(); currentUser = null; loginScreen(); };
  }
  function choiceScreen(message = '') {
    showAuth(`<h2>Set up your store</h2><p>Choose how you’ll use Store Manager.</p><div class="onboarding-options"><button class="onboarding-choice" id="choose-owner"><strong>I own a store</strong><span>Create a new store and invite your team.</span></button><button class="onboarding-choice" id="choose-staff"><strong>I’m joining a store</strong><span>Join a store using the invite code from its owner.</span></button></div><p class="onboarding-error" id="onboarding-error">${message}</p><button class="onboarding-link" id="choice-signout">Sign out</button>`);
    $('#choose-owner').onclick = () => setupForm('owner'); $('#choose-staff').onclick = () => setupForm('staff');
    $('#choice-signout').onclick = async () => { await client.auth.signOut(); currentUser = null; loginScreen(); };
  }
  function setupForm(kind) {
    const owner = kind === 'owner';
    showAuth(`<button class="onboarding-back" id="setup-back">← Back</button><h2>${owner ? 'Create your store' : 'Join a store'}</h2><p>${owner ? 'Choose a name your team will recognize.' : 'Enter the invite code shared by the store owner.'}</p>
      <form id="setup-form">${owner ? '<label for="store-name">Store name</label><input id="store-name" maxlength="120" required>' : '<label for="invite-code">Invite code</label><input id="invite-code" autocomplete="off" required>'}<button type="submit">${owner ? 'Create store' : 'Join store'}</button><p class="onboarding-error" id="onboarding-error"></p></form>`);
    $('#setup-back').onclick = () => choiceScreen();
    $('#setup-form').onsubmit = async e => {
      e.preventDefault();
      const button = $('button[type=submit]', e.currentTarget) || $('button', e.currentTarget);
      const label = owner ? 'Create store' : 'Join store';
      const reset = () => { button.disabled = false; button.textContent = label; };
      if (!client) return authError('Supabase is not configured.');
      button.disabled = true; button.textContent = 'Working…';
      try {
        const result = owner
          ? await client.rpc('create_store', { p_name: $('#store-name').value.trim() })
          : await client.rpc('join_store', { p_code: $('#invite-code').value.trim() });
        if (result.error) { reset(); return authError(friendly(result.error)); }
        toast(owner ? 'Store created.' : 'You joined the store.');
        await routeSignedIn(true);
      } catch (err) { reset(); authError(friendly(err)); }
    };
  }
  function legalPage(title) {
    const page = document.createElement('div'); page.className = 'onboarding-legal';
    page.innerHTML = `<article><button class="onboarding-back legal-back">← Back</button><h1>${title}</h1><p class="muted">Placeholder information</p><p>This ${title.toLowerCase()} page is a placeholder for Store Manager. Before inviting real customers or staff, replace this text with your final terms and privacy details, including what information is collected, how it is used, how long it is retained, and how users can contact you.</p><button class="legal-back">Close</button></article>`;
    document.body.append(page); page.querySelectorAll('.legal-back').forEach(b => b.onclick = () => page.remove());
  }
  async function getProfile() {
    if (!currentUser) return null;
    const { data, error } = await client.from('profiles').select('id,store_id,role').eq('id', currentUser.id).maybeSingle();
    if (error) throw error; return data;
  }
  async function routeSignedIn(afterSetup = false) {
    try {
      currentProfile = await getProfile();
      if (!currentProfile) { choiceScreen(); return; }
      showApp(); addSettings();
      if (afterSetup) location.reload();
    } catch (error) {
      // A missing profile is the expected first-login state; other backend errors are surfaced.
      if (/0 rows|no rows|multiple \(or no\) rows/i.test(error.message || '')) choiceScreen();
      else { choiceScreen(friendly(error)); toast(friendly(error), true); }
    }
  }
  function addSettings() {
    const nav = $('#navigation'); if (!nav || $('#settings-view')) return;
    const more = document.createElement('button'); more.type = 'button'; more.className = 'onboarding-nav-button'; more.innerHTML = '<span class="nav-icon">⚙</span><span>More</span>'; nav.append(more);
    const view = document.createElement('section'); view.id = 'settings-view'; view.className = 'view'; view.innerHTML = `<h2>Settings</h2><div class="onboarding-settings"><h3>Store invite code</h3><p class="muted">Share this code with staff who need to join your store.</p><div id="invite-code-value" class="onboarding-code">Loading…</div><div style="display:flex;gap:8px"><button id="copy-invite">Copy code</button><button class="secondary" id="share-invite">Share</button></div></div><div class="onboarding-settings" style="margin-top:12px"><h3>Account</h3><p class="muted">Signed in as ${currentUser?.email || ''}</p><button class="secondary" id="settings-signout">Sign out</button><button class="danger" id="delete-account">Delete account</button></div>`;
    app.append(view);
    more.onclick = () => { document.querySelectorAll('.view').forEach(v => v.classList.remove('active')); view.classList.add('active'); nav.querySelectorAll('button').forEach(b => b.classList.remove('active')); more.classList.add('active'); loadInviteCode(); };
    $('#settings-signout').onclick = async () => { const { error } = await client.auth.signOut(); if (error) return toast(friendly(error), true); currentUser = null; currentProfile = null; location.reload(); };
    $('#delete-account').onclick = async () => {
      if (!confirm('Delete your account permanently? This may remove your access to store data and cannot be undone.')) return;
      // Auth user deletion must be performed by a trusted server-side RPC, never with an exposed service key.
      const { error } = await client.rpc('delete_my_account');
      if (error) return toast(`Account deletion is not available yet: ${friendly(error)}`, true);
      await client.auth.signOut(); toast('Account deleted.'); location.reload();
    };
    $('#copy-invite').onclick = async () => { const code = $('#invite-code-value').dataset.code; if (!code) return toast('Invite code is not available yet.', true); try { await navigator.clipboard.writeText(code); toast('Invite code copied.'); } catch { toast(`Invite code: ${code}`); } };
    $('#share-invite').onclick = async () => { const code = $('#invite-code-value').dataset.code; if (!code) return toast('Invite code is not available yet.', true); if (navigator.share) { try { await navigator.share({ title: 'Store invite code', text: `Join my store with invite code: ${code}` }); } catch (e) { if (e.name !== 'AbortError') toast(friendly(e), true); } } else { await navigator.clipboard?.writeText(code); toast(`Invite code: ${code}`); } };
  }
  async function loadInviteCode() {
    const target = $('#invite-code-value'); if (!target) return;
    if (currentProfile?.role !== 'owner') { target.closest('.onboarding-settings').classList.add('hidden'); return; }
    target.closest('.onboarding-settings').classList.remove('hidden');
    try {
      let { data, error } = await client.rpc('get_invite_code');
      let code = !error ? (typeof data === 'string' ? data : data?.invite_code || data?.code || data?.[0]?.invite_code || data?.[0]?.code) : null;
      if (!code && currentProfile.store_id) { const result = await client.from('stores').select('invite_code').eq('id', currentProfile.store_id).maybeSingle(); if (!result.error) code = result.data?.invite_code; }
      if (!code) throw error || new Error('Invite-code RPC/field was not found. Configure it in Supabase to enable sharing.');
      target.textContent = code; target.dataset.code = code;
    } catch (error) { target.textContent = 'Not configured'; target.dataset.code = ''; toast(friendly(error), true); }
  }
  async function start() {
    if (!client) { loginScreen('Supabase configuration is missing.'); return; }
    if (new URLSearchParams(location.search).has('reset')) { newPasswordScreen(); return; }
    const { data: { session }, error } = await client.auth.getSession();
    if (error) { loginScreen(friendly(error)); return; }
    if (session?.user) { currentUser = session.user; await routeSignedIn(); }
    else loginScreen();
    client.auth.onAuthStateChange((event, sessionNow) => {
      if (event === 'PASSWORD_RECOVERY') newPasswordScreen();
      else if (sessionNow?.user && !currentUser) { currentUser = sessionNow.user; routeSignedIn(); }
    });
  }
  start().catch(error => { console.error(error); loginScreen(friendly(error)); toast(friendly(error), true); });
})();
