(function () {
  'use strict';

  angular.module('morningBriefingApp').service('LocalStorageService', LocalStorageService);

  LocalStorageService.$inject = ['$window'];

  function LocalStorageService($window) {
    this.get = function get(key) {
      try {
        return $window.localStorage.getItem(key);
      } catch (error) {
        return null;
      }
    };

    this.set = function set(key, value) {
      try {
        $window.localStorage.setItem(key, value);
      } catch (error) {
        return null;
      }

      return value;
    };

    this.remove = function remove(key) {
      try {
        $window.localStorage.removeItem(key);
      } catch (error) {
        return null;
      }

      return null;
    };
  }
})();
