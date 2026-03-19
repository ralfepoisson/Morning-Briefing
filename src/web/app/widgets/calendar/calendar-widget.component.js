(function () {
  'use strict';

  angular.module('morningBriefingApp').component('calendarWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="calendar-card">' +
      '  <div class="calendar-date-label">{{$ctrl.widget.data.dateLabel}}</div>' +
      '  <div class="calendar-appointment" ng-repeat="appointment in $ctrl.widget.data.appointments track by $index">' +
      '    <div class="calendar-appointment__time">{{appointment.time}}</div>' +
      '    <div class="calendar-appointment__body">' +
      '      <strong>{{appointment.title}}</strong>' +
      '      <span>{{appointment.location}}</span>' +
      '    </div>' +
      '  </div>' +
      '</div>'
  });
})();
