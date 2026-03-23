(function () {
  'use strict';

  angular.module('morningBriefingApp').component('widgetsPage', {
    template:
      '<section class="widgets-admin-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Widgets</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Review every widget, see its latest snapshot result, and manually queue a fresh snapshot when needed.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="message-broker-summary" ng-if="$ctrl.data">' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Total widgets</span>' +
      '      <strong>{{$ctrl.data.summary.total}}</strong>' +
      '      <span>Visible and hidden widgets combined</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Failing widgets</span>' +
      '      <strong>{{$ctrl.data.summary.failing}}</strong>' +
      '      <span>Latest snapshot is currently failed</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Without snapshots</span>' +
      '      <strong>{{$ctrl.data.summary.missingSnapshot}}</strong>' +
      '      <span>No snapshot has been generated yet</span>' +
      '    </article>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.data">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">Inventory</div>' +
      '      <h2 class="connectors-panel-title">All widgets</h2>' +
      '    </div>' +
      '    <div class="message-broker-table-wrap" ng-if="$ctrl.data.items.length">' +
      '      <table class="message-broker-table widgets-admin-table">' +
      '        <thead>' +
      '          <tr>' +
      '            <th>Widget</th>' +
      '            <th>Dashboard</th>' +
      '            <th>Latest snapshot</th>' +
      '            <th>Status</th>' +
      '            <th>Duplicates</th>' +
      '            <th>Actions</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody>' +
      '          <tr ng-repeat="widget in $ctrl.data.items track by widget.id">' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{widget.title}}</div>' +
      '              <div class="message-broker-table__secondary">{{widget.type}}<span ng-if="!widget.isVisible"> · hidden</span></div>' +
      '            </td>' +
      '            <td>{{widget.dashboardName}}</td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary" ng-if="widget.latestSnapshotAt">{{widget.latestSnapshotAt | date:\'medium\'}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="widget.latestSnapshotDate">Snapshot date {{widget.latestSnapshotDate}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="!widget.latestSnapshotAt">Never generated</div>' +
      '            </td>' +
      '            <td>' +
      '              <span class="message-broker-status-pill" ng-class="$ctrl.getStatusClass(widget)">{{$ctrl.getStatusLabel(widget)}}</span>' +
      '              <div class="message-broker-table__secondary widgets-admin-table__error" ng-if="widget.latestErrorMessage">{{widget.latestErrorMessage}}</div>' +
      '            </td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{widget.duplicateSkipCount || 0}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="widget.latestDuplicateAt">Last skipped {{widget.latestDuplicateAt | date:\'medium\'}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="!widget.latestDuplicateAt">No duplicate skips recorded</div>' +
      '            </td>' +
      '            <td>' +
      '              <div class="widgets-admin-table__actions">' +
      '                <button type="button" class="btn btn-sm btn-outline-light widgets-admin-table__action" ng-click="$ctrl.openSnapshotModal(widget)" ng-disabled="!$ctrl.hasSnapshotContent(widget)">' +
      '                  <i class="fa-solid fa-eye" aria-hidden="true"></i>' +
      '                  <span>View JSON</span>' +
      '                </button>' +
      '                <button type="button" class="btn btn-sm btn-outline-light widgets-admin-table__action" ng-click="$ctrl.regenerate(widget)" ng-disabled="$ctrl.isRegenerating(widget.id)">' +
      '                  <i class="fa-solid" ng-class="$ctrl.isRegenerating(widget.id) ? \'fa-spinner fa-spin\' : \'fa-arrows-rotate\'" aria-hidden="true"></i>' +
      '                  <span>{{$ctrl.isRegenerating(widget.id) ? "Queueing..." : "Regenerate"}}</span>' +
      '                </button>' +
      '              </div>' +
      '            </td>' +
      '          </tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '    <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.data.items.length && !$ctrl.isLoading">' +
      '      <strong>No widgets yet</strong>' +
      '      <span>Create a widget on one of your dashboards and it will appear here.</span>' +
      '    </div>' +
      '  </section>' +
      '  <div class="modal-shell" ng-if="$ctrl.snapshotModal.isOpen" ng-click="$ctrl.closeSnapshotModal()">' +
      '    <div class="modal-card widgets-snapshot-modal" role="dialog" aria-modal="true" ng-click="$event.stopPropagation()">' +
      '      <div class="eyebrow">Latest Snapshot</div>' +
      '      <h2 class="modal-title">{{$ctrl.snapshotModal.title}}</h2>' +
      '      <p class="modal-copy" ng-if="$ctrl.snapshotModal.timestamp">Generated {{$ctrl.snapshotModal.timestamp | date:\'medium\'}}</p>' +
      '      <pre class="widgets-snapshot-modal__json">{{$ctrl.snapshotModal.formattedJson}}</pre>' +
      '      <div class="modal-actions">' +
      '        <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeSnapshotModal()">Close</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</section>',
    controller: WidgetsPageController
  });

  WidgetsPageController.$inject = ['AdminWidgetService', 'NotificationService', 'CurrentUserService', '$location'];

  function WidgetsPageController(AdminWidgetService, NotificationService, CurrentUserService, $location) {
    var $ctrl = this;

    $ctrl.data = null;
    $ctrl.isLoading = false;
    $ctrl.regeneratingById = {};
    $ctrl.snapshotModal = buildSnapshotModalState();

    $ctrl.$onInit = function onInit() {
      ensureAdminAccess().then(function handleAccess(user) {
        if (user) {
          loadWidgets();
        }
      });
    };

    $ctrl.refresh = function refresh() {
      loadWidgets();
    };

    $ctrl.regenerate = function regenerate(widget) {
      if (!widget || !widget.id || $ctrl.isRegenerating(widget.id)) {
        return;
      }

      $ctrl.regeneratingById[widget.id] = true;

      return AdminWidgetService.regenerateSnapshot(widget.id).then(function handleQueued() {
        NotificationService.success('Snapshot regeneration was queued for ' + widget.title + '.', 'Snapshot queued');
        return loadWidgets();
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Widget snapshot regeneration is currently unavailable.'), 'Snapshot failed');
      }).finally(function clearPending() {
        delete $ctrl.regeneratingById[widget.id];
      });
    };

    $ctrl.isRegenerating = function isRegenerating(widgetId) {
      return !!$ctrl.regeneratingById[widgetId];
    };

    $ctrl.hasSnapshotContent = function hasSnapshotContent(widget) {
      return !!(widget && widget.latestSnapshotContent !== null && widget.latestSnapshotContent !== undefined);
    };

    $ctrl.openSnapshotModal = function openSnapshotModal(widget) {
      if (!$ctrl.hasSnapshotContent(widget)) {
        return;
      }

      $ctrl.snapshotModal = {
        isOpen: true,
        title: widget.title + ' JSON',
        timestamp: widget.latestSnapshotAt,
        formattedJson: JSON.stringify(widget.latestSnapshotContent, null, 2)
      };
    };

    $ctrl.closeSnapshotModal = function closeSnapshotModal() {
      $ctrl.snapshotModal = buildSnapshotModalState();
    };

    $ctrl.getStatusLabel = function getStatusLabel(widget) {
      if (!widget.latestSnapshotStatus) {
        return 'No snapshot';
      }

      if (widget.latestSnapshotStatus === 'FAILED') {
        return 'Failing';
      }

      if (widget.latestSnapshotStatus === 'READY') {
        return 'Healthy';
      }

      return widget.latestSnapshotStatus;
    };

    $ctrl.getStatusClass = function getStatusClass(widget) {
      if (!widget.latestSnapshotStatus) {
        return 'message-broker-status-pill--skipped';
      }

      if (widget.latestSnapshotStatus === 'FAILED') {
        return 'message-broker-status-pill--failed';
      }

      if (widget.latestSnapshotStatus === 'READY') {
        return 'message-broker-status-pill--completed';
      }

      return 'message-broker-status-pill--processing';
    };

    function loadWidgets() {
      $ctrl.isLoading = true;

      return AdminWidgetService.list().then(function handleWidgetsLoaded(data) {
        var items = data && data.items ? data.items : [];

        $ctrl.data = {
          items: items,
          summary: {
            total: items.length,
            failing: items.filter(function filterFailing(item) {
              return item.isFailing;
            }).length,
            missingSnapshot: items.filter(function filterMissing(item) {
              return !item.latestSnapshotAt;
            }).length
          }
        };
      }).catch(function handleError(error) {
        $ctrl.data = null;
        NotificationService.error(getErrorMessage(error, 'Widgets are currently unavailable.'), 'Unable to load widgets');
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

  function buildSnapshotModalState() {
    return {
      isOpen: false,
      title: '',
      timestamp: null,
      formattedJson: ''
    };
  }
})();
