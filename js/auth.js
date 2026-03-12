// ============================================================
// PARSLEY'S FARM — Authentication (Supabase Magic Links)
// Sign in once via email link, stay logged in permanently.
// ============================================================

const Auth = (() => {
  let supaClient = null;
  let currentUser = null;
  let onAuthChange = null;
  let _initDone = false;

  function init(callback) {
    onAuthChange = callback;

    supaClient = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,      // Store session in localStorage
        autoRefreshToken: true,     // Auto-refresh before expiry
        detectSessionInUrl: true    // Catch magic link redirect
      }
    });

    // 1) Immediately show cached user (no flash of login screen)
    const cached = localStorage.getItem('pf_user');
    if (cached) {
      try {
        currentUser = JSON.parse(cached);
        if (onAuthChange) onAuthChange(currentUser, false);
      } catch (e) {
        localStorage.removeItem('pf_user');
      }
    }

    // 2) Listen for real auth state (confirms session, handles magic link return)
    supaClient.auth.onAuthStateChange((event, session) => {
      console.log('Auth event:', event);

      if (session && session.user) {
        const email = session.user.email || '';
        if (!isAllowed(email)) {
          supaClient.auth.signOut();
          alert('Access denied. Your email is not authorized.\nUfikiaji umekataliwa.');
          return;
        }
        currentUser = {
          email: email,
          name: email.split('@')[0],
          picture: null
        };
        localStorage.setItem('pf_user', JSON.stringify(currentUser));
        // Only fire callback with tokenReady=true if this is a real session
        if (onAuthChange) onAuthChange(currentUser, true);

      } else if (event === 'SIGNED_OUT') {
        currentUser = null;
        localStorage.removeItem('pf_user');
        if (onAuthChange) onAuthChange(null, false);

      } else if (event === 'TOKEN_REFRESHED') {
        // Session refreshed in background — no UI action needed
        console.log('Session token refreshed');
      }

      _initDone = true;
    });
  }

  async function signIn() {
    if (!supaClient) { alert('App not initialized'); return; }

    const emailInput = document.getElementById('loginEmail');
    if (!emailInput) { alert('Email field not found'); return; }

    const email = emailInput.value.trim().toLowerCase();
    if (!email) { alert('Enter your email / Weka barua pepe yako'); return; }

    if (!isAllowed(email)) {
      alert('Access denied. Your email is not authorized.\nUfikiaji umekataliwa.');
      return;
    }

    const btn = document.getElementById('loginBtn');
    if (btn) { btn.textContent = 'Sending... / Inatuma...'; btn.disabled = true; }

    try {
      const { error } = await supaClient.auth.signInWithOtp({
        email: email,
        options: {
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });

      if (error) {
        console.error('Magic link error:', error);
        alert('Failed to send link: ' + error.message);
      } else {
        const noteEl = document.getElementById('loginNote');
        if (noteEl) {
          noteEl.innerHTML = '✅ <b>Link sent!</b> Check your email, click the link, and you\'ll be signed in.<br><span style="font-size:10px">Angalia barua pepe yako, bonyeza kiunganishi</span>';
          noteEl.style.color = '#8f8';
          noteEl.style.fontSize = '12px';
        }
      }
    } catch (err) {
      console.error('Sign-in exception:', err);
      alert('Sign-in failed: ' + err.message);
    } finally {
      if (btn) { btn.textContent = 'Send sign-in link / Tuma kiunganishi'; btn.disabled = false; }
    }
  }

  async function signOut() {
    if (supaClient) {
      await supaClient.auth.signOut();
    }
    currentUser = null;
    localStorage.removeItem('pf_user');
    if (onAuthChange) onAuthChange(null, false);
  }

  function isAllowed(email) {
    if (!CONFIG.ALLOWED_USERS || CONFIG.ALLOWED_USERS.length === 0) return true;
    return CONFIG.ALLOWED_USERS.includes(email.toLowerCase());
  }

  function isAdmin(email) {
    if (!email) return false;
    return CONFIG.ADMIN_USERS.includes(email.toLowerCase());
  }

  function getUser() { return currentUser; }
  function isSignedIn() { return !!currentUser; }
  function getClient() { return supaClient; }

  return { init, signIn, signOut, getUser, isSignedIn, isAdmin, getClient };
})();
