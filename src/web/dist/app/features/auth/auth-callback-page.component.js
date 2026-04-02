(function () {
  'use strict';

  angular.module('morningBriefingApp').component('authCallbackPage', {
    template:
      '<section class="empty-state auth-status-page">' +
      '  <div class="empty-state__panel auth-status-page__panel">' +
      '    <span class="empty-state__eyebrow">Signing in</span>' +
      '    <h1 class="empty-state__title">Completing your Life2 session</h1>' +
      '    <p class="empty-state__copy">You should be redirected into Morning Briefing automatically.</p>' +
      '    <div class="spinner-border text-secondary" role="status" aria-hidden="true"></div>' +
      '  </div>' +
      '</section>',
    controller: AuthCallbackPageController
  });

  AuthCallbackPageController.$inject = ['$location', '$timeout', 'AuthService', 'NotificationService'];

  function AuthCallbackPageController($location, $timeout, AuthService, NotificationService) {
    this.$onInit = function onInit() {
      console.log('[AuthCallbackPage] init', {
        href: window.location.href,
        path: $location.path(),
        lastError: AuthService.getLastError(),
        isAuthenticated: AuthService.isAuthenticated()
      });

      if (AuthService.consumeCallback()) {
        console.log('[AuthCallbackPage] consumeCallback returned true, redirecting', {
          target: AuthService.consumePendingReturnPath() || '/dashboard'
        });
        $location.url(AuthService.consumePendingReturnPath() || '/dashboard');
        return;
      }

      if (AuthService.isAuthenticated()) {
        console.log('[AuthCallbackPage] already authenticated, redirecting', {
          target: AuthService.consumePendingReturnPath() || '/dashboard'
        });
        $location.url(AuthService.consumePendingReturnPath() || '/dashboard');
        return;
      }

      $timeout(function handleMissingCallbackToken() {
        console.log('[AuthCallbackPage] timeout check', {
          href: window.location.href,
          isAuthenticated: AuthService.isAuthenticated(),
          lastError: AuthService.getLastError()
        });

        if (AuthService.isAuthenticated()) {
          console.log('[AuthCallbackPage] authenticated after timeout, redirecting', {
            target: AuthService.consumePendingReturnPath() || '/dashboard'
          });
          $location.url(AuthService.consumePendingReturnPath() || '/dashboard');
          return;
        }

        console.warn('[AuthCallbackPage] no valid authentication token was available, redirecting to signed-out', {
          lastError: AuthService.getLastError()
        });
        NotificationService.error('No authentication token was returned from the auth service.');
        $location.path('/signed-out');
      }, 400);
    };
  }
})();
