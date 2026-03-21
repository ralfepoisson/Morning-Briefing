(function () {
  'use strict';

  angular.module('morningBriefingApp').component('weatherWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="weather-temperature">{{$ctrl.widget.data.temperature}}</div>' +
      '<div class="weather-condition">{{$ctrl.widget.data.condition}}</div>' +
      '<div class="weather-location">{{$ctrl.widget.data.location}}</div>' +
      '<div class="weather-high-low">{{$ctrl.widget.data.highLow}}</div>' +
      '<p class="weather-summary">{{$ctrl.widget.data.summary}}</p>' +
      '<div class="weather-stats">' +
      '  <div class="weather-stat" ng-repeat="item in $ctrl.widget.data.details track by item.label">' +
      '    <span>{{item.label}}</span>' +
      '    <strong>{{item.value}}</strong>' +
      '  </div>' +
      '</div>'
  });
})();
