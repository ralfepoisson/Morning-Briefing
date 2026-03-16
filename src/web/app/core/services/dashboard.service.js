(function () {
  'use strict';

  angular.module('morningBriefingApp').service('DashboardService', DashboardService);

  function DashboardService() {
    var nextDashboardId = 2;
    var activeDashboardId = 1;
    var dashboards = [
      {
        id: 1,
        name: 'Morning Focus',
        description: 'A calm, personal start-of-day dashboard for today.',
        theme: 'aurora'
      }
    ];

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

    this.create = function create(payload) {
      var dashboard = {
        id: nextDashboardId++,
        name: payload.name,
        description: payload.description || '',
        theme: payload.theme || 'aurora'
      };

      dashboards.push(dashboard);
      activeDashboardId = dashboard.id;

      return dashboard;
    };

    this.update = function update(dashboardId, payload) {
      var dashboard = dashboards.find(function (item) {
        return item.id === dashboardId;
      });

      if (!dashboard) {
        return null;
      }

      dashboard.name = payload.name;
      dashboard.description = payload.description || '';

      return dashboard;
    };
  }
})();
