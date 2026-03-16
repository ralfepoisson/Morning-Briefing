(function () {
  'use strict';

  angular.module('morningBriefingApp').component('mbTopNav', {
    template:
      '<nav class="top-nav navbar navbar-expand-lg">' +
      '  <div class="container-fluid">' +
      '    <a class="navbar-brand d-flex align-items-center gap-3" href="#/">' +
      '      <img class="brand-logo" ng-src="{{$ctrl.ui.theme === \'light\' ? \'./assets/img/logo-light.png\' : \'./assets/img/logo-dark.png\'}}" alt="Morning Briefing logo" />' +
      '    </a>' +
      '    <div class="top-nav-links d-flex align-items-center gap-2 ms-auto">' +
      '      <a class="nav-link active" href="#/">Dashboards</a>' +
      '      <a class="nav-link" href="" ng-click="$ctrl.prevent($event)">Widgets</a>' +
      '      <a class="nav-link" href="" ng-click="$ctrl.prevent($event)">Snapshots</a>' +
      '      <a class="nav-link" href="" ng-click="$ctrl.prevent($event)">Connectors</a>' +
      '      <div class="theme-toggle theme-toggle--nav" role="group" aria-label="Theme switcher">' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'light\'}" ng-click="$ctrl.setTheme(\'light\')">Light</button>' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'dark\'}" ng-click="$ctrl.setTheme(\'dark\')">Dark</button>' +
      '      </div>' +
      '      <button class="btn btn-sm btn-primary" type="button" ng-click="$ctrl.openCreateDashboard()">+ Dashboard</button>' +
      '    </div>' +
      '  </div>' +
      '</nav>',
    controller: TopNavController
  });

  TopNavController.$inject = ['UiShellService', '$document'];

  function TopNavController(UiShellService, $document) {
    var $ctrl = this;

    $ctrl.ui = UiShellService.state;

    $ctrl.$onInit = function onInit() {
      applyTheme($ctrl.ui.theme);
    };

    $ctrl.setTheme = function setTheme(theme) {
      UiShellService.setTheme(theme);
      applyTheme(theme);
    };

    $ctrl.openCreateDashboard = function openCreateDashboard() {
      UiShellService.openDashboardModal('create');
    };

    $ctrl.prevent = function prevent(event) {
      event.preventDefault();
    };

    function applyTheme(theme) {
      $document[0].body.classList.remove('theme-dark', 'theme-light');
      $document[0].body.classList.add('theme-' + theme);
    }
  }
})();
