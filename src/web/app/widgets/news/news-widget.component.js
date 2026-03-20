(function () {
  'use strict';

  angular.module('morningBriefingApp').component('newsWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="news-card">' +
      '  <p class="news-headline">{{$ctrl.widget.data.headline}}</p>' +
      '  <div class="news-empty" ng-if="!$ctrl.hasCategories()">{{$ctrl.widget.data.emptyMessage}}</div>' +
      '  <section class="news-section" ng-repeat="category in $ctrl.widget.data.categories track by category.name">' +
      '    <div class="news-section__title">{{category.name}}</div>' +
      '    <article class="news-item" ng-repeat="item in category.bullets track by item.url">' +
      '      <a class="news-item__headline" ng-href="{{item.url}}" target="_blank" rel="noreferrer">{{item.headline}}</a>' +
      '      <p class="news-item__summary" ng-if="item.summary">{{item.summary}}</p>' +
      '      <span class="news-item__source" ng-if="item.sourceName">{{item.sourceName}}</span>' +
      '    </article>' +
      '  </section>' +
      '</div>',
    controller: function NewsWidgetController() {
      var $ctrl = this;

      $ctrl.hasCategories = function hasCategories() {
        return !!($ctrl.widget && $ctrl.widget.data && Array.isArray($ctrl.widget.data.categories) && $ctrl.widget.data.categories.length);
      };
    }
  });
})();
