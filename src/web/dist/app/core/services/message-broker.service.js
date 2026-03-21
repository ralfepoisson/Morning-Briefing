(function () {
  'use strict';

  angular.module('morningBriefingApp').service('MessageBrokerService', MessageBrokerService);

  MessageBrokerService.$inject = ['$http', 'ApiConfig'];

  function MessageBrokerService($http, ApiConfig) {
    this.getOverview = function getOverview() {
      return $http.get(ApiConfig.baseUrl + '/admin/message-broker').then(function handleResponse(response) {
        return response.data;
      });
    };
  }
})();
