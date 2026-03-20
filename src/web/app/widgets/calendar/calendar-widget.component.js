(function () {
  'use strict';

  angular.module('morningBriefingApp').component('calendarWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="calendar-card">' +
      '  <div class="widget-config-selected mt-0" ng-if="$ctrl.widget.data.connectionLabel">Connection: <strong>{{$ctrl.widget.data.connectionLabel}}</strong></div>' +
      '  <div class="calendar-date-label">{{$ctrl.widget.data.dateLabel}}</div>' +
      '  <p class="tasks-empty" ng-if="!$ctrl.hasAppointments()">{{$ctrl.widget.data.emptyMessage || "No appointments scheduled."}}</p>' +
      '  <div class="calendar-appointment" ng-repeat="appointment in $ctrl.widget.data.appointments track by $index">' +
      '    <div class="calendar-appointment__time">{{appointment.time}}</div>' +
      '    <div class="calendar-appointment__body">' +
      '      <strong>{{appointment.title}}</strong>' +
      '      <span ng-if="appointment.location">{{appointment.location}}</span>' +
      '    </div>' +
      '  </div>' +
      '</div>',
    controller: function CalendarWidgetController() {
      var $ctrl = this;

      $ctrl.hasAppointments = function hasAppointments() {
        return !!(($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.appointments || []).length);
      };
    }
  });
})();
