(function () {
  'use strict';

  var TOKEN_KEY = 'morningBriefing.auth.token';
  var SESSION_KEY = 'morningBriefing.auth.session';
  var RETURN_PATH_KEY = 'morningBriefing.auth.returnPath';
  var ERROR_KEY = 'morningBriefing.auth.error';
  var PUBLIC_ROUTES = {
    '/': true,
    '/terms': true,
    '/privacy': true,
    '/contact': true,
    '/signed-out': true,
    '/auth/callback': true
  };
  var AUTH_REDIRECT_ROUTES = {
    '/': true,
    '/signed-out': true,
    '/auth/callback': true
  };

  angular.module('morningBriefingApp').service('AuthService', AuthService);

  AuthService.$inject = ['$window', '$location', 'LocalStorageService', 'NotificationService', 'AuthConfig'];

  function AuthService($window, $location, LocalStorageService, NotificationService, AuthConfig) {
    var authState = {
      token: null,
      session: null
    };

    this.restoreSession = function restoreSession() {
      var token = LocalStorageService.get(TOKEN_KEY);

      if (!token) {
        clearStoredSession();
        return null;
      }

      return setSessionFromToken(token, {
        notifyOnFailure: false
      });
    };

    this.consumeCallback = function consumeCallback() {
      var token = extractTokenFromLocation();

      console.log('[AuthService] consumeCallback start', {
        href: $window.location.href,
        path: $location.path(),
        hasToken: !!token
      });

      if (!token) {
        console.log('[AuthService] consumeCallback no token found');
        return false;
      }

      if (!setSessionFromToken(token, {
        notifyOnFailure: true
      })) {
        console.warn('[AuthService] consumeCallback token rejected', {
          error: LocalStorageService.get(ERROR_KEY) || ''
        });
        stripCallbackParamsFromUrl();
        return true;
      }

      console.log('[AuthService] consumeCallback token accepted', {
        session: authState.session
      });
      stripCallbackParamsFromUrl();
      return true;
    };

    this.beginSignIn = function beginSignIn(returnPath) {
      var targetPath = sanitizeReturnPath(returnPath || $location.url() || '/');

      LocalStorageService.set(RETURN_PATH_KEY, targetPath);

      if (!AuthConfig.signInUrl || !AuthConfig.applicationId) {
        NotificationService.error('Authentication is not configured yet for this environment.');
        $location.path('/signed-out');
        return;
      }

      $window.location.assign(buildSignInUrl());
    };

    this.signOut = function signOut() {
      clearSession();
      $location.path('/signed-out');
    };

    this.isAuthenticated = function isAuthenticated() {
      return !!authState.token && !isExpired(authState.session);
    };

    this.isPublicRoute = function isPublicRoute(path) {
      return !!PUBLIC_ROUTES[path];
    };

    this.shouldRedirectAuthenticatedPublicRoute = function shouldRedirectAuthenticatedPublicRoute(path) {
      return !!AUTH_REDIRECT_ROUTES[path];
    };

    this.hasIncomingToken = function hasIncomingToken() {
      return !!extractTokenFromLocation();
    };

    this.getToken = function getToken() {
      return this.isAuthenticated() ? authState.token : null;
    };

    this.getSession = function getSession() {
      return this.isAuthenticated() ? angular.copy(authState.session) : null;
    };

    this.consumePendingReturnPath = function consumePendingReturnPath() {
      var returnPath = LocalStorageService.get(RETURN_PATH_KEY);
      LocalStorageService.remove(RETURN_PATH_KEY);
      return sanitizeReturnPath(returnPath || '/');
    };

    this.getSignOutUrl = function getSignOutUrl() {
      return AuthConfig.signOutUrl || '';
    };

    this.getLastError = function getLastError() {
      return LocalStorageService.get(ERROR_KEY) || '';
    };

    function setSessionFromToken(token, options) {
      var session;

      try {
        session = parseToken(token);
      } catch (error) {
        clearSession();
        LocalStorageService.set(ERROR_KEY, error && error.message ? error.message : 'The authentication response was invalid.');
        console.warn('[AuthService] setSessionFromToken failed', {
          message: error && error.message ? error.message : 'The authentication response was invalid.'
        });

        if (options && options.notifyOnFailure) {
          NotificationService.error(error.message || 'The authentication response was invalid.');
        }

        return null;
      }

      authState.token = token;
      authState.session = session;
      LocalStorageService.set(TOKEN_KEY, token);
      LocalStorageService.set(SESSION_KEY, JSON.stringify(session));
      LocalStorageService.remove(ERROR_KEY);
      console.log('[AuthService] setSessionFromToken stored session', {
        session: session
      });
      return session;
    }

    function clearSession() {
      authState.token = null;
      authState.session = null;
      clearStoredSession();
      LocalStorageService.remove(RETURN_PATH_KEY);
    }

    function clearStoredSession() {
      LocalStorageService.remove(TOKEN_KEY);
      LocalStorageService.remove(SESSION_KEY);
    }

    function parseToken(token) {
      var segments = token.split('.');
      var payload;
      var expiresAt;

      if (segments.length < 2) {
        throw new Error('The returned authentication token is malformed.');
      }

      payload = JSON.parse(decodeBase64Url(segments[1]));

      if (!firstNonEmptyString([payload.userid, payload.userId, payload.sub])) {
        throw new Error('The authentication token is missing a userid claim.');
      }

      if (!firstNonEmptyString([payload.accountId, payload.accountid, payload.tenantId, payload.tenantid])) {
        throw new Error('The authentication token is missing an accountId claim.');
      }

      expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : null;

      if (expiresAt && expiresAt <= Date.now()) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      return {
        userid: firstNonEmptyString([payload.userid, payload.userId, payload.sub]),
        accountId: firstNonEmptyString([payload.accountId, payload.accountid, payload.tenantId, payload.tenantid]),
        displayName: firstNonEmptyString([payload.displayName, payload.name, payload.email, payload.userid, payload.userId, payload.sub]) || firstNonEmptyString([payload.userid, payload.userId, payload.sub]),
        email: firstNonEmptyString([payload.email]),
        exp: typeof payload.exp === 'number' ? payload.exp : null,
        rawClaims: payload
      };
    }

    function buildSignInUrl() {
      var signInUrl = new URL(AuthConfig.signInUrl, $window.location.origin);
      signInUrl.searchParams.delete('applicationToken');
      signInUrl.searchParams.set('applicationId', AuthConfig.applicationId);
      signInUrl.searchParams.set('redirect', buildCallbackUrl());
      return signInUrl.toString();
    }

    function buildCallbackUrl() {
      return stripTrailingSlash(AuthConfig.appBaseUrl) + '/#/auth/callback';
    }

    function stripCallbackParamsFromUrl() {
      var currentUrl = new URL($window.location.href);
      var hashQueryIndex = currentUrl.hash.indexOf('?');

      currentUrl.searchParams.delete('token');
      currentUrl.searchParams.delete('auth-callback');

      if (hashQueryIndex !== -1) {
        currentUrl.hash = currentUrl.hash.slice(0, hashQueryIndex);
      }

      $window.history.replaceState({}, $window.document.title, currentUrl.pathname + currentUrl.search + currentUrl.hash);
    }

    function extractTokenFromLocation() {
      var match = ($window.location.href || '').match(/[?&]token=([^&#]+)/);

      if (!match || !match[1]) {
        return '';
      }

      try {
        return decodeURIComponent(match[1].replace(/\+/g, '%20'));
      } catch (error) {
        return match[1];
      }
    }

    function sanitizeReturnPath(returnPath) {
      if (!returnPath || returnPath.charAt(0) !== '/') {
        return '/';
      }

      return returnPath;
    }

    function decodeBase64Url(value) {
      var normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      var padding = normalized.length % 4;

      if (padding) {
        normalized += '='.repeat(4 - padding);
      }

      return $window.atob(normalized);
    }

    function isExpired(session) {
      return !!(session && typeof session.exp === 'number' && (session.exp * 1000) <= Date.now());
    }

    function stripTrailingSlash(value) {
      return value.replace(/\/+$/, '');
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
  }
})();
