(function () {
  'use strict';

  angular.module('morningBriefingApp').service('NotificationService', NotificationService);

  NotificationService.$inject = ['toaster'];

  function NotificationService(toaster) {
    this.success = function success(body, title) {
      return popToast('success', body, title);
    };

    this.error = function error(body, title) {
      return popToast('error', body, title || 'Something went wrong');
    };

    this.info = function info(body, title) {
      return popToast('info', body, title);
    };

    this.warning = function warning(body, title) {
      return popToast('warning', body, title);
    };

    function popToast(type, body, title) {
      return toaster.pop({
        type: type,
        title: title || '',
        body: body,
        timeout: type === 'error' ? 7000 : 4000,
        showCloseButton: true
      });
    }
  }
})();
