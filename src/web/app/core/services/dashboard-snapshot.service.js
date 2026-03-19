(function () {
  'use strict';

  angular.module('morningBriefingApp').service('DashboardSnapshotService', DashboardSnapshotService);

  DashboardSnapshotService.$inject = ['$http', '$q', 'ApiConfig'];

  function DashboardSnapshotService($http, $q, ApiConfig) {
    this.loadLatestForDashboard = function loadLatestForDashboard(dashboardId) {
      if (!dashboardId) {
        return $q.resolve(null);
      }

      return $http.get(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/snapshots/latest').then(function handleResponse(response) {
        return response.data || null;
      }).catch(function handleError(error) {
        if (error && error.status === 404) {
          return null;
        }

        throw error;
      });
    };
  }
})();
