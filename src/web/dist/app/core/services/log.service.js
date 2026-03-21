(function () {
  'use strict';

  angular.module('morningBriefingApp').service('LogService', LogService);

  LogService.$inject = ['$http', 'ApiConfig'];

  function LogService($http, ApiConfig) {
    this.getLogs = function getLogs(filters) {
      var params = {
        q: filters && filters.q ? filters.q : '',
        levels: filters && filters.levels ? filters.levels.join(',') : 'info,warn,error',
        limit: filters && filters.limit ? filters.limit : 200,
        range: filters && filters.range ? filters.range : 'all'
      };

      return $http.get(ApiConfig.baseUrl + '/admin/logs', {
        params: params
      }).then(function handleResponse(response) {
        return response.data;
      });
    };
  }
})();
