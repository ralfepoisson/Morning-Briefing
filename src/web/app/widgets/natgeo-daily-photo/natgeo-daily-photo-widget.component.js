(function () {
  'use strict';

  angular.module('morningBriefingApp').component('natgeoDailyPhotoWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="natgeo-card" overflow-autopan>' +
      '  <a class="natgeo-card__link" ng-if="$ctrl.hasImage()" ng-href="{{$ctrl.widget.data.permalink}}" target="_blank" rel="noreferrer">' +
      '    <img class="natgeo-card__image" ng-src="{{$ctrl.widget.data.imageUrl}}" alt="{{$ctrl.widget.data.altText || $ctrl.widget.data.title}}" />' +
      '  </a>' +
      '  <div class="natgeo-card__empty" ng-if="!$ctrl.hasImage()">{{$ctrl.widget.data.emptyMessage}}</div>' +
      '  <a class="natgeo-card__title" ng-if="$ctrl.widget.data.permalink" ng-href="{{$ctrl.widget.data.permalink}}" target="_blank" rel="noreferrer">{{$ctrl.widget.data.title}}</a>' +
      '  <p class="natgeo-card__description" ng-if="$ctrl.widget.data.description">{{$ctrl.widget.data.description}}</p>' +
      '  <p class="natgeo-card__credit" ng-if="$ctrl.widget.data.credit">{{$ctrl.widget.data.credit}}</p>' +
      '</div>',
    controller: function NatgeoDailyPhotoWidgetController() {
      var $ctrl = this;

      $ctrl.hasImage = function hasImage() {
        return !!($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.imageUrl);
      };
    }
  });
})();
