(function () {
  'use strict';

  angular.module('morningBriefingApp').component('authStatusPage', {
    template:
      '<section class="empty-state auth-status-page">' +
      '  <div class="empty-state__panel auth-status-page__panel">' +
      '    <span class="empty-state__eyebrow">Signed out</span>' +
      '    <h1 class="empty-state__title">Authentication is required</h1>' +
      '    <p class="empty-state__copy">Use the central Life2 sign-in flow to return to your Morning Briefing dashboards.</p>' +
      '    <p class="empty-state__copy auth-status-page__error" ng-if="$ctrl.errorMessage">{{$ctrl.errorMessage}}</p>' +
      '    <div class="d-flex flex-wrap gap-2 justify-content-center">' +
      '      <button type="button" class="btn btn-primary" ng-click="$ctrl.signIn()">Sign in</button>' +
      '      <a class="btn btn-outline-secondary" ng-if="$ctrl.signOutUrl" ng-href="{{$ctrl.signOutUrl}}">Life2 sign-out</a>' +
      '    </div>' +
      '  </div>' +
      '</section>',
    controller: AuthStatusPageController
  });

  AuthStatusPageController.$inject = ['$location', '$timeout', 'AuthService'];

  function AuthStatusPageController($location, $timeout, AuthService) {
    var $ctrl = this;

    $ctrl.$onInit = function onInit() {
      $ctrl.signOutUrl = AuthService.getSignOutUrl();
      $ctrl.errorMessage = AuthService.getLastError();
      console.log('[AuthStatusPage] init', {
        href: window.location.href,
        path: $location.path(),
        isAuthenticated: AuthService.isAuthenticated(),
        errorMessage: $ctrl.errorMessage
      });
      redirectIfAuthenticated();
    };

    $ctrl.signIn = function signIn() {
      AuthService.beginSignIn('/');
    };

    function redirectIfAuthenticated() {
      if (AuthService.consumeCallback()) {
        $location.url(resolvePostSignInPath());
        return;
      }

      if (AuthService.isAuthenticated()) {
        $location.url(resolvePostSignInPath());
        return;
      }

      $timeout(function retryAfterBootstrap() {
        if (AuthService.isAuthenticated()) {
          $location.url(resolvePostSignInPath());
        }
      }, 0);
    }

    function resolvePostSignInPath() {
      var nextPath = AuthService.consumePendingReturnPath() || '/';

      if (AuthService.isPublicRoute(nextPath)) {
        return '/';
      }

      return nextPath;
    }
  }
})();
