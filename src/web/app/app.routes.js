(function () {
  'use strict';

  angular.module('morningBriefingApp').config(routeConfig);

  routeConfig.$inject = ['$routeProvider'];

  function routeConfig($routeProvider) {
    $routeProvider
      .when('/', {
        template: '<dashboard-page></dashboard-page>'
      })
      .otherwise({
        redirectTo: '/'
      });
  }
})();
