(function () {
  'use strict';

  angular.module('morningBriefingApp').component('logsPage', {
    template:
      '<section class="logs-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Logs</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Search recent backend log events and quickly include or exclude log levels while troubleshooting.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <section class="message-broker-panel logs-toolbar">' +
      '    <div class="logs-toolbar__search">' +
      '      <label class="form-label logs-toolbar__label" for="admin-log-search">Search logs</label>' +
      '      <div class="logs-toolbar__controls">' +
      '        <div class="input-group">' +
      '          <span class="input-group-text logs-toolbar__icon"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></span>' +
      '          <input id="admin-log-search" type="search" class="form-control" ng-model="$ctrl.filters.q" ng-keydown="$ctrl.handleSearchKeydown($event)" placeholder="Search message, event, scope, or JSON context" />' +
      '          <button type="button" class="btn btn-outline-light" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">Search</button>' +
      '        </div>' +
      '        <div class="logs-toolbar__range">' +
      '          <label class="form-label logs-toolbar__label" for="admin-log-range">Time range</label>' +
      '          <select id="admin-log-range" class="form-select" ng-model="$ctrl.filters.range" ng-options="option.value as option.label for option in $ctrl.rangeOptions" ng-change="$ctrl.refresh()"></select>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div>' +
      '      <div class="logs-toolbar__label">Quick filters</div>' +
      '      <div class="logs-filter-group">' +
      '        <button type="button" class="logs-filter-pill" ng-repeat="level in $ctrl.levelOptions track by level.value" ng-class="$ctrl.getLevelClass(level.value)" ng-click="$ctrl.toggleLevel(level.value)">' +
      '          <i class="fa-solid" ng-class="$ctrl.hasLevel(level.value) ? \'fa-check\' : \'fa-plus\'" aria-hidden="true"></i>' +
      '          <span>{{level.label}}</span>' +
      '          <small>{{$ctrl.getLevelCount(level.value)}}</small>' +
      '        </button>' +
      '      </div>' +
      '    </div>' +
      '  </section>' +
      '  <p class="connectors-panel-copy connectors-panel-copy--error" ng-if="$ctrl.errorMessage">{{$ctrl.errorMessage}}</p>' +
      '  <div class="message-broker-summary" ng-if="$ctrl.data">' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Matching logs</span>' +
      '      <strong>{{$ctrl.data.entries.length}}</strong>' +
      '      <span>Returned from the current filter set</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Info</span>' +
      '      <strong>{{$ctrl.data.totals.filtered.info}}</strong>' +
      '      <span>{{$ctrl.data.totals.stored.info}} stored</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Warnings</span>' +
      '      <strong>{{$ctrl.data.totals.filtered.warn}}</strong>' +
      '      <span>{{$ctrl.data.totals.stored.warn}} stored</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Errors</span>' +
      '      <strong>{{$ctrl.data.totals.filtered.error}}</strong>' +
      '      <span>{{$ctrl.data.totals.stored.error}} stored</span>' +
      '    </article>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.data">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">Recent entries</div>' +
      '      <h2 class="connectors-panel-title">Search results</h2>' +
      '    </div>' +
      '    <div class="message-broker-table-wrap" ng-if="$ctrl.data.entries.length">' +
      '      <table class="message-broker-table logs-table">' +
      '        <thead>' +
      '          <tr>' +
      '            <th>Time</th>' +
      '            <th>Level</th>' +
      '            <th>Scope</th>' +
      '            <th>Event</th>' +
      '            <th>Message</th>' +
      '            <th class="logs-table__context-column">Context</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody>' +
      '          <tr ng-repeat-start="entry in $ctrl.data.entries track by entry.id">' +
      '            <td class="logs-table__time">{{entry.timestamp | date:\'medium\'}}</td>' +
      '            <td><span class="message-broker-status-pill" ng-class="$ctrl.getLogLevelClass(entry.level)">{{entry.level}}</span></td>' +
      '            <td>{{entry.scope}}</td>' +
      '            <td>{{entry.event}}</td>' +
      '            <td class="logs-table__message">{{entry.message}}</td>' +
      '            <td class="logs-table__context-cell">' +
      '              <button type="button" class="logs-context-toggle" ng-click="$ctrl.toggleExpanded(entry.id)" ng-attr-aria-expanded="{{$ctrl.isExpanded(entry.id)}}">' +
      '                <i class="fa-solid" ng-class="$ctrl.isExpanded(entry.id) ? \'fa-chevron-up\' : \'fa-chevron-down\'" aria-hidden="true"></i>' +
      '                <span>{{$ctrl.isExpanded(entry.id) ? "Hide context" : "Show context"}}</span>' +
      '              </button>' +
      '            </td>' +
      '          </tr>' +
      '          <tr class="logs-table__details-row" ng-repeat-end ng-if="$ctrl.isExpanded(entry.id)">' +
      '            <td colspan="6">' +
      '              <pre class="logs-table__context">{{$ctrl.formatContext(entry.context)}}</pre>' +
      '            </td>' +
      '          </tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '    <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.data.entries.length && !$ctrl.isLoading">' +
      '      <strong>No log entries match these filters</strong>' +
      '      <span>Try widening the search text or turning one of the log levels back on.</span>' +
      '    </div>' +
      '  </section>' +
      '</section>',
    controller: LogsPageController
  });

  LogsPageController.$inject = ['LogService'];

  function LogsPageController(LogService) {
    var $ctrl = this;

    $ctrl.levelOptions = [
      { value: 'info', label: 'Info' },
      { value: 'warn', label: 'Warn' },
      { value: 'error', label: 'Error' }
    ];
    $ctrl.rangeOptions = [
      { value: '30m', label: 'Last 30 minutes' },
      { value: '2h', label: 'Last 2 hours' },
      { value: '1d', label: 'Last day' },
      { value: '1w', label: 'Last week' },
      { value: 'all', label: 'All available logs' }
    ];
    $ctrl.filters = {
      q: '',
      levels: ['info', 'warn', 'error'],
      limit: 200,
      range: '30m'
    };
    $ctrl.data = null;
    $ctrl.errorMessage = '';
    $ctrl.isLoading = false;
    $ctrl.expandedEntries = {};

    $ctrl.$onInit = function onInit() {
      loadLogs();
    };

    $ctrl.refresh = function refresh() {
      loadLogs();
    };

    $ctrl.handleSearchKeydown = function handleSearchKeydown(event) {
      if (event.key === 'Enter') {
        loadLogs();
      }
    };

    $ctrl.toggleLevel = function toggleLevel(level) {
      var nextLevels;

      if ($ctrl.hasLevel(level)) {
        nextLevels = $ctrl.filters.levels.filter(function filterLevel(value) {
          return value !== level;
        });
      } else {
        nextLevels = $ctrl.filters.levels.concat(level);
      }

      $ctrl.filters.levels = nextLevels.length ? nextLevels : ['info', 'warn', 'error'];
      loadLogs();
    };

    $ctrl.hasLevel = function hasLevel(level) {
      return $ctrl.filters.levels.indexOf(level) >= 0;
    };

    $ctrl.getLevelClass = function getLevelClass(level) {
      return {
        'logs-filter-pill--active': $ctrl.hasLevel(level),
        'logs-filter-pill--inactive': !$ctrl.hasLevel(level),
        'logs-filter-pill--info': level === 'info',
        'logs-filter-pill--warn': level === 'warn',
        'logs-filter-pill--error': level === 'error'
      };
    };

    $ctrl.getLogLevelClass = function getLogLevelClass(level) {
      if (level === 'error') {
        return 'message-broker-status-pill--failed';
      }

      if (level === 'warn') {
        return 'message-broker-status-pill--skipped';
      }

      return 'message-broker-status-pill--completed';
    };

    $ctrl.isExpanded = function isExpanded(entryId) {
      return !!$ctrl.expandedEntries[entryId];
    };

    $ctrl.toggleExpanded = function toggleExpanded(entryId) {
      $ctrl.expandedEntries[entryId] = !$ctrl.expandedEntries[entryId];
    };

    $ctrl.getLevelCount = function getLevelCount(level) {
      if (!$ctrl.data || !$ctrl.data.totals || !$ctrl.data.totals.filtered) {
        return 0;
      }

      return $ctrl.data.totals.filtered[level] || 0;
    };

    $ctrl.formatContext = function formatContext(context) {
      return JSON.stringify(context || {}, null, 2);
    };

    function loadLogs() {
      $ctrl.isLoading = true;
      $ctrl.errorMessage = '';

      return LogService.getLogs($ctrl.filters).then(function handleLogsLoaded(data) {
        $ctrl.data = data;
      }).catch(function handleError(error) {
        $ctrl.data = null;
        $ctrl.errorMessage = getErrorMessage(error, 'Application logs are currently unavailable.');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
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
