(function () {
  'use strict';

  angular.module('morningBriefingApp').service('ConnectionService', ConnectionService);

  ConnectionService.$inject = ['$http', '$window', 'ApiConfig'];

  function ConnectionService($http, $window, ApiConfig) {
    this.list = function list(type) {
      var url = ApiConfig.baseUrl + '/connections';

      if (type) {
        url += '?type=' + encodeURIComponent(type);
      }

      return $http.get(url).then(function handleResponse(response) {
        return response.data.items || [];
      });
    };

    this.create = function create(payload) {
      return $http.post(ApiConfig.baseUrl + '/connections', {
        type: payload.type,
        credentials: payload.credentials || {}
      }).then(function handleResponse(response) {
        return response.data;
      });
    };

    this.update = function update(connectionId, payload) {
      return $http.patch(ApiConfig.baseUrl + '/connections/' + encodeURIComponent(connectionId), {
        name: payload.name,
        credentials: payload.credentials || {}
      }).then(function handleResponse(response) {
        return response.data;
      });
    };

    this.startGoogleCalendarOAuth = function startGoogleCalendarOAuth(returnTo, connectionId) {
      var url = ApiConfig.baseUrl + '/connections/google-calendar/oauth/start?returnTo=' + encodeURIComponent(returnTo || $window.location.href);

      if (connectionId) {
        url += '&connectionId=' + encodeURIComponent(connectionId);
      }

      $window.location.href = url;
    };
  }
})();
