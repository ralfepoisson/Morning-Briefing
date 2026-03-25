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
      '      <div class="dashboard-menu" ng-if="$ctrl.isAuthenticated()" ng-class="{\'dashboard-menu--open\': $ctrl.isDashboardMenuOpen}">' +
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
      '      <a class="nav-link" ng-if="$ctrl.isAuthenticated()" ng-class="{active: $ctrl.isActiveRoute(\'/connectors\')}" href="#/connectors">Connectors</a>' +
      '      <a class="nav-link" ng-if="$ctrl.isAuthenticated()" ng-class="{active: $ctrl.isActiveRoute(\'/rss-feeds\')}" href="#/rss-feeds">RSS Feeds</a>' +
      '      <div class="dashboard-menu dashboard-menu--compact" ng-if="$ctrl.canAccessAdmin()" ng-class="{\'dashboard-menu--open\': $ctrl.isAdminMenuOpen}">' +
      '        <button class="dashboard-menu__trigger dashboard-menu__trigger--compact" type="button" ng-click="$ctrl.toggleAdminMenu()" aria-haspopup="true" aria-expanded="{{$ctrl.isAdminMenuOpen}}">' +
      '          <span class="dashboard-menu__label">Admin</span>' +
      '          <i class="fa-solid" ng-class="$ctrl.isAdminMenuOpen ? \'fa-chevron-up\' : \'fa-chevron-down\'" aria-hidden="true"></i>' +
      '        </button>' +
      '        <div class="dashboard-menu__panel dashboard-menu__panel--compact" ng-if="$ctrl.isAdminMenuOpen">' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/dashboards\')}" href="#/admin/dashboards" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Dashboards</span>' +
      '            <span class="dashboard-menu__item-copy">Owners, widgets, and audio briefing regeneration</span>' +
      '          </a>' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/connectors\')}" href="#/admin/connectors" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Connectors</span>' +
      '            <span class="dashboard-menu__item-copy">Owner, safe config, and widget usage</span>' +
      '          </a>' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/users\')}" href="#/admin/users" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Users</span>' +
      '            <span class="dashboard-menu__item-copy">Grant or remove admin access</span>' +
      '          </a>' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/widgets\')}" href="#/admin/widgets" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Widgets</span>' +
      '            <span class="dashboard-menu__item-copy">Snapshot status and manual regeneration</span>' +
      '          </a>' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/logs\')}" href="#/admin/logs" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Logs</span>' +
      '            <span class="dashboard-menu__item-copy">Search recent backend events and filter by level</span>' +
      '          </a>' +
      '          <a class="dashboard-menu__item dashboard-menu__item--link" ng-class="{\'dashboard-menu__item--active\': $ctrl.isActiveRoute(\'/admin/message-broker\')}" href="#/admin/message-broker" ng-click="$ctrl.closeAdminMenu()">' +
      '            <span class="dashboard-menu__item-title">Message Broker</span>' +
      '            <span class="dashboard-menu__item-copy">Queue depth, recent jobs, and throughput</span>' +
      '          </a>' +
      '        </div>' +
      '      </div>' +
      '      <div class="theme-toggle theme-toggle--nav" role="group" aria-label="Theme switcher">' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'light\'}" ng-click="$ctrl.setTheme(\'light\')">Light</button>' +
      '        <button type="button" class="theme-toggle__button" ng-class="{active: $ctrl.ui.theme === \'dark\'}" ng-click="$ctrl.setTheme(\'dark\')">Dark</button>' +
      '      </div>' +
      '      <div class="top-nav-session" ng-if="$ctrl.auth.session">' +
      '        <span class="top-nav-session__label">{{$ctrl.auth.session.displayName}}</span>' +
      '        <button type="button" class="btn btn-sm btn-outline-secondary" ng-click="$ctrl.signOut()">Sign out</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</nav>',
    controller: TopNavController
  });

  TopNavController.$inject = ['UiShellService', 'DashboardService', '$document', '$scope', '$location', 'AuthService', 'CurrentUserService'];

  function TopNavController(UiShellService, DashboardService, $document, $scope, $location, AuthService, CurrentUserService) {
    var $ctrl = this;

    $ctrl.ui = UiShellService.state;
    $ctrl.dashboards = DashboardService.list();
    $ctrl.isDashboardMenuOpen = false;
    $ctrl.isAdminMenuOpen = false;
    $ctrl.auth = {
      session: null
    };

    $ctrl.$onInit = function onInit() {
      applyTheme($ctrl.ui.theme);
      refreshAuthState();
      if (AuthService.isAuthenticated()) {
        DashboardService.load();
        loadCurrentUser(false);
      }
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
      $ctrl.isAdminMenuOpen = false;
      $ctrl.isDashboardMenuOpen = !$ctrl.isDashboardMenuOpen;
    };

    $ctrl.toggleAdminMenu = function toggleAdminMenu() {
      $ctrl.isDashboardMenuOpen = false;
      $ctrl.isAdminMenuOpen = !$ctrl.isAdminMenuOpen;
    };

    $ctrl.closeAdminMenu = function closeAdminMenu() {
      $ctrl.isAdminMenuOpen = false;
    };

    $ctrl.selectDashboard = function selectDashboard(dashboardId) {
      DashboardService.setActive(dashboardId);
      $ctrl.isDashboardMenuOpen = false;
      $ctrl.isAdminMenuOpen = false;
      $location.path('/');
    };

    $ctrl.openCreateDashboard = function openCreateDashboard() {
      $ctrl.isDashboardMenuOpen = false;
      $ctrl.isAdminMenuOpen = false;
      $location.path('/');
      UiShellService.openDashboardModal('create');
    };

    $ctrl.isActiveRoute = function isActiveRoute(path) {
      return $location.path() === path;
    };

    $ctrl.isAuthenticated = function isAuthenticated() {
      return AuthService.isAuthenticated();
    };

    $ctrl.canAccessAdmin = function canAccessAdmin() {
      return AuthService.isAuthenticated() && CurrentUserService.isAdmin();
    };

    $ctrl.signOut = function signOut() {
      $ctrl.isDashboardMenuOpen = false;
      $ctrl.isAdminMenuOpen = false;
      AuthService.signOut();
      refreshAuthState();
    };

    function applyTheme(theme) {
      $document[0].body.classList.remove('theme-dark', 'theme-light');
      $document[0].body.classList.add('theme-' + theme);
    }

    function bindWatchers() {
      $scope.$watch(
        function watchAuthSession() {
          return AuthService.getSession();
        },
        function handleAuthSessionChange(session) {
          $ctrl.auth.session = session;

          if (session) {
            DashboardService.load();
            loadCurrentUser(true);
          } else {
            CurrentUserService.clear();
          }
        },
        true
      );

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
          $scope.$evalAsync(function closeMenus() {
            $ctrl.isDashboardMenuOpen = false;
            $ctrl.isAdminMenuOpen = false;
          });
        }
      }

      $document.on('click', handleDocumentClick);
      $ctrl.removeDocumentHandler = function removeDocumentHandler() {
        $document.off('click', handleDocumentClick);
      };
    }

    function refreshAuthState() {
      $ctrl.auth.session = AuthService.getSession();
    }

    function loadCurrentUser(force) {
      CurrentUserService.load(force).catch(function ignoreCurrentUserError() {});
    }
  }
})();
