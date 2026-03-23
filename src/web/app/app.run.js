(function () {
  'use strict';

  angular.module('morningBriefingApp').run(appRun);

  appRun.$inject = ['$rootScope', '$location', 'AuthService'];

  function appRun($rootScope, $location, AuthService) {
    AuthService.restoreSession();

    if (AuthService.consumeCallback()) {
      $location.url(resolvePostSignInPath());
    } else if (AuthService.isAuthenticated() && AuthService.isPublicRoute($location.path())) {
      $location.url(resolvePostSignInPath());
    }

    $rootScope.$on('$routeChangeStart', function handleRouteChangeStart(event, next) {
      var nextPath = next && next.$$route && next.$$route.originalPath ? next.$$route.originalPath : '/';

      if (AuthService.isAuthenticated() && AuthService.isPublicRoute(nextPath)) {
        event.preventDefault();
        $location.url(resolvePostSignInPath());
        return;
      }

      if (AuthService.isPublicRoute(nextPath)) {
        return;
      }

      if (AuthService.hasIncomingToken()) {
        return;
      }

      if (AuthService.isAuthenticated()) {
        return;
      }

      event.preventDefault();
      AuthService.beginSignIn(nextPath);
    });

    function resolvePostSignInPath() {
      var nextPath = AuthService.consumePendingReturnPath() || '/';

      if (AuthService.isPublicRoute(nextPath)) {
        return '/';
      }

      return nextPath;
    }
  }
})();
