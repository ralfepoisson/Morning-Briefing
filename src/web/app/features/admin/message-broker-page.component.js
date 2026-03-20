(function () {
  'use strict';

  angular.module('morningBriefingApp').component('messageBrokerPage', {
    template:
      '<section class="message-broker-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Message Broker</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Track queue depth, recent snapshot jobs, and publishing versus processing throughput across the last seven days.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="message-broker-summary" ng-if="$ctrl.data">' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Queue status</span>' +
      '      <strong>{{$ctrl.formatQueueStatus($ctrl.data.queue.status)}}</strong>' +
      '      <span>{{$ctrl.data.queue.queueName}}</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Messages visible</span>' +
      '      <strong>{{$ctrl.formatCount($ctrl.data.queue.visibleMessages)}}</strong>' +
      '      <span>Waiting to be picked up</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">In flight</span>' +
      '      <strong>{{$ctrl.formatCount($ctrl.data.queue.inFlightMessages)}}</strong>' +
      '      <span>Currently being processed</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Published today</span>' +
      '      <strong>{{$ctrl.data.overview.publishedToday}}</strong>' +
      '      <span>Jobs seen today</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Processed today</span>' +
      '      <strong>{{$ctrl.data.overview.processedToday}}</strong>' +
      '      <span>Completed, failed, or skipped</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Failed today</span>' +
      '      <strong>{{$ctrl.data.overview.failedToday}}</strong>' +
      '      <span>Terminal failures today</span>' +
      '    </article>' +
      '  </div>' +
      '  <div class="message-broker-grid" ng-if="$ctrl.data">' +
      '    <section class="message-broker-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Throughput</div>' +
      '        <h2 class="connectors-panel-title">Published vs. processed</h2>' +
      '      </div>' +
      '      <p class="connectors-panel-copy">Published uses daily job intake; processed counts jobs that reached a terminal state.</p>' +
      '      <div class="message-broker-chart" ng-if="$ctrl.chart.hasData">' +
      '        <div class="message-broker-chart__legend">' +
      '          <span><i class="fa-solid fa-minus"></i> Published</span>' +
      '          <span class="message-broker-chart__legend-secondary"><i class="fa-solid fa-minus"></i> Processed</span>' +
      '        </div>' +
      '        <svg viewBox="0 0 640 260" role="img" aria-label="Published versus processed message counts">' +
      '          <g class="message-broker-chart__grid">' +
      '            <line x1="44" y1="24" x2="616" y2="24"></line>' +
      '            <line x1="44" y1="94" x2="616" y2="94"></line>' +
      '            <line x1="44" y1="164" x2="616" y2="164"></line>' +
      '            <line x1="44" y1="234" x2="616" y2="234"></line>' +
      '          </g>' +
      '          <path class="message-broker-chart__line" ng-attr-d="{{$ctrl.chart.publishedPath}}"></path>' +
      '          <path class="message-broker-chart__line message-broker-chart__line--secondary" ng-attr-d="{{$ctrl.chart.processedPath}}"></path>' +
      '          <g class="message-broker-chart__dots">' +
      '            <circle ng-repeat="point in $ctrl.chart.points track by $index" ng-attr-cx="{{point.x}}" ng-attr-cy="{{point.publishedY}}" r="4"></circle>' +
      '            <circle class="message-broker-chart__dot-secondary" ng-repeat="point in $ctrl.chart.points track by \'processed-\' + $index" ng-attr-cx="{{point.x}}" ng-attr-cy="{{point.processedY}}" r="4"></circle>' +
      '          </g>' +
      '          <g class="message-broker-chart__labels">' +
      '            <text ng-repeat="point in $ctrl.chart.points track by \'label-\' + $index" ng-attr-x="{{point.x}}" y="252">{{point.label}}</text>' +
      '          </g>' +
      '        </svg>' +
      '      </div>' +
      '      <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.chart.hasData">' +
      '        <strong>No throughput data yet</strong>' +
      '        <span>Once jobs start moving through the broker, the chart will appear here.</span>' +
      '      </div>' +
      '    </section>' +
      '    <section class="message-broker-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Queue</div>' +
      '        <h2 class="connectors-panel-title">Current state</h2>' +
      '      </div>' +
      '      <div class="message-broker-status-list">' +
      '        <div class="message-broker-status-list__item">' +
      '          <span>Pending jobs</span>' +
      '          <strong>{{$ctrl.data.overview.pendingJobs}}</strong>' +
      '        </div>' +
      '        <div class="message-broker-status-list__item">' +
      '          <span>Processing jobs</span>' +
      '          <strong>{{$ctrl.data.overview.processingJobs}}</strong>' +
      '        </div>' +
      '        <div class="message-broker-status-list__item">' +
      '          <span>Delayed messages</span>' +
      '          <strong>{{$ctrl.formatCount($ctrl.data.queue.delayedMessages)}}</strong>' +
      '        </div>' +
      '        <div class="message-broker-status-list__item">' +
      '          <span>Total in queue</span>' +
      '          <strong>{{$ctrl.formatCount($ctrl.data.queue.totalMessages)}}</strong>' +
      '        </div>' +
      '      </div>' +
      '      <p class="connectors-panel-copy" ng-if="$ctrl.data.queue.queueUrl">Queue URL: {{$ctrl.data.queue.queueUrl}}</p>' +
      '      <p class="connectors-panel-copy connectors-panel-copy--error" ng-if="$ctrl.data.queue.lastError">{{$ctrl.data.queue.lastError}}</p>' +
      '    </section>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.data">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">Recent jobs</div>' +
      '      <h2 class="connectors-panel-title">Latest queue messages</h2>' +
      '    </div>' +
      '    <div class="message-broker-table-wrap" ng-if="$ctrl.data.recentMessages.length">' +
      '      <table class="message-broker-table">' +
      '        <thead>' +
      '          <tr>' +
      '            <th>Status</th>' +
      '            <th>Widget</th>' +
      '            <th>Snapshot date</th>' +
      '            <th>Trigger</th>' +
      '            <th>Attempts</th>' +
      '            <th>Created</th>' +
      '            <th>Completed</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody>' +
      '          <tr ng-repeat="message in $ctrl.data.recentMessages track by message.id">' +
      '            <td><span class="message-broker-status-pill" ng-class="$ctrl.getStatusClass(message.status)">{{message.status}}</span></td>' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{message.widgetTypeLabel || "Unknown widget"}}</div>' +
      '              <div class="message-broker-table__secondary" ng-if="message.widgetTitle">{{message.widgetTitle}}</div>' +
      '            </td>' +
      '            <td>{{message.snapshotDate}}</td>' +
      '            <td>{{message.triggerSource}}</td>' +
      '            <td>{{message.attemptCount}}</td>' +
      '            <td>{{message.createdAt | date:\'medium\'}}</td>' +
      '            <td>{{message.completedAt ? (message.completedAt | date:\'medium\') : "In progress"}}</td>' +
      '          </tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '    <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.data.recentMessages.length && !$ctrl.isLoading">' +
      '      <strong>No jobs yet</strong>' +
      '      <span>When snapshot messages begin flowing through the queue, they will show up here.</span>' +
      '    </div>' +
      '  </section>' +
      '</section>',
    controller: MessageBrokerPageController
  });

  MessageBrokerPageController.$inject = ['MessageBrokerService', 'NotificationService'];

  function MessageBrokerPageController(MessageBrokerService, NotificationService) {
    var $ctrl = this;

    $ctrl.data = null;
    $ctrl.chart = buildEmptyChart();
    $ctrl.isLoading = false;

    $ctrl.$onInit = function onInit() {
      loadOverview();
    };

    $ctrl.refresh = function refresh() {
      loadOverview();
    };

    $ctrl.formatCount = function formatCount(value) {
      return value === null || value === undefined ? 'Unavailable' : value;
    };

    $ctrl.formatQueueStatus = function formatQueueStatus(status) {
      if (status === 'connected') {
        return 'Connected';
      }

      if (status === 'disabled') {
        return 'Disabled';
      }

      if (status === 'unconfigured') {
        return 'Needs config';
      }

      return 'Unavailable';
    };

    $ctrl.getStatusClass = function getStatusClass(status) {
      if (status === 'FAILED') {
        return 'message-broker-status-pill--failed';
      }

      if (status === 'PROCESSING') {
        return 'message-broker-status-pill--processing';
      }

      if (status === 'SKIPPED') {
        return 'message-broker-status-pill--skipped';
      }

      return 'message-broker-status-pill--completed';
    };

    function loadOverview() {
      $ctrl.isLoading = true;

      return MessageBrokerService.getOverview().then(function handleOverviewLoaded(data) {
        $ctrl.data = data;
        $ctrl.chart = buildChart(data.chart || []);
      }).catch(function handleError(error) {
        $ctrl.data = null;
        $ctrl.chart = buildEmptyChart();
        NotificationService.error(getErrorMessage(error, 'Message broker metrics are currently unavailable.'), 'Unable to load broker metrics');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    }
  }

  function buildChart(rows) {
    if (!rows || !rows.length) {
      return buildEmptyChart();
    }

    var width = 572;
    var height = 210;
    var originX = 44;
    var originY = 24;
    var maxValue = rows.reduce(function reduceMax(currentMax, row) {
      return Math.max(currentMax, row.published || 0, row.processed || 0);
    }, 0);

    if (!maxValue) {
      return buildEmptyChart();
    }

    var stepX = rows.length === 1 ? 0 : width / (rows.length - 1);
    var points = rows.map(function mapRow(row, index) {
      var x = originX + (stepX * index);

      return {
        x: roundValue(x),
        publishedY: scaleY(row.published || 0, maxValue, originY, height),
        processedY: scaleY(row.processed || 0, maxValue, originY, height),
        label: formatChartLabel(row.date)
      };
    });

    return {
      hasData: true,
      points: points,
      publishedPath: buildLinePath(points, 'publishedY'),
      processedPath: buildLinePath(points, 'processedY')
    };
  }

  function scaleY(value, maxValue, originY, height) {
    return roundValue(originY + height - ((value / maxValue) * height));
  }

  function buildLinePath(points, key) {
    return points.map(function mapPoint(point, index) {
      return (index ? 'L' : 'M') + point.x + ' ' + point[key];
    }).join(' ');
  }

  function formatChartLabel(value) {
    var date = new Date(value + 'T00:00:00Z');
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  }

  function roundValue(value) {
    return Math.round(value * 10) / 10;
  }

  function buildEmptyChart() {
    return {
      hasData: false,
      points: [],
      publishedPath: '',
      processedPath: ''
    };
  }

  function getErrorMessage(error, fallback) {
    if (error && error.data && error.data.message) {
      return error.data.message;
    }

    return fallback;
  }
})();
