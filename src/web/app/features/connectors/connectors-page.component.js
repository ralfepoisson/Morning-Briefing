(function () {
  'use strict';

  angular.module('morningBriefingApp').component('connectorsPage', {
    template:
      '<section class="connectors-page">' +
      '  <div class="connectors-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Connectors</div>' +
      '      <h1 class="stage-title stage-title--compact">Manage integrations</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Review the connectors you already have and update details like API keys or reconnect Google-powered services whenever credentials change.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="connectors-layout" ng-if="$ctrl.ready">' +
      '    <aside class="connectors-list-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Available</div>' +
      '        <h2 class="connectors-panel-title">Your connectors</h2>' +
      '      </div>' +
      '      <p class="connectors-panel-copy" ng-if="$ctrl.isLoading">Loading connectors...</p>' +
      '      <div class="connectors-empty-state" ng-if="!$ctrl.isLoading && !$ctrl.connections.length">' +
      '        <strong>No connectors yet</strong>' +
      '        <span>Create a task connection from a widget first, then you can manage it here.</span>' +
      '      </div>' +
      '      <button type="button" class="connector-list-item" ng-repeat="connection in $ctrl.connections track by connection.id" ng-class="{\'connector-list-item--active\': $ctrl.isSelected(connection)}" ng-click="$ctrl.selectConnection(connection)">' +
      '        <div class="connector-list-item__header">' +
      '          <strong>{{connection.name}}</strong>' +
      '          <span class="connector-status-badge" ng-class="$ctrl.getStatusBadgeClass(connection.status)">{{connection.status}}</span>' +
      '        </div>' +
      '        <span class="connector-list-item__meta">{{connection.type | uppercase}} · {{connection.authType.replace(\'_\', \' \')}}</span>' +
      '        <span class="connector-list-item__meta">Updated {{$ctrl.formatDate(connection.updatedAt)}}</span>' +
      '      </button>' +
      '    </aside>' +
      '    <section class="connectors-detail-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Editor</div>' +
      '        <h2 class="connectors-panel-title">{{$ctrl.selectedConnection ? $ctrl.selectedConnection.name : "Select a connector"}}</h2>' +
      '      </div>' +
      '      <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.selectedConnection && !$ctrl.isLoading">' +
      '        <strong>Pick a connector to edit</strong>' +
      '        <span>We will load the saved integration details here so you can update them safely.</span>' +
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
      '        </div>' +
      '        <label class="form-label mt-4" for="connectorName">Connector name</label>' +
      '        <input id="connectorName" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.name" placeholder="Connection name" required />' +
      '        <label class="form-label mt-3" for="connectorApiKey" ng-if="$ctrl.selectedConnection.type === \'todoist\'">API Key</label>' +
      '        <input id="connectorApiKey" class="form-control form-control-lg" type="password" ng-if="$ctrl.selectedConnection.type === \'todoist\'" ng-model="$ctrl.form.apiKey" placeholder="Leave blank to keep the current API key" />' +
      '        <label class="form-label mt-3" for="connectorOpenAiApiKey" ng-if="$ctrl.selectedConnection.type === \'openai\'">API Key</label>' +
      '        <input id="connectorOpenAiApiKey" class="form-control form-control-lg" type="password" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.apiKey" placeholder="Leave blank to keep the current API key" />' +
      '        <label class="form-label mt-3" for="connectorOpenAiModel" ng-if="$ctrl.selectedConnection.type === \'openai\'">Model</label>' +
      '        <input id="connectorOpenAiModel" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.model" placeholder="gpt-5-mini" />' +
      '        <label class="form-label mt-3" for="connectorOpenAiBaseUrl" ng-if="$ctrl.selectedConnection.type === \'openai\'">Base URL</label>' +
      '        <input id="connectorOpenAiBaseUrl" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'openai\'" ng-model="$ctrl.form.baseUrl" placeholder="https://api.openai.com" />' +
      '        <label class="form-label mt-3" for="connectorCalendarId" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'">Google Calendar ID</label>' +
      '        <input id="connectorCalendarId" class="form-control form-control-lg" type="text" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'" ng-model="$ctrl.form.calendarId" placeholder="team@example.com" />' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'todoist\'">Enter a new API key only when you want to replace the current Todoist credential.</p>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'openai\'">Update the model or base URL here, and enter a new API key only when you want to replace the saved credential.</p>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'google-calendar\'">This connection uses OAuth. You can change the calendar id here or reconnect the Google account.</p>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'gmail\'">This connection uses OAuth. Reconnect the Google account here if Gmail access needs to be refreshed.</p>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.selectedConnection.type === \'gmail\' && $ctrl.selectedConnection.config && $ctrl.selectedConnection.config.accountEmail">Connected account: <strong>{{$ctrl.selectedConnection.config.accountEmail}}</strong></p>' +
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
    controller: ConnectorsPageController
  });

  ConnectorsPageController.$inject = ['ConnectionService', 'NotificationService', '$window'];

  function ConnectorsPageController(ConnectionService, NotificationService, $window) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isLoading = false;
    $ctrl.isSaving = false;
    $ctrl.connections = [];
    $ctrl.selectedConnection = null;
    $ctrl.form = buildEmptyForm();

    $ctrl.$onInit = function onInit() {
      loadConnections().finally(function markReady() {
        $ctrl.ready = true;
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
      }).then(function handleConnectionUpdated(connection) {
        replaceConnection(connection);
        $ctrl.selectConnection(connection);
        NotificationService.success('Connector details saved.', 'Connector updated');
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

    $ctrl.getStatusBadgeClass = function getStatusBadgeClass(status) {
      if (status === 'ERROR') {
        return 'connector-status-badge--error';
      }

      if (status === 'DISABLED') {
        return 'connector-status-badge--muted';
      }

      return 'connector-status-badge--active';
    };

    function loadConnections() {
      $ctrl.isLoading = true;

      return ConnectionService.list().then(function handleConnections(connections) {
        $ctrl.connections = connections;

        if (!connections.length) {
          $ctrl.selectedConnection = null;
          $ctrl.form = buildEmptyForm();
          return;
        }

        if ($ctrl.selectedConnection) {
          var selectedConnection = findConnectionById($ctrl.selectedConnection.id, connections);

          if (selectedConnection) {
            $ctrl.selectConnection(selectedConnection);
            return;
          }
        }

        $ctrl.selectConnection(connections[0]);
      }).catch(function handleLoadError(error) {
        $ctrl.connections = [];
        $ctrl.selectedConnection = null;
        $ctrl.form = buildEmptyForm();
        NotificationService.error(getErrorMessage(error, 'Connectors are currently unavailable.'), 'Unable to load connectors');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    }

    function replaceConnection(updatedConnection) {
      $ctrl.connections = ($ctrl.connections || []).map(function mapConnection(connection) {
        if (connection.id === updatedConnection.id) {
          return updatedConnection;
        }

        return connection;
      });
    }

    function findConnectionById(connectionId, connections) {
      return (connections || []).find(function findConnection(connection) {
        return connection.id === connectionId;
      }) || null;
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

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && typeof error.data.message === 'string' && error.data.message.trim()) {
      return error.data.message;
    }

    return fallbackMessage;
  }
})();
