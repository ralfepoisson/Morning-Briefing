(function () {
  'use strict';

  angular.module('morningBriefingApp').config(routeConfig);

  routeConfig.$inject = ['$routeProvider', '$locationProvider'];

  function routeConfig($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix('');

    $routeProvider
      .when('/', {
        template: '<dashboard-page></dashboard-page>'
      })
      .when('/signed-out', {
        template: '<auth-status-page></auth-status-page>'
      })
      .when('/auth/callback', {
        template: '<auth-callback-page></auth-callback-page>'
      })
      .when('/connectors', {
        template: '<connectors-page></connectors-page>'
      })
      .when('/rss-feeds', {
        template: '<rss-feeds-page></rss-feeds-page>'
      })
      .when('/admin/message-broker', {
        template: '<message-broker-page></message-broker-page>'
      })
      .when('/admin/users', {
        template: '<user-admin-page></user-admin-page>'
      })
      .when('/admin/widgets', {
        template: '<widgets-page></widgets-page>'
      })
      .when('/admin/logs', {
        template: '<logs-page></logs-page>'
      })
      .otherwise({
        redirectTo: '/'
      });
  }
})();
