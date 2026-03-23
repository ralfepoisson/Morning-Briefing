(function () {
  'use strict';

  var runtimeConfig = window.__MORNING_BRIEFING_CONFIG__ || {};
  var defaultApiHost = window.location.hostname === 'localhost'
    ? '127.0.0.1'
    : window.location.hostname;

  angular.module('morningBriefingApp', ['ngRoute', 'ngAnimate', 'toaster']).constant('ApiConfig', {
    baseUrl: runtimeConfig.apiBaseUrl || (window.location.protocol + '//' + defaultApiHost + ':3000/api/v1')
  }).constant('AuthConfig', {
    signInUrl: runtimeConfig.authServiceSignInUrl || '',
    signOutUrl: runtimeConfig.authServiceSignOutUrl || '',
    appBaseUrl: runtimeConfig.appBaseUrl || buildDefaultAppBaseUrl()
  }).config(httpConfig);

  httpConfig.$inject = ['$httpProvider'];

  function httpConfig($httpProvider) {
    $httpProvider.interceptors.push('AuthHttpInterceptor');
  }

  function buildDefaultAppBaseUrl() {
    var pathname = window.location.pathname || '/';

    if (!pathname.endsWith('/')) {
      pathname = pathname.replace(/\/[^/]*$/, '/') || '/';
    }

    return window.location.origin + pathname;
  }
})();
