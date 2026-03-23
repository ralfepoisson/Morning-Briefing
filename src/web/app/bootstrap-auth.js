(function () {
  'use strict';

  var TOKEN_KEY = 'morningBriefing.auth.token';
  var SESSION_KEY = 'morningBriefing.auth.session';

  normalizeIncomingToken();
  purgeExpiredStoredToken();

  function normalizeIncomingToken() {
    var token = extractTokenFromLocation();
    var session;

    if (!token) {
      return;
    }

    try {
      session = parseToken(token);
      setLocalStorage(TOKEN_KEY, token);
      setLocalStorage(SESSION_KEY, JSON.stringify(session));
    } catch (error) {
      removeLocalStorage(TOKEN_KEY);
      removeLocalStorage(SESSION_KEY);
    }

    stripCallbackParamsFromUrl();
  }

  function purgeExpiredStoredToken() {
    var token = getLocalStorage(TOKEN_KEY);

    if (!token) {
      return;
    }

    try {
      parseToken(token);
    } catch (error) {
      removeLocalStorage(TOKEN_KEY);
      removeLocalStorage(SESSION_KEY);
    }
  }

  function extractTokenFromLocation() {
    var match = (window.location.href || '').match(/[?&]token=([^&#]+)/);

    if (!match || !match[1]) {
      return '';
    }

    try {
      return decodeURIComponent(match[1].replace(/\+/g, '%20'));
    } catch (error) {
      return match[1];
    }
  }

  function parseToken(token) {
    var segments = token.split('.');
    var payload;
    var expiresAt;

    if (segments.length < 2) {
      throw new Error('Malformed token.');
    }

    payload = JSON.parse(decodeBase64Url(segments[1]));

    if (!firstNonEmptyString([payload.userid, payload.userId, payload.sub])) {
      throw new Error('Missing user id claim.');
    }

    if (!firstNonEmptyString([payload.accountId, payload.accountid, payload.tenantId, payload.tenantid])) {
      throw new Error('Missing account id claim.');
    }

    expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : null;

    if (expiresAt && expiresAt <= Date.now()) {
      throw new Error('Expired token.');
    }

    return {
      userid: firstNonEmptyString([payload.userid, payload.userId, payload.sub]),
      accountId: firstNonEmptyString([payload.accountId, payload.accountid, payload.tenantId, payload.tenantid]),
      displayName: firstNonEmptyString([payload.displayName, payload.name, payload.email, payload.userid, payload.userId, payload.sub]),
      email: firstNonEmptyString([payload.email]),
      exp: typeof payload.exp === 'number' ? payload.exp : null,
      rawClaims: payload
    };
  }

  function stripCallbackParamsFromUrl() {
    var currentUrl = new URL(window.location.href);
    var hashQueryIndex = currentUrl.hash.indexOf('?');

    currentUrl.searchParams.delete('token');
    currentUrl.searchParams.delete('auth-callback');

    if (hashQueryIndex !== -1) {
      currentUrl.hash = currentUrl.hash.slice(0, hashQueryIndex);
    }

    window.history.replaceState({}, window.document.title, currentUrl.pathname + currentUrl.search + currentUrl.hash);
  }

  function decodeBase64Url(value) {
    var normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    var padding = normalized.length % 4;

    if (padding) {
      normalized += '='.repeat(4 - padding);
    }

    return window.atob(normalized);
  }

  function firstNonEmptyString(values) {
    var index;
    var value;

    for (index = 0; index < values.length; index += 1) {
      value = values[index];

      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }

      if ((typeof value === 'number' || typeof value === 'bigint') && String(value).trim()) {
        return String(value).trim();
      }
    }

    return '';
  }

  function getLocalStorage(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function setLocalStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return null;
    }

    return value;
  }

  function removeLocalStorage(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      return null;
    }

    return null;
  }
})();
