(function () {
  'use strict';

  angular.module('morningBriefingApp').service('SessionStorageService', SessionStorageService);

  SessionStorageService.$inject = ['$window'];

  function SessionStorageService($window) {
    this.get = function get(key) {
      try {
        return $window.sessionStorage.getItem(key);
      } catch (error) {
        return null;
      }
    };

    this.set = function set(key, value) {
      try {
        $window.sessionStorage.setItem(key, value);
      } catch (error) {
        return null;
      }

      return value;
    };

    this.remove = function remove(key) {
      try {
        $window.sessionStorage.removeItem(key);
      } catch (error) {
        return null;
      }

      return null;
    };
  }
})();
