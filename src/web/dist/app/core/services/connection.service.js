(function () {
  'use strict';

  angular.module('morningBriefingApp').service('ConnectionService', ConnectionService);

  ConnectionService.$inject = ['$http', '$window', 'ApiConfig'];

  var WIDGET_OAUTH_CONTEXT_KEY = 'morningBriefing.widgetOAuthContext';

  function ConnectionService($http, $window, ApiConfig) {
    this.list = function list(type) {
      var url = ApiConfig.baseUrl + '/connections';

      if (type) {
        url += '?type=' + encodeURIComponent(type);
      }

      return $http.get(url).then(function handleResponse(response) {
        return response.data.items || [];
      });
    };

    this.create = function create(payload) {
      return $http.post(ApiConfig.baseUrl + '/connections', {
        type: payload.type,
        credentials: payload.credentials || {}
      }).then(function handleResponse(response) {
        return response.data;
      });
    };

    this.update = function update(connectionId, payload) {
      return $http.patch(ApiConfig.baseUrl + '/connections/' + encodeURIComponent(connectionId), {
        name: payload.name,
        credentials: payload.credentials || {}
      }).then(function handleResponse(response) {
        return response.data;
      });
    };

    this.startGoogleCalendarOAuth = function startGoogleCalendarOAuth(returnTo, connectionId) {
      return $http.post(ApiConfig.baseUrl + '/connections/google-calendar/oauth/start', {
        returnTo: returnTo || $window.location.href,
        connectionId: connectionId || ''
      }).then(function handleResponse(response) {
        var url = response.data && response.data.authorizationUrl ? response.data.authorizationUrl : '';

        if (!url) {
          throw new Error('Google OAuth could not be started.');
        }

        $window.location.href = url;
      });
    };

    this.saveWidgetOAuthContext = function saveWidgetOAuthContext(context) {
      if (!context) {
        clearWidgetOAuthContext($window);
        return;
      }

      try {
        $window.sessionStorage.setItem(WIDGET_OAUTH_CONTEXT_KEY, JSON.stringify(context));
      } catch (error) {
        // Ignore session storage failures so OAuth can still proceed.
      }
    };

    this.consumeWidgetOAuthContext = function consumeWidgetOAuthContext() {
      var storedValue;

      try {
        storedValue = $window.sessionStorage.getItem(WIDGET_OAUTH_CONTEXT_KEY);
        $window.sessionStorage.removeItem(WIDGET_OAUTH_CONTEXT_KEY);
      } catch (error) {
        return null;
      }

      if (!storedValue) {
        return null;
      }

      try {
        return JSON.parse(storedValue);
      } catch (error) {
        return null;
      }
    };
  }

  function clearWidgetOAuthContext($window) {
    try {
      $window.sessionStorage.removeItem(WIDGET_OAUTH_CONTEXT_KEY);
    } catch (error) {
      // Ignore session storage failures.
    }
  }
})();
