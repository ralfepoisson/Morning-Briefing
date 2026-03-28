(function () {
  'use strict';

  angular.module('morningBriefingApp').service('CurrentUserService', CurrentUserService);

  CurrentUserService.$inject = ['$http', '$q', 'ApiConfig', 'AuthService'];

  function CurrentUserService($http, $q, ApiConfig, AuthService) {
    var state = {
      currentUser: null,
      hasLoaded: false
    };
    var pendingRequest = null;

    this.state = state;

    this.load = function load(force) {
      if (!AuthService.isAuthenticated()) {
        clear();
        return $q.resolve(null);
      }

      if (pendingRequest && !force) {
        return pendingRequest;
      }

      if (state.hasLoaded && !force) {
        return $q.resolve(angular.copy(state.currentUser));
      }

      pendingRequest = $http.get(ApiConfig.baseUrl + '/users/me').then(function handleResponse(response) {
        state.currentUser = response.data && response.data.user ? response.data.user : null;
        state.hasLoaded = true;
        return angular.copy(state.currentUser);
      }).catch(function handleError(error) {
        clear();
        throw error;
      }).finally(function clearPendingRequest() {
        pendingRequest = null;
      });

      return pendingRequest;
    };

    this.getCurrentUser = function getCurrentUser() {
      if (!AuthService.isAuthenticated()) {
        clear();
        return null;
      }

      return angular.copy(state.currentUser);
    };

    this.hasLoadedCurrentUser = function hasLoadedCurrentUser() {
      return state.hasLoaded;
    };

    this.isAdmin = function isAdmin() {
      return !!(AuthService.isAuthenticated() && state.currentUser && state.currentUser.isAdmin);
    };

    this.updateProfile = function updateProfile(payload) {
      return $http.patch(ApiConfig.baseUrl + '/users/me', payload || {}).then(function handleResponse(response) {
        state.currentUser = response.data && response.data.user ? response.data.user : null;
        state.hasLoaded = true;
        return angular.copy(state.currentUser);
      });
    };

    this.clear = clear;

    function clear() {
      state.currentUser = null;
      state.hasLoaded = false;
      pendingRequest = null;
    }
  }
})();
