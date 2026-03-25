(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AdminDashboardService', AdminDashboardService);

  AdminDashboardService.$inject = ['$http', 'ApiConfig'];

  function AdminDashboardService($http, ApiConfig) {
    this.list = function list() {
      return $http.get(ApiConfig.baseUrl + '/admin/dashboards').then(function handleResponse(response) {
        return response.data;
      });
    };

    this.regenerateAudioBriefing = function regenerateAudioBriefing(dashboardId) {
      return $http.post(ApiConfig.baseUrl + '/admin/dashboards/' + dashboardId + '/regenerate-audio-briefing').then(function handleResponse(response) {
        return response.data;
      });
    };
  }
})();
