(function () {
  'use strict';

  angular.module('morningBriefingApp').service('UiShellService', UiShellService);

  UiShellService.$inject = ['LocalStorageService'];

  function UiShellService(LocalStorageService) {
    var THEME_STORAGE_KEY = 'morningBriefing.theme';

    this.state = {
      theme: getInitialTheme(),
      dashboardModalMode: null,
      widgetPanelOpen: false
    };

    this.setTheme = function setTheme(theme) {
      this.state.theme = theme;
      LocalStorageService.set(THEME_STORAGE_KEY, theme);
    };

    this.openDashboardModal = function openDashboardModal(mode) {
      this.state.dashboardModalMode = mode;
    };

    this.closeDashboardModal = function closeDashboardModal() {
      this.state.dashboardModalMode = null;
    };

    this.openWidgetPanel = function openWidgetPanel() {
      this.state.widgetPanelOpen = true;
    };

    this.closeWidgetPanel = function closeWidgetPanel() {
      this.state.widgetPanelOpen = false;
    };

    function getInitialTheme() {
      var savedTheme = LocalStorageService.get(THEME_STORAGE_KEY);

      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }

      return 'dark';
    }
  }
})();
