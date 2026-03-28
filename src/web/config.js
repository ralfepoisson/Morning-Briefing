var morningBriefingApiHost = window.location.hostname === 'localhost'
  ? '127.0.0.1'
  : window.location.hostname;

window.__MORNING_BRIEFING_CONFIG__ = Object.assign({
  apiBaseUrl: window.location.protocol + '//' + morningBriefingApiHost + ':3000/api/v1',
  authServiceSignInUrl: 'http://auth-service.localhost:46138/signIn',
  authServiceApplicationId: '4b396734eb3f182551e23f4069e4a7a6b15baf46231393cf',
  authServiceSignOutUrl: 'http://auth-service.localhost:46138/logout',
  appBaseUrl: window.location.origin + '/'
}, window.__MORNING_BRIEFING_CONFIG__ || {});
