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
      '      <div class="dashboard-menu" ng-class="{\'dashboard-menu--open\': $ctrl.isDashboardMenuOpen}">' +
      '        <button class="dashboard-menu__trigger" type="button" ng-click="$ctrl.toggleDashboardMenu()" aria-haspopup="true" aria-expanded="{{$ctrl.isDashboardMenuOpen}}">' +
      '          <span class="dashboard-menu__eyebrow">Dashboards</span>' +
      '          <span class="dashboard-menu__label">{{$ctrl.getActiveDashboardName()}}</span>' +
      '          <i class="fa-solid" ng-class="$ctrl.isDashboardMenuOpen ? \'fa-chevron-up\' : \'fa-chevron-down\'" aria-hidden="true"></i>' +
      '        </button>' +
      '        <div class="dashboard-menu__panel" ng-if="$ctrl.isDashboardMenuOpen">' +
      '          <button type="button" class="dashboard-menu__item" ng-repeat="dashboard in $ctrl.dashboards track by dashboard.id" ng-class="{\'dashboard-menu__item--active\': dashboard.id === $ctrl.getActiveDashboardId()}" ng-click="$ctrl.selectDashboard(dashboard.id)">' +
      '            <span class="dashboard-menu__item-title">{{dashboard.name}}</span>' +
      '            <span class="dashboard-menu__item-copy" ng-if="dashboard.description">{{dashboard.description}}</span>' +
      '          </button>' +
      '          <button type="button" class="dashboard-menu__create" ng-click="$ctrl.openCreateDashboard()">' +
      '            <i class="fa-solid fa-plus" aria-hidden="true"></i>' +
      '            <span>Create dashboard</span>' +
      '          </button>' +
      '        </div>' +
      '      </div>' +
      '      <a class="nav-link" href="" ng-click="$ctrl.prevent($event)">Connectors</a>' +
      '      <div class="theme-toggle theme-toggle--nav" role="group" aria-label="Theme switcher">' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'light\'}" ng-click="$ctrl.setTheme(\'light\')">Light</button>' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'dark\'}" ng-click="$ctrl.setTheme(\'dark\')">Dark</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</nav>',
    controller: TopNavController
  });

  TopNavController.$inject = ['UiShellService', 'DashboardService', '$document', '$scope'];

  function TopNavController(UiShellService, DashboardService, $document, $scope) {
    var $ctrl = this;

    $ctrl.ui = UiShellService.state;
    $ctrl.dashboards = DashboardService.list();
    $ctrl.isDashboardMenuOpen = false;

    $ctrl.$onInit = function onInit() {
      applyTheme($ctrl.ui.theme);
      DashboardService.load();
      bindWatchers();
      bindDocumentHandler();
    };

    $ctrl.$onDestroy = function onDestroy() {
      if ($ctrl.removeDocumentHandler) {
        $ctrl.removeDocumentHandler();
      }
    };

    $ctrl.setTheme = function setTheme(theme) {
      UiShellService.setTheme(theme);
      applyTheme(theme);
    };

    $ctrl.getActiveDashboardId = function getActiveDashboardId() {
      return DashboardService.getActiveId();
    };

    $ctrl.getActiveDashboardName = function getActiveDashboardName() {
      var activeDashboard = DashboardService.getActive();

      return activeDashboard ? activeDashboard.name : 'Select dashboard';
    };

    $ctrl.toggleDashboardMenu = function toggleDashboardMenu() {
      $ctrl.isDashboardMenuOpen = !$ctrl.isDashboardMenuOpen;
    };

    $ctrl.selectDashboard = function selectDashboard(dashboardId) {
      DashboardService.setActive(dashboardId);
      $ctrl.isDashboardMenuOpen = false;
    };

    $ctrl.openCreateDashboard = function openCreateDashboard() {
      $ctrl.isDashboardMenuOpen = false;
      UiShellService.openDashboardModal('create');
    };

    $ctrl.prevent = function prevent(event) {
      event.preventDefault();
    };

    function applyTheme(theme) {
      $document[0].body.classList.remove('theme-dark', 'theme-light');
      $document[0].body.classList.add('theme-' + theme);
    }

    function bindWatchers() {
      $scope.$watch(
        function watchActiveDashboard() {
          return DashboardService.getActiveId();
        },
        function handleActiveDashboardChange() {
          $ctrl.dashboards = DashboardService.list();
        }
      );
    }

    function bindDocumentHandler() {
      function handleDocumentClick(event) {
        if (!event.target.closest('.dashboard-menu')) {
          $scope.$evalAsync(function closeDashboardMenu() {
            $ctrl.isDashboardMenuOpen = false;
          });
        }
      }

      $document.on('click', handleDocumentClick);
      $ctrl.removeDocumentHandler = function removeDocumentHandler() {
        $document.off('click', handleDocumentClick);
      };
    }
  }
})();
