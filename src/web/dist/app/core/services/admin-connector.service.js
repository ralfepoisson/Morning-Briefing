(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AdminConnectorService', AdminConnectorService);

  AdminConnectorService.$inject = ['$http', 'ApiConfig'];

  function AdminConnectorService($http, ApiConfig) {
    this.list = function list() {
      return $http.get(ApiConfig.baseUrl + '/admin/connectors').then(function handleResponse(response) {
        return response.data.items || [];
      });
    };
  }
})();
