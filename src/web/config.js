var morningBriefingApiHost = window.location.hostname === 'localhost'
  ? '127.0.0.1'
  : window.location.hostname;

window.__MORNING_BRIEFING_CONFIG__ = Object.assign({
  apiBaseUrl: window.location.protocol + '//' + morningBriefingApiHost + ':3000/api/v1',
  authServiceSignInUrl: 'http://localhost:63431/signIn',
  authServiceSignOutUrl: 'http://localhost:63431/logout',
  appBaseUrl: window.location.origin + '/'
}, window.__MORNING_BRIEFING_CONFIG__ || {});
