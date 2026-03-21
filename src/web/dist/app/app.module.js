(function () {
  'use strict';

  var runtimeConfig = window.__MORNING_BRIEFING_CONFIG__ || {};

  angular.module('morningBriefingApp', ['ngRoute', 'ngAnimate', 'toaster']).constant('ApiConfig', {
    baseUrl: runtimeConfig.apiBaseUrl || (window.location.protocol + '//' + window.location.hostname + ':3000/api/v1')
  });
})();
