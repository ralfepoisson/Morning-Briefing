(function () {
  'use strict';

  angular.module('morningBriefingApp').component('connectorsAdminPage', {
    template:
      '<section class="connectors-page">' +
      '  <div class="connectors-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Connector Inventory</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Inspect connectors safely, see who owns them, and review which widgets depend on them.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="connectors-layout" ng-if="$ctrl.ready">' +
      '    <aside class="connectors-list-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Inventory</div>' +
      '        <h2 class="connectors-panel-title">Tenant connectors</h2>' +
      '      </div>' +
      '      <p class="connectors-panel-copy" ng-if="$ctrl.isLoading">Loading connectors...</p>' +
      '      <div class="connectors-empty-state" ng-if="!$ctrl.isLoading && !$ctrl.connections.length">' +
      '        <strong>No connectors found</strong>' +
      '        <span>This tenant does not currently have any saved connectors.</span>' +
      '      </div>' +
      '      <button type="button" class="connector-list-item" ng-repeat="connection in $ctrl.connections track by connection.id" ng-class="{\'connector-list-item--active\': $ctrl.isSelected(connection)}" ng-click="$ctrl.selectConnection(connection)">' +
      '        <div class="connector-list-item__header">' +
      '          <strong>{{connection.name}}</strong>' +
      '          <span class="connector-status-badge" ng-class="$ctrl.getStatusBadgeClass(connection.status)">{{connection.status}}</span>' +
      '        </div>' +
      '        <span class="connector-list-item__meta">{{connection.type | uppercase}} · {{connection.authType.replace(\'_\', \' \')}}</span>' +
      '        <span class="connector-list-item__meta">{{connection.owner ? connection.owner.displayName : "Owner not recorded"}} · {{connection.widgets.length}} widget{{$ctrl.pluralize(connection.widgets.length)}}</span>' +
      '      </button>' +
      '    </aside>' +
      '    <section class="connectors-detail-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Details</div>' +
      '        <h2 class="connectors-panel-title">{{$ctrl.selectedConnection ? $ctrl.selectedConnection.name : "Select a connector"}}</h2>' +
      '      </div>' +
      '      <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.selectedConnection && !$ctrl.isLoading">' +
      '        <strong>Pick a connector to inspect</strong>' +
      '        <span>Owner, widget usage, and safe configuration details will appear here.</span>' +
      '      </div>' +
      '      <form ng-if="$ctrl.selectedConnection" ng-submit="$ctrl.save()" novalidate>' +
      '        <div class="connector-detail-grid">' +
      '          <div class="connector-detail-card">' +
      '            <span class="connector-detail-card__label">Provider</span>' +
      '            <strong>{{$ctrl.selectedConnection.type | uppercase}}</strong>' +
      '          </div>' +
      '          <div class="connector-detail-card">' +
      '            <span class="connector-detail-card__label">Authentication</span>' +
      '            <strong>{{$ctrl.selectedConnection.authType.replace(\'_\', \' \')}}</strong>' +
      '          </div>' +
      '          <div class="connector-detail-card">' +
      '            <span class="connector-detail-card__label">Owner</span>' +
      '            <strong ng-if="$ctrl.selectedConnection.owner">{{$ctrl.selectedConnection.owner.displayName}}</strong>' +
      '            <strong ng-if="!$ctrl.selectedConnection.owner">Not recorded</strong>' +
      '            <span ng-if="$ctrl.selectedConnection.owner">{{$ctrl.selectedConnection.owner.email}}</span>' +
      '          </div>' +
      '          <div class="connector-detail-card">' +
      '            <span class="connector-detail-card__label">Usage</span>' +
      '            <strong>{{$ctrl.selectedConnection.widgets.length}} widget{{$ctrl.pluralize($ctrl.selectedConnection.widgets.length)}}</strong>' +
      '            <span>Created {{$ctrl.formatDate($ctrl.selectedConnection.createdAt)}}</span>' +
      '          </div>' +
      '        </div>' +
      '        <label class="form-label mt-4" for="adminConnectorName">Connector name</label>' +
      '        <input id="adminConnectorName" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.name" placeholder="Connection name" required />' +
      '        <label class="form-label mt-3" for="adminConnectorApiKey" ng-if="$ctrl.selectedConnection.type === \'todoist\'">API Key</label>' +
      '        <input id="adminConnectorApiKey" class="form-control form-control-lg" type="password" ng-if="$ctrl.selectedConnection.type === \'todoist\'" ng-model="$ctrl.form.apiKey" placeholder="Leave blank to keep the current API key" />' +
      '        <label class="form-label mt-3" for="adminOpenAiApiKey" ng-if="$ctrl.selectedConnection.type === \'openai\'">API Key</label>' +
      '        <input id="adminOpenAiApiKey" class="form-control form-control-lg" type="password" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.apiKey" placeholder="Leave blank to keep the current API key" />' +
      '        <label class="form-label mt-3" for="adminOpenAiModel" ng-if="$ctrl.selectedConnection.type === \'openai\'">Model</label>' +
      '        <input id="adminOpenAiModel" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.model" placeholder="gpt-5-mini" />' +
      '        <label class="form-label mt-3" for="adminOpenAiBaseUrl" ng-if="$ctrl.selectedConnection.type === \'openai\'">Base URL</label>' +
      '        <input id="adminOpenAiBaseUrl" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.baseUrl" placeholder="https://api.openai.com" />' +
      '        <label class="form-label mt-3" for="adminCalendarId" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'">Google Calendar ID</label>' +
      '        <input id="adminCalendarId" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'" ng-model="$ctrl.form.calendarId" placeholder="team@example.com" />' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'gmail\'">This connection uses OAuth. Reconnect the Google account here if Gmail access needs to be refreshed.</p>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'gmail\' && $ctrl.selectedConnection.config && $ctrl.selectedConnection.config.accountEmail">Connected account: <strong>{{$ctrl.selectedConnection.config.accountEmail}}</strong></p>' +
      '        <div class="message-broker-panel mt-4">' +
      '          <div class="connectors-panel-header">' +
      '            <div class="eyebrow">Widget Usage</div>' +
      '            <h3 class="connectors-panel-title">Attached widgets</h3>' +
      '          </div>' +
      '          <div class="message-broker-table-wrap" ng-if="$ctrl.selectedConnection.widgets.length">' +
      '            <table class="message-broker-table widgets-admin-table">' +
      '              <thead>' +
      '                <tr>' +
      '                  <th>Widget</th>' +
      '                  <th>Dashboard</th>' +
      '                  <th>Dashboard owner</th>' +
      '                  <th>Role</th>' +
      '                </tr>' +
      '              </thead>' +
      '              <tbody>' +
      '                <tr ng-repeat="usage in $ctrl.selectedConnection.widgets track by usage.widgetId + \'-\' + usage.usageRole">' +
      '                  <td>' +
      '                    <div class="message-broker-table__primary">{{usage.widgetTitle}}</div>' +
      '                    <div class="message-broker-table__secondary">{{usage.widgetType}}<span ng-if="!usage.isVisible"> · hidden</span></div>' +
      '                  </td>' +
      '                  <td>{{usage.dashboardName}}</td>' +
      '                  <td>{{usage.dashboardOwner.displayName}}<div class="message-broker-table__secondary">{{usage.dashboardOwner.email}}</div></td>' +
      '                  <td>{{usage.usageRole}}</td>' +
      '                </tr>' +
      '              </tbody>' +
      '            </table>' +
      '          </div>' +
      '          <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.selectedConnection.widgets.length">' +
      '            <strong>Not used by any widgets</strong>' +
      '            <span>This connector is saved, but no active widgets currently reference it.</span>' +
      '          </div>' +
      '        </div>' +
      '        <div class="modal-actions modal-actions--page">' +
      '          <button type="button" class="btn btn-outline-light" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'" ng-click="$ctrl.reconnectGoogleCalendar()" ng-disabled="$ctrl.isSaving">Reconnect Google</button>' +
      '          <button type="button" class="btn btn-outline-light" ng-if="$ctrl.selectedConnection.type === \'gmail\'" ng-click="$ctrl.reconnectGmail()" ng-disabled="$ctrl.isSaving">Reconnect Google</button>' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.resetForm()" ng-disabled="$ctrl.isSaving">Reset</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.isSaving || !$ctrl.form.name">Save changes</button>' +
      '        </div>' +
      '      </form>' +
      '    </section>' +
      '  </div>' +
      '</section>',
    controller: ConnectorsAdminPageController
  });

  ConnectorsAdminPageController.$inject = ['AdminConnectorService', 'ConnectionService', 'CurrentUserService', 'NotificationService', '$location', '$window'];

  function ConnectorsAdminPageController(AdminConnectorService, ConnectionService, CurrentUserService, NotificationService, $location, $window) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isLoading = false;
    $ctrl.isSaving = false;
    $ctrl.connections = [];
    $ctrl.selectedConnection = null;
    $ctrl.form = buildEmptyForm();

    $ctrl.$onInit = function onInit() {
      ensureAdminAccess().then(function handleAccess(user) {
        if (user) {
          loadConnections().finally(function markReady() {
            $ctrl.ready = true;
          });
        } else {
          $ctrl.ready = true;
        }
      });
    };

    $ctrl.refresh = function refresh() {
      loadConnections();
    };

    $ctrl.selectConnection = function selectConnection(connection) {
      $ctrl.selectedConnection = connection;
      $ctrl.form = buildForm(connection);
    };

    $ctrl.isSelected = function isSelected(connection) {
      return !!($ctrl.selectedConnection && connection && $ctrl.selectedConnection.id === connection.id);
    };

    $ctrl.resetForm = function resetForm() {
      if (!$ctrl.selectedConnection) {
        return;
      }

      $ctrl.form = buildForm($ctrl.selectedConnection);
    };

    $ctrl.reconnectGoogleCalendar = function reconnectGoogleCalendar() {
      if (!$ctrl.selectedConnection || $ctrl.selectedConnection.type !== 'google-calendar') {
        return;
      }

      ConnectionService.startGoogleCalendarOAuth($window.location.href, $ctrl.selectedConnection.id).catch(function handleReconnectError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to start Google Calendar reconnection right now.'), 'Unable to reconnect Google Calendar');
      });
    };

    $ctrl.reconnectGmail = function reconnectGmail() {
      if (!$ctrl.selectedConnection || $ctrl.selectedConnection.type !== 'gmail') {
        return;
      }

      ConnectionService.startGmailOAuth($window.location.href, $ctrl.selectedConnection.id).catch(function handleReconnectError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to start Gmail reconnection right now.'), 'Unable to reconnect Gmail');
      });
    };

    $ctrl.save = function save() {
      if (!$ctrl.selectedConnection || !$ctrl.form.name) {
        return;
      }

      $ctrl.isSaving = true;

      ConnectionService.update($ctrl.selectedConnection.id, {
        name: $ctrl.form.name,
        credentials: buildCredentialsPayload($ctrl.form)
      }).then(function handleSaved() {
        NotificationService.success('Connector details saved.', 'Connector updated');
        return loadConnections($ctrl.selectedConnection.id);
      }).catch(function handleSaveError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to save connector changes right now.'), 'Unable to save connector');
      }).finally(function clearSaving() {
        $ctrl.isSaving = false;
      });
    };

    $ctrl.formatDate = function formatDate(value) {
      if (!value) {
        return 'recently';
      }

      return new Date(value).toLocaleString();
    };

    $ctrl.pluralize = function pluralize(count) {
      return count === 1 ? '' : 's';
    };

    $ctrl.getStatusBadgeClass = function getStatusBadgeClass(status) {
      if (status === 'ERROR') {
        return 'connector-status-badge--error';
      }

      if (status === 'DISABLED') {
        return 'connector-status-badge--muted';
      }

      return 'connector-status-badge--active';
    };

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

    function loadConnections(preferredConnectionId) {
      $ctrl.isLoading = true;

      return AdminConnectorService.list().then(function handleConnections(connections) {
        var nextSelected;

        $ctrl.connections = connections;

        if (!connections.length) {
          $ctrl.selectedConnection = null;
          $ctrl.form = buildEmptyForm();
          return;
        }

        nextSelected = findConnectionById(preferredConnectionId || ($ctrl.selectedConnection && $ctrl.selectedConnection.id), connections) || connections[0];
        $ctrl.selectConnection(nextSelected);
      }).catch(function handleLoadError(error) {
        $ctrl.connections = [];
        $ctrl.selectedConnection = null;
        $ctrl.form = buildEmptyForm();
        NotificationService.error(getErrorMessage(error, 'Connector inventory is currently unavailable.'), 'Unable to load connector inventory');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    }
  }

  function buildEmptyForm() {
    return {
      name: '',
      apiKey: '',
      calendarId: '',
      model: '',
      baseUrl: ''
    };
  }

  function buildForm(connection) {
    return {
      name: connection && connection.name ? connection.name : '',
      apiKey: '',
      calendarId: connection && connection.config && connection.config.calendarId ? connection.config.calendarId : '',
      model: connection && connection.config && connection.config.model ? connection.config.model : '',
      baseUrl: connection && connection.config && connection.config.baseUrl ? connection.config.baseUrl : ''
    };
  }

  function buildCredentialsPayload(form) {
    var credentials = {};

    if (form && form.apiKey) {
      credentials.apiKey = form.apiKey;
    }

    if (form && form.calendarId) {
      credentials.calendarId = form.calendarId;
    }

    if (form && form.model) {
      credentials.model = form.model;
    }

    if (form && form.baseUrl) {
      credentials.baseUrl = form.baseUrl;
    }

    return credentials;
  }

  function findConnectionById(connectionId, connections) {
    return (connections || []).find(function findConnection(connection) {
      return connection.id === connectionId;
    }) || null;
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && typeof error.data.message === 'string' && error.data.message.trim()) {
      return error.data.message;
    }

    if (error && error.message) {
      return error.message;
    }

    return fallbackMessage;
  }
})();
