(function () {
  'use strict';

  angular.module('morningBriefingApp').component('tasksWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="tasks-card">' +
      '  <div class="widget-config-selected mt-0" ng-if="$ctrl.widget.data.connectionLabel">Connection: <strong>{{$ctrl.widget.data.connectionLabel}}</strong></div>' +
      '  <p class="tasks-empty" ng-if="!$ctrl.hasItems()">{{$ctrl.widget.data.emptyMessage || "No tasks available."}}</p>' +
      '  <section class="task-group" ng-repeat="group in $ctrl.widget.data.groups track by group.label">' +
      '    <div ng-if="group.items.length">' +
      '      <div class="task-group__label">{{group.label}}</div>' +
      '      <div class="task-item" ng-repeat="task in group.items track by $index">' +
      '        <span class="task-item__bullet"><i class="fa-regular fa-square" aria-hidden="true"></i></span>' +
      '        <span>' +
      '          <span class="task-item__title">{{task.title}}</span>' +
      '          <span class="task-item__meta" ng-if="task.meta">{{task.meta}}</span>' +
      '        </span>' +
      '      </div>' +
      '    </div>' +
      '  </section>' +
      '</div>',
    controller: function TasksWidgetController() {
      var $ctrl = this;

      $ctrl.hasItems = function hasItems() {
        return !!(($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.groups || []).some(function (group) {
          return group.items && group.items.length;
        }));
      };
    }
  });
})();
