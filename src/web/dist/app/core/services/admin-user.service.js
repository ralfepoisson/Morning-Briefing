(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AdminUserService', AdminUserService);

  AdminUserService.$inject = ['$http', 'ApiConfig'];

  function AdminUserService($http, ApiConfig) {
    this.list = function list() {
      return $http.get(ApiConfig.baseUrl + '/admin/users').then(function handleResponse(response) {
        return response.data;
      });
    };

    this.updateAccess = function updateAccess(userId, isAdmin) {
      return $http.patch(ApiConfig.baseUrl + '/admin/users/' + userId + '/access', {
        isAdmin: isAdmin
      }).then(function handleResponse(response) {
        return response.data;
      });
    };
  }
})();
