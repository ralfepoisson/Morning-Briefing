(function () {
  'use strict';

  angular.module('morningBriefingApp').component('tasksWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="tasks-card">' +
      '  <section class="task-group" ng-repeat="group in $ctrl.widget.data.groups track by group.label">' +
      '    <div class="task-group__label">{{group.label}}</div>' +
      '    <div class="task-item" ng-repeat="task in group.items track by $index">' +
      '      <span class="task-item__bullet"><i class="fa-regular fa-square" aria-hidden="true"></i></span>' +
      '      <span class="task-item__title">{{task.title}}</span>' +
      '    </div>' +
      '  </section>' +
      '</div>'
  });
})();
