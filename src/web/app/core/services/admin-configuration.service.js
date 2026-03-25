(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AdminConfigurationService', AdminConfigurationService);

  AdminConfigurationService.$inject = ['$http', 'ApiConfig'];

  function AdminConfigurationService($http, ApiConfig) {
    this.get = function get() {
      return $http.get(ApiConfig.baseUrl + '/admin/configuration').then(function handleResponse(response) {
        return response.data || null;
      });
    };

    this.update = function update(payload) {
      return $http.patch(ApiConfig.baseUrl + '/admin/configuration', payload || {}).then(function handleResponse(response) {
        return response.data || null;
      });
    };
  }
})();
