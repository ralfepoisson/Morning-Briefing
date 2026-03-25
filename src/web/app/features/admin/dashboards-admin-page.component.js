(function () {
  'use strict';

  angular.module('morningBriefingApp').component('dashboardsAdminPage', {
    template:
      '<section class="dashboards-admin-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Dashboards</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Browse dashboards across the tenant, inspect their widget composition, and manually regenerate the latest audio briefing.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="message-broker-summary" ng-if="$ctrl.data">' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Dashboards</span>' +
      '      <strong>{{$ctrl.data.summary.total}}</strong>' +
      '      <span>Active dashboards in this tenant</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Ready audio</span>' +
      '      <strong>{{$ctrl.data.summary.readyAudio}}</strong>' +
      '      <span>Dashboards with a ready audio briefing</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Without audio</span>' +
      '      <strong>{{$ctrl.data.summary.withoutAudio}}</strong>' +
      '      <span>No generated briefing yet</span>' +
      '    </article>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.data">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">Inventory</div>' +
      '      <h2 class="connectors-panel-title">All dashboards</h2>' +
      '    </div>' +
      '    <div class="message-broker-table-wrap" ng-if="$ctrl.data.items.length">' +
      '      <table class="message-broker-table dashboards-admin-table">' +
      '        <thead>' +
      '          <tr>' +
      '            <th></th>' +
      '            <th>User</th>' +
      '            <th>Dashboard</th>' +
      '            <th>Widgets</th>' +
      '            <th>Audio briefing</th>' +
      '            <th>Actions</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody>' +
      '          <tr ng-repeat-start="dashboard in $ctrl.data.items track by dashboard.id">' +
      '            <td>' +
      '              <button type="button" class="btn btn-sm btn-outline-light dashboards-admin-table__toggle" ng-click="$ctrl.toggleExpanded(dashboard.id)" ng-attr-aria-expanded="{{$ctrl.isExpanded(dashboard.id)}}">' +
      '                <i class="fa-solid" ng-class="$ctrl.isExpanded(dashboard.id) ? \'fa-chevron-up\' : \'fa-chevron-down\'" aria-hidden="true"></i>' +
      '              </button>' +
      '            </td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{dashboard.owner.displayName || dashboard.owner.email}}</div>' +
      '              <div class="message-broker-table__secondary">{{dashboard.owner.email}}</div>' +
      '            </td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{dashboard.name}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="dashboard.description">{{dashboard.description}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="!dashboard.description">No description</div>' +
      '            </td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{dashboard.widgetCount}}</div>' +
      '              <div class="message-broker-table__secondary">{{dashboard.widgetCount === 1 ? "widget" : "widgets"}}</div>' +
      '            </td>' +
      '            <td>' +
      '              <span class="message-broker-status-pill" ng-class="$ctrl.getAudioStatusClass(dashboard)">{{$ctrl.getAudioStatusLabel(dashboard)}}</span>' +
      '              <div class="message-broker-table__secondary" ng-if="dashboard.audioBriefing && dashboard.audioBriefing.generatedAt">{{dashboard.audioBriefing.generatedAt | date:\'medium\'}}</div>' +
      '              <div class="message-broker-table__secondary dashboards-admin-table__error" ng-if="dashboard.audioBriefing && dashboard.audioBriefing.errorMessage">{{dashboard.audioBriefing.errorMessage}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="dashboard.audioBriefing && dashboard.audioBriefing.estimatedDurationSeconds">~{{$ctrl.formatDuration(dashboard.audioBriefing.estimatedDurationSeconds)}}</div>' +
      '            </td>' +
      '            <td>' +
      '              <button type="button" class="btn btn-sm btn-outline-light widgets-admin-table__action" ng-click="$ctrl.regenerateAudioBriefing(dashboard)" ng-disabled="$ctrl.isRegenerating(dashboard.id)">' +
      '                <i class="fa-solid" ng-class="$ctrl.isRegenerating(dashboard.id) ? \'fa-spinner fa-spin\' : \'fa-wave-square\'" aria-hidden="true"></i>' +
      '                <span>{{$ctrl.isRegenerating(dashboard.id) ? "Generating..." : "Regenerate audio"}}</span>' +
      '              </button>' +
      '            </td>' +
      '          </tr>' +
      '          <tr ng-repeat-end ng-if="$ctrl.isExpanded(dashboard.id)">' +
      '            <td colspan="6" class="dashboards-admin-table__details-cell">' +
      '              <div class="dashboards-admin-table__details">' +
      '                <div class="eyebrow">Widgets</div>' +
      '                <div class="dashboards-admin-table__widget-list" ng-if="dashboard.widgets.length">' +
      '                  <article class="dashboards-admin-table__widget-card" ng-repeat="widget in dashboard.widgets track by widget.id">' +
      '                    <div class="message-broker-table__primary">{{widget.title}}</div>' +
      '                    <div class="message-broker-table__secondary">{{widget.type}}<span ng-if="!widget.isVisible"> · hidden</span></div>' +
      '                    <div class="message-broker-table__secondary">Refresh mode: {{widget.refreshMode}}</div>' +
      '                  </article>' +
      '                </div>' +
      '                <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!dashboard.widgets.length">' +
      '                  <strong>No widgets</strong>' +
      '                  <span>This dashboard does not currently have any active widgets.</span>' +
      '                </div>' +
      '              </div>' +
      '            </td>' +
      '          </tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '    <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.data.items.length && !$ctrl.isLoading">' +
      '      <strong>No dashboards yet</strong>' +
      '      <span>Dashboards will appear here once users create them.</span>' +
      '    </div>' +
      '  </section>' +
      '</section>',
    controller: DashboardsAdminPageController
  });

  DashboardsAdminPageController.$inject = ['AdminDashboardService', 'NotificationService', 'CurrentUserService', '$location'];

  function DashboardsAdminPageController(AdminDashboardService, NotificationService, CurrentUserService, $location) {
    var $ctrl = this;

    $ctrl.data = null;
    $ctrl.isLoading = false;
    $ctrl.expandedById = {};
    $ctrl.regeneratingById = {};

    $ctrl.$onInit = function onInit() {
      ensureAdminAccess().then(function handleAccess(user) {
        if (user) {
          loadDashboards();
        }
      });
    };

    $ctrl.refresh = function refresh() {
      loadDashboards();
    };

    $ctrl.toggleExpanded = function toggleExpanded(dashboardId) {
      $ctrl.expandedById[dashboardId] = !$ctrl.expandedById[dashboardId];
    };

    $ctrl.isExpanded = function isExpanded(dashboardId) {
      return !!$ctrl.expandedById[dashboardId];
    };

    $ctrl.isRegenerating = function isRegenerating(dashboardId) {
      return !!$ctrl.regeneratingById[dashboardId];
    };

    $ctrl.regenerateAudioBriefing = function regenerateAudioBriefing(dashboard) {
      if (!dashboard || !dashboard.id || $ctrl.isRegenerating(dashboard.id)) {
        return;
      }

      $ctrl.regeneratingById[dashboard.id] = true;

      return AdminDashboardService.regenerateAudioBriefing(dashboard.id).then(function handleSuccess() {
        NotificationService.success('Audio briefing regeneration started for ' + dashboard.name + '.', 'Audio Briefing queued');
        return loadDashboards();
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Audio briefing regeneration is currently unavailable.'), 'Audio Briefing failed');
      }).finally(function clearPending() {
        delete $ctrl.regeneratingById[dashboard.id];
      });
    };

    $ctrl.getAudioStatusLabel = function getAudioStatusLabel(dashboard) {
      if (!dashboard || !dashboard.audioBriefing) {
        return 'Not generated';
      }

      if (dashboard.audioBriefing.status === 'READY') {
        return 'Ready';
      }

      if (dashboard.audioBriefing.status === 'FAILED') {
        return 'Failed';
      }

      if (dashboard.audioBriefing.status === 'GENERATING') {
        return 'Generating';
      }

      return 'Pending';
    };

    $ctrl.getAudioStatusClass = function getAudioStatusClass(dashboard) {
      if (!dashboard || !dashboard.audioBriefing) {
        return 'message-broker-status-pill--skipped';
      }

      if (dashboard.audioBriefing.status === 'READY') {
        return 'message-broker-status-pill--completed';
      }

      if (dashboard.audioBriefing.status === 'FAILED') {
        return 'message-broker-status-pill--failed';
      }

      return 'message-broker-status-pill--processing';
    };

    $ctrl.formatDuration = function formatDuration(seconds) {
      if (!seconds) {
        return '';
      }

      return Math.max(1, Math.round(seconds / 60)) + ' min';
    };

    function loadDashboards() {
      $ctrl.isLoading = true;

      return AdminDashboardService.list().then(function handleDashboardsLoaded(data) {
        var items = data && data.items ? data.items : [];

        $ctrl.data = {
          items: items,
          summary: {
            total: items.length,
            readyAudio: items.filter(function filterReady(item) {
              return item.audioBriefing && item.audioBriefing.status === 'READY';
            }).length,
            withoutAudio: items.filter(function filterMissing(item) {
              return !item.audioBriefing;
            }).length
          }
        };
      }).catch(function handleError(error) {
        $ctrl.data = null;
        NotificationService.error(getErrorMessage(error, 'Dashboards are currently unavailable.'), 'Unable to load dashboards');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    }

    function ensureAdminAccess() {
      return CurrentUserService.load().then(function handleCurrentUserLoaded(user) {
        if (user && user.isAdmin) {
          return user;
        }

        NotificationService.error('You need admin access to view that page.', 'Admin access required');
        $location.path('/');
        return null;
      }).catch(function handleAccessError(error) {
        NotificationService.error(getErrorMessage(error, 'We could not verify your access right now.'), 'Unable to verify access');
        $location.path('/');
        return null;
      });
    }
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && error.data.message) {
      return error.data.message;
    }

    return fallbackMessage;
  }
})();
