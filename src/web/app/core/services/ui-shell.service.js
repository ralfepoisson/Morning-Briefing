(function () {
  'use strict';

  angular.module('morningBriefingApp').service('UiShellService', UiShellService);

  function UiShellService() {
    this.state = {
      theme: 'dark',
      dashboardModalMode: null,
      widgetPanelOpen: false
    };

    this.setTheme = function setTheme(theme) {
      this.state.theme = theme;
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
  }
})();
