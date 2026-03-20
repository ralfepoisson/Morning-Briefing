(function () {
  'use strict';

  angular.module('morningBriefingApp').component('xkcdWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="xkcd-card" overflow-autopan>' +
      '  <a class="xkcd-card__link" ng-if="$ctrl.hasImage()" ng-href="{{$ctrl.widget.data.permalink}}" target="_blank" rel="noreferrer">' +
      '    <img class="xkcd-card__image" ng-src="{{$ctrl.widget.data.imageUrl}}" alt="{{$ctrl.widget.data.altText || $ctrl.widget.data.title}}" />' +
      '  </a>' +
      '  <div class="xkcd-card__empty" ng-if="!$ctrl.hasImage()">{{$ctrl.widget.data.emptyMessage}}</div>' +
      '  <a class="xkcd-card__title" ng-if="$ctrl.widget.data.permalink" ng-href="{{$ctrl.widget.data.permalink}}" target="_blank" rel="noreferrer">{{$ctrl.widget.data.title}}</a>' +
      '  <p class="xkcd-card__meta" ng-if="$ctrl.getMetaLine()">{{$ctrl.getMetaLine()}}</p>' +
      '  <p class="xkcd-card__alt" ng-if="$ctrl.widget.data.altText">{{$ctrl.widget.data.altText}}</p>' +
      '</div>',
    controller: function XkcdWidgetController() {
      var $ctrl = this;

      $ctrl.hasImage = function hasImage() {
        return !!($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.imageUrl);
      };

      $ctrl.getMetaLine = function getMetaLine() {
        var parts = [];
        var data = $ctrl.widget && $ctrl.widget.data ? $ctrl.widget.data : {};

        if (data.comicId) {
          parts.push('#' + data.comicId);
        }

        if (data.publishedAt) {
          parts.push(data.publishedAt);
        }

        return parts.join(' • ');
      };
    }
  });
})();
