(function () {
  'use strict';

  angular.module('morningBriefingApp').component('emailWidget', {
    bindings: {
      widget: '<'
    },
    template:
      '<div class="email-card" overflow-autopan>' +
      '  <div class="email-card__meta" ng-if="$ctrl.widget.data.connectionLabel || $ctrl.hasFilters()">' +
      '    <div class="email-card__connection" ng-if="$ctrl.widget.data.connectionLabel">' +
      '      <span class="email-card__meta-label">Source</span>' +
      '      <strong>{{$ctrl.widget.data.connectionLabel}}</strong>' +
      '    </div>' +
      '    <div class="email-filters" ng-if="$ctrl.hasFilters()">' +
      '      <span class="email-filter-chip" ng-repeat="filter in $ctrl.widget.data.filters track by $index">{{filter}}</span>' +
      '    </div>' +
      '  </div>' +
      '  <p class="tasks-empty" ng-if="!$ctrl.hasMessages()">{{$ctrl.widget.data.emptyMessage || "No email messages available."}}</p>' +
      '  <div class="email-message" ng-repeat="message in $ctrl.widget.data.messages track by message.id || $index">' +
      '    <div class="email-message__meta">' +
      '      <span class="email-message__status" ng-class="{\'email-message__status--unread\': message.isUnread}">' +
      '        <span class="email-message__status-dot" ng-class="{\'email-message__status-dot--unread\': message.isUnread}"></span>' +
      '        {{message.isUnread ? "Unread" : "Read"}}' +
      '      </span>' +
      '      <span class="email-message__timestamp">{{$ctrl.formatTimestamp(message.receivedAt)}}</span>' +
      '    </div>' +
      '    <div class="email-message__subject" ng-class="{\'email-message__subject--unread\': message.isUnread}">{{message.subject}}</div>' +
      '    <div class="email-message__from">{{message.from}}</div>' +
      '  </div>' +
      '</div>',
    controller: function EmailWidgetController() {
      var $ctrl = this;

      $ctrl.hasMessages = function hasMessages() {
        return !!(($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.messages || []).length);
      };

      $ctrl.hasFilters = function hasFilters() {
        return !!(($ctrl.widget && $ctrl.widget.data && $ctrl.widget.data.filters || []).length);
      };

      $ctrl.formatTimestamp = function formatTimestamp(value) {
        if (!value) {
          return '';
        }

        return new Date(value).toLocaleString();
      };
    }
  });
})();
