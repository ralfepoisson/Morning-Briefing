(function () {
  'use strict';

  angular.module('morningBriefingApp').service('WidgetRegistryService', WidgetRegistryService);

  function WidgetRegistryService() {
    var definitions = [];
    var definitionMap = {};

    this.register = function register(definition) {
      if (!definition || !definition.type) {
        return;
      }

      definitionMap[definition.type] = definition;

      definitions = definitions.filter(function (item) {
        return item.type !== definition.type;
      });
      definitions.push(definition);
    };

    this.get = function get(type) {
      return definitionMap[type] || null;
    };

    this.list = function list() {
      return definitions.slice();
    };
  }
})();
