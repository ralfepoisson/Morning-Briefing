(function () {
  'use strict';

  angular.module('morningBriefingApp').factory('AuthHttpInterceptor', AuthHttpInterceptor);

  AuthHttpInterceptor.$inject = ['AuthService', '$q'];

  function AuthHttpInterceptor(AuthService, $q) {
    return {
      request: function request(config) {
        var token = AuthService.getToken();

        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = 'Bearer ' + token;
        }

        return config;
      },
      responseError: function responseError(rejection) {
        if (rejection && rejection.status === 401 && AuthService.isAuthenticated()) {
          AuthService.signOut();
        }

        return $q.reject(rejection);
      }
    };
  }
})();
