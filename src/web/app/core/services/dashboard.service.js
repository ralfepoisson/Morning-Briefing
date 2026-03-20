(function () {
  'use strict';

  angular.module('morningBriefingApp').service('DashboardService', DashboardService);

  DashboardService.$inject = ['$http', 'ApiConfig'];

  function DashboardService($http, ApiConfig) {
    var activeDashboardId = null;
    var dashboards = [];
    var loadingPromise = null;

    this.list = function list() {
      return dashboards;
    };

    this.getActiveId = function getActiveId() {
      return activeDashboardId;
    };

    this.getActive = function getActive() {
      return dashboards.find(function (dashboard) {
        return dashboard.id === activeDashboardId;
      }) || null;
    };

    this.setActive = function setActive(dashboardId) {
      activeDashboardId = dashboardId;
    };

    this.load = function load() {
      if (loadingPromise) {
        return loadingPromise;
      }

      loadingPromise = $http.get(ApiConfig.baseUrl + '/dashboards').then(function handleResponse(response) {
        replaceDashboards(response.data.items || []);
        ensureActiveDashboard();
        return dashboards;
      }).finally(function clearLoadingPromise() {
        loadingPromise = null;
      });

      return loadingPromise;
    };

    this.create = function create(payload) {
      return $http.post(ApiConfig.baseUrl + '/dashboards', {
        name: payload.name,
        description: payload.description || '',
        theme: payload.theme || 'aurora'
      }).then(function handleResponse(response) {
        dashboards.push(response.data);
        activeDashboardId = response.data.id;
        return response.data;
      });
    };

    this.update = function update(dashboardId, payload) {
      return $http.patch(ApiConfig.baseUrl + '/dashboards/' + dashboardId, {
        name: payload.name,
        description: payload.description || ''
      }).then(function handleResponse(response) {
        var dashboard = dashboards.find(function (item) {
          return item.id === dashboardId;
        });

        if (dashboard) {
          dashboard.name = response.data.name;
          dashboard.description = response.data.description;
          dashboard.theme = response.data.theme;
        }

        return response.data;
      });
    };

    this.archive = function archive(dashboardId) {
      return $http.delete(ApiConfig.baseUrl + '/dashboards/' + dashboardId).then(function handleResponse() {
        var archivedIndex = dashboards.findIndex(function (item) {
          return item.id === dashboardId;
        });

        if (archivedIndex !== -1) {
          dashboards.splice(archivedIndex, 1);
        }

        ensureActiveDashboard();
      });
    };

    function replaceDashboards(nextDashboards) {
      dashboards.length = 0;
      Array.prototype.push.apply(dashboards, nextDashboards);
    }

    function ensureActiveDashboard() {
      var activeDashboard = dashboards.find(function (dashboard) {
        return dashboard.id === activeDashboardId;
      });

      if (!activeDashboard) {
        activeDashboardId = dashboards.length ? dashboards[0].id : null;
      }
    }
  }
})();
