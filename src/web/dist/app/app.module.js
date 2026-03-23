(function () {
  'use strict';

  var runtimeConfig = window.__MORNING_BRIEFING_CONFIG__ || {};

  angular.module('morningBriefingApp', ['ngRoute', 'ngAnimate', 'toaster']).constant('ApiConfig', {
    baseUrl: runtimeConfig.apiBaseUrl || (window.location.protocol + '//' + window.location.hostname + ':3000/api/v1')
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
