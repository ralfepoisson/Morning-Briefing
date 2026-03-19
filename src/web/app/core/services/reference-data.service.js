(function () {
  'use strict';

  angular.module('morningBriefingApp').service('ReferenceDataService', ReferenceDataService);

  ReferenceDataService.$inject = ['$http', '$q', 'ApiConfig'];

  function ReferenceDataService($http, $q, ApiConfig) {
    this.searchCities = function searchCities(query) {
      var normalizedQuery = (query || '').trim();

      if (normalizedQuery.length < 2) {
        return $q.resolve([]);
      }

      return $http.get(ApiConfig.baseUrl + '/reference/cities', {
        params: {
          q: normalizedQuery
        }
      }).then(function handleResponse(response) {
        return response.data.items || [];
      });
    };
  }
})();
