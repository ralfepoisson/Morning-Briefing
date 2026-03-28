(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AdminWidgetService', AdminWidgetService);

  AdminWidgetService.$inject = ['$http', 'ApiConfig'];

  function AdminWidgetService($http, ApiConfig) {
    this.list = function list() {
      return $http.get(ApiConfig.baseUrl + '/admin/widgets').then(function handleResponse(response) {
        return response.data;
      });
    };

    this.regenerateSnapshot = function regenerateSnapshot(widgetId) {
      return $http.post(ApiConfig.baseUrl + '/admin/widgets/' + widgetId + '/regenerate-snapshot', {
        bypassDuplicateCheck: true
      }).then(function handleResponse(response) {
        return response.data;
      });
    };

    this.regenerateAllSnapshots = function regenerateAllSnapshots() {
      return $http.post(ApiConfig.baseUrl + '/admin/widgets/regenerate-all-snapshots', {
        bypassDuplicateCheck: true
      }).then(function handleResponse(response) {
        return response.data;
      });
    };
  }
})();
