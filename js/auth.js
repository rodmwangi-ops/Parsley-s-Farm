// ============================================================
// PARSLEY'S FARM — Authentication (Google Identity Services)
// ============================================================

const Auth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let userProfile = null;
  let onAuthChange = null; // callback

  function init(callback) {
    onAuthChange = callback;

    // Load Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      initGSI();
    };
    document.head.appendChild(script);
  }

  function initGSI() {
    // Initialize token client for Sheets API access
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: handleTokenResponse,
      error_callback: handleTokenError
    });

    // Check if we have a cached session
    const cached = localStorage.getItem('pf_user');
    if (cached) {
      try {
        userProfile = JSON.parse(cached);
        // Token still needs refresh, but show UI immediately
        if (onAuthChange) onAuthChange(userProfile, false); // false = token not ready
      } catch (e) {
        localStorage.removeItem('pf_user');
      }
    }
  }

  function signIn() {
    if (!tokenClient) {
      console.error('Auth not initialized');
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  function silentRefresh() {
    if (!tokenClient) return;
    tokenClient.requestAccessToken({ prompt: '' });
  }

  async function handleTokenResponse(resp) {
    if (resp.error) {
      console.error('Token error:', resp.error);
      return;
    }
    accessToken = resp.access_token;

    // Fetch user profile
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      const profile = await res.json();
      userProfile = {
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        picture: profile.picture || null
      };

      // Check if user is allowed
      if (!isAllowed(profile.email)) {
        accessToken = null;
        userProfile = null;
        localStorage.removeItem('pf_user');
        if (onAuthChange) onAuthChange(null, false);
        alert('Access denied. Your email is not authorized.\nUfikiaji umekataliwa.');
        return;
      }

      localStorage.setItem('pf_user', JSON.stringify(userProfile));
      if (onAuthChange) onAuthChange(userProfile, true); // true = token ready

      // Schedule silent refresh before token expires (~55 min)
      setTimeout(silentRefresh, 55 * 60 * 1000);

    } catch (e) {
      console.error('Profile fetch failed:', e);
    }
  }

  function handleTokenError(err) {
    console.error('Token error:', err);
    // If silent refresh failed, user needs to re-authenticate
    if (err.type === 'popup_closed' || err.type === 'popup_failed_to_open') {
      // User closed the popup, do nothing
    }
  }

  function signOut() {
    if (accessToken) {
      google.accounts.oauth2.revoke(accessToken, () => {
        console.log('Token revoked');
      });
    }
    accessToken = null;
    userProfile = null;
    localStorage.removeItem('pf_user');
    if (onAuthChange) onAuthChange(null, false);
  }

  function isAllowed(email) {
    // If no allowed users configured, allow anyone (development mode)
    if (!CONFIG.ALLOWED_USERS || CONFIG.ALLOWED_USERS.length === 0) return true;
    return CONFIG.ALLOWED_USERS.includes(email.toLowerCase());
  }

  function isAdmin(email) {
    if (!email) return false;
    return CONFIG.ADMIN_USERS.includes(email.toLowerCase());
  }

  function getToken() { return accessToken; }
  function getUser() { return userProfile; }
  function isSignedIn() { return !!accessToken && !!userProfile; }

  // Make authorized API call to Google Sheets
  async function sheetsAPI(path, options = {}) {
    if (!accessToken) {
      // Try silent refresh
      return new Promise((resolve, reject) => {
        const origCallback = tokenClient.callback;
        tokenClient.callback = async (resp) => {
          tokenClient.callback = origCallback;
          if (resp.error) { reject(new Error(resp.error)); return; }
          accessToken = resp.access_token;
          try {
            const result = await _doSheetsCall(path, options);
            resolve(result);
          } catch (e) { reject(e); }
        };
        tokenClient.requestAccessToken({ prompt: '' });
      });
    }
    return _doSheetsCall(path, options);
  }

  async function _doSheetsCall(path, options = {}) {
    const url = `${CONFIG.SHEETS_API}/${CONFIG.SHEET_ID}${path}`;
    const headers = {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/json'
    };
    const res = await fetch(url, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) {
      // Token expired
      accessToken = null;
      throw new Error('TOKEN_EXPIRED');
    }
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sheets API error ${res.status}: ${err}`);
    }
    return res.json();
  }

  return { init, signIn, signOut, silentRefresh, getToken, getUser, isSignedIn, isAdmin, sheetsAPI };
})();
