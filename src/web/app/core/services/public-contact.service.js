(function () {
  'use strict';

  angular.module('morningBriefingApp').service('PublicContactService', PublicContactService);

  PublicContactService.$inject = ['$http', 'ApiConfig'];

  function PublicContactService($http, ApiConfig) {
    this.sendMessage = function sendMessage(payload) {
      return $http.post(ApiConfig.baseUrl + '/public/contact', payload).then(function handleResponse(response) {
        return response.data || {};
      });
    };
  }
})();
