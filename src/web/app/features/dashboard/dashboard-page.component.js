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
      '          <button type="button" class="btn btn-outline-light icon-button" ng-click="$ctrl.openEditDashboardModal()" aria-label="Configure dashboard"><i class="fa-solid fa-gear" aria-hidden="true"></i></button>' +
      '          <button type="button" class="btn btn-light text-dark" ng-click="$ctrl.toggleEditing()">{{ $ctrl.isEditing ? "Save Dashboard" : "Edit Dashboard" }}</button>' +
      '          <button type="button" class="btn btn-outline-light" ng-if="$ctrl.isEditing" ng-click="$ctrl.openWidgetPanel()">+ Widget</button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dashboard-canvas" ng-class="{\'dashboard-canvas--editing\': $ctrl.isEditing}">' +
      '      <article class="widget-card" ng-class="$ctrl.getWidgetCardClass(widget)" ng-repeat="widget in $ctrl.widgets track by widget.id" draggable-widget widget="widget" enabled="$ctrl.isEditing" on-move="$ctrl.persistWidgetPosition(widget)" on-resize="$ctrl.persistWidgetSize(widget)" ng-style="{ width: widget.width + \'px\', height: widget.height + \'px\' }">' +
      '        <div class="widget-handle">' +
      '          <div>' +
      '            <div class="widget-label">{{$ctrl.getWidgetLabel(widget)}}</div>' +
      '            <h3 class="widget-title">{{widget.title}}</h3>' +
      '          </div>' +
      '          <span class="drag-pill" ng-if="$ctrl.isEditing">Drag</span>' +
      '        </div>' +
      '        <div class="widget-content" widget-renderer widget="widget"></div>' +
      '        <div class="widget-resize-handle" ng-if="$ctrl.isEditing && $ctrl.isWidgetResizable(widget)" aria-hidden="true"></div>' +
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
      '        <button type="button" class="btn btn-outline-secondary icon-button" ng-click="$ctrl.closeWidgetPanel()" aria-label="Close widget panel"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>' +
      '      </div>' +
      '      <div class="widget-library-grid">' +
      '        <button type="button" class="widget-library-card widget-library-card--active" ng-repeat="definition in $ctrl.widgetDefinitions track by definition.type" ng-click="$ctrl.addWidget(definition.type)">' +
      '          <span class="widget-library-card__icon"><i ng-class="definition.iconClass" aria-hidden="true"></i></span>' +
      '          <strong>{{definition.name}}</strong>' +
      '          <span>{{definition.description}}</span>' +
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

  DashboardPageController.$inject = ['DashboardService', 'WidgetService', 'WidgetRegistryService', 'UiShellService', '$scope'];

  function DashboardPageController(DashboardService, WidgetService, WidgetRegistryService, UiShellService, $scope) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isEditing = false;
    $ctrl.ui = UiShellService.state;
    $ctrl.modalForm = {};
    $ctrl.widgetDefinitions = WidgetRegistryService.list();
    $ctrl.widgetCatalog = buildWidgetCatalog();

    $ctrl.$onInit = function onInit() {
      bindUiWatchers();
      DashboardService.load().then(function handleDashboardLoad() {
        return syncState();
      }).finally(function markReady() {
        $ctrl.ready = true;
      });
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
      var isCreateMode = $ctrl.ui.dashboardModalMode === 'create';
      var request;

      if (!$ctrl.modalForm.name) {
        return;
      }

      if (isCreateMode) {
        request = DashboardService.create({
          name: $ctrl.modalForm.name,
          description: $ctrl.modalForm.description
        });
      } else if ($ctrl.activeDashboard) {
        request = DashboardService.update($ctrl.activeDashboard.id, {
          name: $ctrl.modalForm.name,
          description: $ctrl.modalForm.description
        });
      }

      if (!request) {
        return;
      }

      request.then(function handleDashboardSave() {
        persistDashboard().then(function handlePersistedDashboard() {
          $ctrl.closeModal();
          syncState().then(function handleStateSync() {
            $ctrl.isEditing = isCreateMode;
          });
        });
      });
    };

    $ctrl.selectDashboard = function selectDashboard(dashboardId) {
      DashboardService.setActive(dashboardId);
      $ctrl.isEditing = false;
      UiShellService.closeWidgetPanel();
      syncState();
    };

    $ctrl.toggleEditing = function toggleEditing() {
      if ($ctrl.isEditing) {
        persistDashboard().then(function handlePersistedDashboard() {
          $ctrl.isEditing = false;
          UiShellService.closeWidgetPanel();
        });
        return;
      }

      $ctrl.isEditing = true;
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

    $ctrl.addWidget = function addWidget(type) {
      if (!$ctrl.activeDashboard) {
        return;
      }

      WidgetService.addWidget($ctrl.activeDashboard.id, type).then(function handleWidgetAdded() {
        UiShellService.closeWidgetPanel();
        syncState();
      });
    };

    $ctrl.persistWidgetPosition = function persistWidgetPosition(widget) {
      WidgetService.updatePosition($ctrl.activeDashboard.id, widget.id, widget.x, widget.y);
    };

    $ctrl.persistWidgetSize = function persistWidgetSize(widget) {
      WidgetService.updateSize($ctrl.activeDashboard.id, widget.id, widget.width, widget.height);
    };

    $ctrl.getWidgetCardClass = function getWidgetCardClass(widget) {
      var definition = WidgetRegistryService.get(widget.type);

      return definition ? definition.cardClass : '';
    };

    $ctrl.getWidgetLabel = function getWidgetLabel(widget) {
      var definition = WidgetRegistryService.get(widget.type);

      return definition ? definition.label : widget.type + ' widget';
    };

    $ctrl.isWidgetResizable = function isWidgetResizable(widget) {
      var definition = WidgetRegistryService.get(widget.type);

      return !!(definition && definition.resizable && definition.resizable.vertical);
    };

    function syncState() {
      $ctrl.dashboards = DashboardService.list();
      $ctrl.activeDashboard = DashboardService.getActive();

      if (!$ctrl.activeDashboard) {
        $ctrl.widgets = [];
        return Promise.resolve([]);
      }

      $ctrl.widgets = WidgetService.listForDashboard($ctrl.activeDashboard.id);

      return WidgetService.loadForDashboard($ctrl.activeDashboard.id).then(function handleWidgetLoad(widgets) {
        $ctrl.widgets = widgets;
        return widgets;
      });
    }

    function persistDashboard() {
      if (!$ctrl.activeDashboard) {
        return Promise.resolve([]);
      }

      return WidgetService.saveDashboardWidgets($ctrl.activeDashboard.id);
    }

    function bindUiWatchers() {
      $scope.$watch(
        function watchActiveDashboardId() {
          return DashboardService.getActiveId();
        },
        function handleActiveDashboardIdChange() {
          syncState();
        }
      );

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
      var definitionCount = $ctrl.widgetDefinitions ? $ctrl.widgetDefinitions.length : 0;

      for (index = 0; index < 20 - definitionCount; index += 1) {
        placeholders.push({
          id: 'placeholder-' + index,
          name: 'Coming Soon',
          type: 'placeholder'
        });
      }

      return placeholders;
    }
  }
})();
