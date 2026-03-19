(function () {
  'use strict';

  angular.module('morningBriefingApp', ['ngRoute']).constant('ApiConfig', {
    baseUrl: window.location.protocol + '//' + window.location.hostname + ':3000/api/v1'
  });
})();
