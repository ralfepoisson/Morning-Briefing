(function () {
  'use strict';

  angular.module('morningBriefingApp').component('dashboardPage', {
    template:
      '<section class="dashboard-workspace" ng-if="$ctrl.ready">' +
      '  <section class="dashboard-stage">' +
      '    <div class="stage-toolbar d-flex flex-column gap-2">' +
      '      <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-2">' +
      '        <div class="stage-heading">' +
      '          <div class="stage-kicker">Dashboard</div>' +
      '          <h1 class="stage-title stage-title--compact">{{$ctrl.activeDashboard.name}}</h1>' +
      '          <p class="stage-copy stage-copy--compact mb-0" ng-if="$ctrl.activeDashboard.description">{{$ctrl.activeDashboard.description}}</p>' +
      '          <p class="stage-copy stage-copy--compact mb-0" ng-if="!$ctrl.activeDashboard.description">Blank dashboard ready for widgets.</p>' +
      '        </div>' +
      '        <div class="header-controls d-flex flex-wrap align-items-center justify-content-xl-end gap-2">' +
      '          <button type="button" class="btn btn-outline-light icon-button" ng-click="$ctrl.openEditDashboardModal()" aria-label="Configure dashboard">&#9881;</button>' +
      '          <button type="button" class="btn btn-light text-dark" ng-click="$ctrl.toggleEditing()">{{ $ctrl.isEditing ? "Save Dashboard" : "Edit Dashboard" }}</button>' +
      '          <button type="button" class="btn btn-outline-light" ng-if="$ctrl.isEditing" ng-click="$ctrl.openWidgetPanel()">+ Widget</button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dashboard-canvas" ng-class="{\'dashboard-canvas--editing\': $ctrl.isEditing}">' +
      '      <article class="widget-card widget-card--weather" ng-repeat="widget in $ctrl.widgets track by widget.id" draggable-widget widget="widget" enabled="$ctrl.isEditing" on-move="$ctrl.persistWidgetPosition(widget)" ng-style="{ width: widget.width + \'px\', height: widget.height + \'px\' }">' +
      '        <div class="widget-handle">' +
      '          <div>' +
      '            <div class="widget-label">Weather widget</div>' +
      '            <h3 class="widget-title">{{widget.title}}</h3>' +
      '          </div>' +
      '          <span class="drag-pill" ng-if="$ctrl.isEditing">Drag</span>' +
      '        </div>' +
      '        <div class="weather-temperature">{{widget.data.temperature}}</div>' +
      '        <div class="weather-condition">{{widget.data.condition}}</div>' +
      '        <div class="weather-location">{{widget.data.location}}</div>' +
      '        <div class="weather-high-low">{{widget.data.highLow}}</div>' +
      '        <p class="weather-summary">{{widget.data.summary}}</p>' +
      '        <div class="weather-stats">' +
      '          <div class="weather-stat" ng-repeat="item in widget.data.details track by item.label">' +
      '            <span>{{item.label}}</span>' +
      '            <strong>{{item.value}}</strong>' +
      '          </div>' +
      '        </div>' +
      '      </article>' +
      '      <div class="canvas-empty-state" ng-if="!$ctrl.widgets.length">' +
      '        <div>' +
      '          <h3>Blank dashboard</h3>' +
      '          <p>Add a weather widget to start shaping this personal briefing.</p>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </section>' +
      '  <div class="modal-shell" ng-if="$ctrl.ui.dashboardModalMode" ng-click="$ctrl.closeModal()">' +
      '    <div class="modal-card" role="dialog" aria-modal="true" ng-click="$event.stopPropagation()">' +
      '      <div class="eyebrow">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create Dashboard" : "Configure Dashboard" }}</div>' +
      '      <h2 class="modal-title">{{ $ctrl.ui.dashboardModalMode === "create" ? "New dashboard" : "Edit dashboard" }}</h2>' +
      '      <p class="modal-copy">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create a fresh, empty dashboard and start placing widgets." : "Update the current dashboard name and description." }}</p>' +
      '      <form ng-submit="$ctrl.submitDashboardModal()">' +
      '        <label class="form-label" for="modalDashboardName">Dashboard name</label>' +
      '        <input id="modalDashboardName" class="form-control form-control-lg" type="text" ng-model="$ctrl.modalForm.name" placeholder="Weekend Reset" required />' +
      '        <label class="form-label mt-3" for="modalDashboardDescription">Description</label>' +
      '        <textarea id="modalDashboardDescription" class="form-control" rows="4" ng-model="$ctrl.modalForm.description" placeholder="A slower view with weather, errands, and family plans."></textarea>' +
      '        <div class="modal-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeModal()">Cancel</button>' +
      '          <button type="submit" class="btn btn-primary">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create" : "Save" }}</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '  </div>' +
      '  <div class="drawer-shell" ng-if="$ctrl.isEditing && $ctrl.ui.widgetPanelOpen" ng-click="$ctrl.closeWidgetPanel()">' +
      '    <aside class="widget-drawer" ng-click="$event.stopPropagation()">' +
      '      <div class="d-flex align-items-start justify-content-between gap-3">' +
      '        <div>' +
      '          <div class="eyebrow">Widget Library</div>' +
      '          <h2 class="modal-title mb-2">Add a widget</h2>' +
      '          <p class="modal-copy mb-0">We are planning for a broader catalog. For now, weather is the first live option.</p>' +
      '        </div>' +
      '        <button type="button" class="btn btn-outline-secondary icon-button" ng-click="$ctrl.closeWidgetPanel()" aria-label="Close widget panel">&times;</button>' +
      '      </div>' +
      '      <div class="widget-library-grid">' +
      '        <button type="button" class="widget-library-card widget-library-card--active" ng-click="$ctrl.addWeatherWidget()">' +
      '          <span class="widget-library-card__icon">W</span>' +
      '          <strong>Weather</strong>' +
      '          <span>Mocked daily forecast</span>' +
      '        </button>' +
      '        <div class="widget-library-card widget-library-card--placeholder" ng-repeat="item in $ctrl.widgetCatalog track by item.id" ng-if="item.type === \'placeholder\'">' +
      '          <span class="widget-library-card__icon widget-library-card__icon--placeholder"></span>' +
      '          <strong>Coming soon</strong>' +
      '          <span>Reserved widget slot</span>' +
      '        </div>' +
      '      </div>' +
      '    </aside>' +
      '  </div>' +
      '</section>',
    controller: DashboardPageController
  });

  DashboardPageController.$inject = ['DashboardService', 'WidgetService', 'UiShellService', '$scope'];

  function DashboardPageController(DashboardService, WidgetService, UiShellService, $scope) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isEditing = false;
    $ctrl.ui = UiShellService.state;
    $ctrl.modalForm = {};
    $ctrl.widgetCatalog = buildWidgetCatalog();

    $ctrl.$onInit = function onInit() {
      syncState();
      bindUiWatchers();
      $ctrl.ready = true;
    };

    $ctrl.openEditDashboardModal = function openEditDashboardModal() {
      if (!$ctrl.activeDashboard) {
        return;
      }

      UiShellService.openDashboardModal('edit');
    };

    $ctrl.closeModal = function closeModal() {
      UiShellService.closeDashboardModal();
    };

    $ctrl.submitDashboardModal = function submitDashboardModal() {
      if (!$ctrl.modalForm.name) {
        return;
      }

      if ($ctrl.ui.dashboardModalMode === 'create') {
        DashboardService.create({
          name: $ctrl.modalForm.name,
          description: $ctrl.modalForm.description
        });
      } else if ($ctrl.activeDashboard) {
        DashboardService.update($ctrl.activeDashboard.id, {
          name: $ctrl.modalForm.name,
          description: $ctrl.modalForm.description
        });
      }

      $ctrl.closeModal();
      syncState();
    };

    $ctrl.selectDashboard = function selectDashboard(dashboardId) {
      DashboardService.setActive(dashboardId);
      $ctrl.isEditing = false;
      UiShellService.closeWidgetPanel();
      syncState();
    };

    $ctrl.toggleEditing = function toggleEditing() {
      $ctrl.isEditing = !$ctrl.isEditing;

      if (!$ctrl.isEditing) {
        UiShellService.closeWidgetPanel();
      }
    };

    $ctrl.openWidgetPanel = function openWidgetPanel() {
      if (!$ctrl.isEditing) {
        return;
      }

      UiShellService.openWidgetPanel();
    };

    $ctrl.closeWidgetPanel = function closeWidgetPanel() {
      UiShellService.closeWidgetPanel();
    };

    $ctrl.addWeatherWidget = function addWeatherWidget() {
      if (!$ctrl.activeDashboard) {
        return;
      }

      WidgetService.addWeatherWidget($ctrl.activeDashboard.id);
      UiShellService.closeWidgetPanel();
      syncState();
    };

    $ctrl.persistWidgetPosition = function persistWidgetPosition(widget) {
      WidgetService.updatePosition($ctrl.activeDashboard.id, widget.id, widget.x, widget.y);
    };

    function syncState() {
      $ctrl.dashboards = DashboardService.list();
      $ctrl.activeDashboard = DashboardService.getActive();
      $ctrl.widgets = $ctrl.activeDashboard
        ? WidgetService.listForDashboard($ctrl.activeDashboard.id)
        : [];
    }

    function bindUiWatchers() {
      $scope.$watch(
        function watchDashboardModalMode() {
          return $ctrl.ui.dashboardModalMode;
        },
        function handleDashboardModalMode(mode) {
          if (mode === 'create') {
            $ctrl.modalForm = {
              name: '',
              description: ''
            };
          }

          if (mode === 'edit' && $ctrl.activeDashboard) {
            $ctrl.modalForm = {
              name: $ctrl.activeDashboard.name,
              description: $ctrl.activeDashboard.description
            };
          }
        }
      );
    }

    function buildWidgetCatalog() {
      var placeholders = [];
      var index;

      for (index = 0; index < 19; index += 1) {
        placeholders.push({
          id: 'placeholder-' + index,
          name: 'Coming Soon',
          type: 'placeholder'
        });
      }

      return [
        {
          id: 'weather',
          name: 'Weather',
          description: 'Mocked daily conditions and outlook.',
          type: 'weather'
        }
      ].concat(placeholders);
    }
  }
})();
