// ============================================================
// PARSLEY'S FARM — Authentication (Firebase Auth + Google)
// ============================================================

const Auth = (() => {
  let currentUser = null;
  let onAuthChange = null;

  function init(callback) {
    onAuthChange = callback;

    // Listen for auth state changes
    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        const email = user.email || '';
        if (!isAllowed(email)) {
          firebase.auth().signOut();
          alert('Access denied. Your email is not authorized.\nUfikiaji umekataliwa.');
          return;
        }
        currentUser = {
          email: email,
          name: user.displayName || email.split('@')[0],
          picture: user.photoURL || null
        };
        localStorage.setItem('pf_user', JSON.stringify(currentUser));
        if (onAuthChange) onAuthChange(currentUser, true);
      } else {
        currentUser = null;
        localStorage.removeItem('pf_user');
        if (onAuthChange) onAuthChange(null, false);
      }
    });

    // Show cached user while Firebase loads (faster perceived login)
    const cached = localStorage.getItem('pf_user');
    if (cached) {
      try {
        currentUser = JSON.parse(cached);
        if (onAuthChange) onAuthChange(currentUser, false);
      } catch (e) {
        localStorage.removeItem('pf_user');
      }
    }
  }

  function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => {
      if (err.code === 'auth/popup-closed-by-user') return;
      console.error('Sign-in error:', err);
      alert('Sign-in failed: ' + err.message);
    });
  }

  function signOut() {
    firebase.auth().signOut();
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
  // Works offline: currentUser is set from localStorage cache immediately,
  // then confirmed by firebase.auth().onAuthStateChanged
  function isSignedIn() { return !!currentUser; }

  return { init, signIn, signOut, getUser, isSignedIn, isAdmin };
})();
