(function () {
  'use strict';

  angular.module('morningBriefingApp').component('dashboardPage', {
    template:
      '<section class="dashboard-workspace" ng-if="$ctrl.ready">' +
      '  <section class="dashboard-stage" ng-if="$ctrl.activeDashboard">' +
      '    <div class="stage-toolbar d-flex flex-column gap-2">' +
      '      <div class="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-2">' +
      '        <div class="stage-heading">' +
      '          <div class="stage-kicker">Dashboard</div>' +
      '          <h1 class="stage-title stage-title--compact">{{$ctrl.activeDashboard.name}}</h1>' +
      '          <p class="stage-copy stage-copy--compact mb-0" ng-if="$ctrl.activeDashboard.description">{{$ctrl.activeDashboard.description}}</p>' +
      '          <p class="stage-copy stage-copy--compact mb-0" ng-if="!$ctrl.activeDashboard.description">Blank dashboard ready for widgets.</p>' +
      '        </div>' +
      '        <div class="header-controls d-flex flex-wrap align-items-center justify-content-xl-end gap-2">' +
      '          <section class="audio-briefing-panel audio-briefing-panel--compact" ng-class="{\'audio-briefing-panel--disabled\': !$ctrl.audioBriefingPreferences.enabled}">' +
      '            <div class="audio-briefing-panel__main">' +
      '              <div class="audio-briefing-panel__header">' +
      '                <div class="widget-label">Audio Briefing</div>' +
      '                <div class="audio-briefing-panel__copy audio-briefing-panel__copy--compact">{{ $ctrl.getAudioBriefingStatusLabel() }}</div>' +
      '              </div>' +
      '              <div class="audio-briefing-panel__status">' +
      '                <span class="audio-briefing-chip" ng-if="$ctrl.audioBriefing && $ctrl.audioBriefing.estimatedDurationSeconds">{{ $ctrl.formatDuration($ctrl.audioBriefing.estimatedDurationSeconds) }}</span>' +
      '                <span class="audio-briefing-chip" ng-if="$ctrl.audioBriefing && $ctrl.audioBriefing.generatedAt">{{ $ctrl.formatTimestamp($ctrl.audioBriefing.generatedAt) }}</span>' +
      '              </div>' +
      '            </div>' +
      '            <div class="audio-briefing-panel__actions">' +
      '              <button type="button" class="btn btn-light text-dark btn-sm" ng-click="$ctrl.toggleAudioPlayback()" ng-disabled="!$ctrl.canPlayAudioBriefing()">' +
      '                <i class="fa-solid" ng-class="$ctrl.isAudioPlaying ? \'fa-pause\' : \'fa-play\'" aria-hidden="true"></i>' +
      '              </button>' +
      '              <button type="button" class="btn btn-outline-light btn-sm" ng-click="$ctrl.generateAudioBriefing(true)" ng-disabled="$ctrl.isGeneratingAudioBriefing || !$ctrl.audioBriefingPreferences.enabled">' +
      '                <i class="fa-solid" ng-class="$ctrl.isGeneratingAudioBriefing ? \'fa-spinner fa-spin\' : \'fa-wave-square\'" aria-hidden="true"></i>' +
      '              </button>' +
      '            </div>' +
      '          </section>' +
      '          <button type="button" class="btn btn-outline-light icon-button" ng-if="$ctrl.isEditing" ng-click="$ctrl.openEditDashboardModal()" aria-label="Configure dashboard"><i class="fa-solid fa-gear" aria-hidden="true"></i></button>' +
      '          <button type="button" class="btn btn-light text-dark" ng-click="$ctrl.toggleEditing()">{{ $ctrl.isEditing ? "Save Dashboard" : "Edit Dashboard" }}</button>' +
      '          <button type="button" class="btn btn-outline-light" ng-if="$ctrl.isEditing" ng-click="$ctrl.openWidgetPanel()">+ Widget</button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="dashboard-canvas" ng-class="{\'dashboard-canvas--editing\': $ctrl.isEditing}">' +
      '      <article class="widget-card" ng-class="$ctrl.getWidgetCardClass(widget)" ng-repeat="widget in $ctrl.widgets track by widget.id" draggable-widget widget="widget" enabled="$ctrl.isEditing" on-move="$ctrl.persistWidgetPosition(widget)" on-resize="$ctrl.persistWidgetSize(widget)" ng-style="{ width: widget.width + \'px\', height: widget.height + \'px\' }">' +
      '        <button type="button" class="btn btn-outline-light icon-button widget-refresh-button" ng-class="{\'widget-refresh-button--visible\': $ctrl.isRefreshingWidget(widget)}" ng-click="$ctrl.refreshWidget(widget, $event)" ng-disabled="$ctrl.isRefreshingWidget(widget)" aria-label="Refresh widget snapshot">' +
      '          <i class="fa-solid" ng-class="$ctrl.isRefreshingWidget(widget) ? \'fa-spinner fa-spin\' : \'fa-rotate-right\'" aria-hidden="true"></i>' +
      '        </button>' +
      '        <div class="widget-handle">' +
      '          <div>' +
      '            <div class="widget-label">{{$ctrl.getWidgetLabel(widget)}}</div>' +
      '            <h3 class="widget-title">{{widget.title}}</h3>' +
      '          </div>' +
      '          <button type="button" class="btn btn-outline-light icon-button widget-config-button" ng-if="$ctrl.isEditing" ng-mousedown="$event.stopPropagation()" ng-click="$ctrl.openWidgetConfigModal(widget, $event)" aria-label="Configure widget"><i class="fa-solid fa-gear" aria-hidden="true"></i></button>' +
      '        </div>' +
      '        <div class="widget-content" widget-renderer widget="widget"></div>' +
      '        <div class="widget-resize-handle" ng-if="$ctrl.isEditing && $ctrl.isWidgetResizable(widget)" aria-hidden="true"></div>' +
      '      </article>' +
      '      <div class="canvas-empty-state" ng-if="!$ctrl.widgets.length">' +
      '        <div>' +
      '          <h3>Blank dashboard</h3>' +
      '          <p>Add a widget to start shaping this personal briefing.</p>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </section>' +
      '  <section class="dashboard-stage" ng-if="!$ctrl.activeDashboard">' +
      '    <div class="canvas-empty-state canvas-empty-state--standalone">' +
      '      <div>' +
      '        <h3>No dashboards yet</h3>' +
      '        <p>Create a dashboard to start building your morning briefing.</p>' +
      '        <button type="button" class="btn btn-primary" ng-click="$ctrl.openCreateDashboardModal()">Create dashboard</button>' +
      '      </div>' +
      '    </div>' +
      '  </section>' +
      '  <div class="modal-shell" ng-if="$ctrl.ui.dashboardModalMode" ng-click="$ctrl.closeModal()">' +
      '    <div class="modal-card" role="dialog" aria-modal="true" ng-click="$event.stopPropagation()">' +
      '      <div class="eyebrow">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create Dashboard" : "Configure Dashboard" }}</div>' +
      '      <h2 class="modal-title">{{ $ctrl.ui.dashboardModalMode === "create" ? "New dashboard" : "Edit dashboard" }}</h2>' +
      '      <p class="modal-copy">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create a fresh, empty dashboard and start placing widgets." : "Update the current dashboard name and description, then tune the dashboard-level Audio Briefing." }}</p>' +
      '      <form ng-submit="$ctrl.submitDashboardModal()">' +
      '        <label class="form-label" for="modalDashboardName">Dashboard name</label>' +
      '        <input id="modalDashboardName" class="form-control form-control-lg" type="text" ng-model="$ctrl.modalForm.name" placeholder="Weekend Reset" required />' +
      '        <label class="form-label mt-3" for="modalDashboardDescription">Description</label>' +
      '        <textarea id="modalDashboardDescription" class="form-control" rows="4" ng-model="$ctrl.modalForm.description" placeholder="A slower view with weather, errands, and family plans."></textarea>' +
      '        <div class="audio-settings" ng-if="$ctrl.ui.dashboardModalMode === \'edit\'">' +
      '          <div class="eyebrow mt-4">Audio Briefing</div>' +
      '          <label class="form-check mt-2">' +
      '            <input class="form-check-input" type="checkbox" ng-model="$ctrl.modalForm.audioBriefing.enabled" />' +
      '            <span class="form-check-label">Enable Audio Briefing for this dashboard</span>' +
      '          </label>' +
      '          <label class="form-label mt-3" for="audioBriefingDuration">Target duration (seconds)</label>' +
      '          <input id="audioBriefingDuration" class="form-control" type="number" min="30" max="180" step="5" ng-model="$ctrl.modalForm.audioBriefing.targetDurationSeconds" />' +
      '          <label class="form-label mt-3" for="audioBriefingTone">Tone</label>' +
      '          <input id="audioBriefingTone" class="form-control" type="text" ng-model="$ctrl.modalForm.audioBriefing.tone" placeholder="calm, concise, professional" />' +
      '          <label class="form-label mt-3" for="audioBriefingVoice">Voice</label>' +
      '          <select id="audioBriefingVoice" class="form-select" ng-model="$ctrl.modalForm.audioBriefing.voiceName">' +
      '            <option value="default">Default voice</option>' +
      '          </select>' +
      '        </div>' +
      '        <div class="modal-actions">' +
      '          <button type="button" class="btn btn-outline-danger me-auto" ng-if="$ctrl.ui.dashboardModalMode === \'edit\'" ng-click="$ctrl.archiveDashboard()">Delete dashboard</button>' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeModal()">Cancel</button>' +
      '          <button type="submit" class="btn btn-primary">{{ $ctrl.ui.dashboardModalMode === "create" ? "Create" : "Save" }}</button>' +
      '        </div>' +
      '      </form>' +
      '    </div>' +
      '  </div>' +
      '  <div class="modal-shell" ng-if="$ctrl.widgetConfig.isOpen" ng-click="$ctrl.closeWidgetConfigModal()">' +
      '    <div class="modal-card widget-config-modal" role="dialog" aria-modal="true" ng-click="$event.stopPropagation()">' +
      '      <div class="eyebrow">Widget Settings</div>' +
      '      <h2 class="modal-title">{{ $ctrl.getWidgetConfigTitle() }}</h2>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.widget.type === \'weather\'">Pick the city this weather widget should use. Search results come from our reference city catalog.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.widget.type === \'tasks\'">Choose which connection should power this task list. The selection is staged here and persisted when you click Save Dashboard.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.widget.type === \'calendar\'">Choose which connection should power this calendar. The selection is staged here and persisted when you click Save Dashboard.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.widget.type === \'news\'">Choose which LLM connection should summarize the configured RSS feeds for this widget. The selection is staged here and persisted when you click Save Dashboard.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.widget.type !== \'weather\' && $ctrl.widgetConfig.widget.type !== \'tasks\' && $ctrl.widgetConfig.widget.type !== \'calendar\' && $ctrl.widgetConfig.widget.type !== \'news\'">This widget type does not have configurable settings yet.</p>' +
      '      <form ng-if="$ctrl.widgetConfig.widget.type === \'weather\'" ng-submit="$ctrl.searchCities()">' +
      '        <label class="form-label" for="weatherLocationSearch">Location</label>' +
      '        <div class="d-flex gap-2">' +
      '          <input id="weatherLocationSearch" class="form-control form-control-lg" type="text" ng-model="$ctrl.widgetConfig.cityQuery" placeholder="Search for a city" required />' +
      '          <button type="submit" class="btn btn-primary">Search</button>' +
      '        </div>' +
      '      </form>' +
      '      <div ng-if="$ctrl.widgetSupportsConnections()">' +
      '        <label class="form-label" for="widgetConnectionSelect">Connection</label>' +
      '        <div class="widget-config-inline">' +
      '          <select id="widgetConnectionSelect" class="form-select form-select-lg" ng-model="$ctrl.widgetConfig.selectedConnectionId" ng-options="connection.id as connection.name for connection in $ctrl.widgetConfig.availableConnections">' +
      '            <option value="">Select a connection</option>' +
      '          </select>' +
      '          <button type="button" class="btn btn-outline-light" ng-click="$ctrl.openCreateConnectionModal()">Create new connection</button>' +
      '        </div>' +
      '        <p class="widget-config-helper" ng-if="$ctrl.widgetConfig.isLoadingConnections">Loading connections...</p>' +
      '      </div>' +
      '      <p class="widget-config-selected" ng-if="$ctrl.widgetConfig.selectedCity">Selected city: <strong>{{ $ctrl.getSelectedCityDisplayName($ctrl.widgetConfig.selectedCity) }}</strong></p>' +
      '      <p class="widget-config-selected" ng-if="$ctrl.widgetSupportsConnections() && $ctrl.getSelectedConnection()">Selected connection: <strong>{{ $ctrl.getSelectedConnection().name }}</strong></p>' +
      '      <label class="form-check mt-3">' +
      '        <input class="form-check-input" type="checkbox" ng-model="$ctrl.widgetConfig.includeInBriefing" />' +
      '        <span class="form-check-label">Include in Audio Briefing</span>' +
      '      </label>' +
      '      <p class="widget-config-helper">This dashboard-level summary uses structured widget snapshots, not rendered widget text.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.isSearching">Searching cities...</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.widgetConfig.hasSearched && !$ctrl.widgetConfig.isSearching && !$ctrl.widgetConfig.searchResults.length">No matching cities were found.</p>' +
      '      <div class="widget-config-results" ng-if="$ctrl.widgetConfig.searchResults.length">' +
      '        <button type="button" class="widget-config-result" ng-class="{\'widget-config-result--active\': $ctrl.isSelectedCity(city)}" ng-repeat="city in $ctrl.widgetConfig.searchResults track by city.id" ng-click="$ctrl.selectCity(city)">' +
      '          <strong>{{ city.displayName }}</strong>' +
      '          <span>{{ city.timezone }}</span>' +
      '        </button>' +
      '      </div>' +
      '      <div class="modal-actions">' +
      '        <button type="button" class="btn btn-outline-danger me-auto" ng-if="$ctrl.widgetConfig.widget" ng-click="$ctrl.removeWidget()">Remove widget</button>' +
      '        <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeWidgetConfigModal()">Cancel</button>' +
      '        <button type="button" class="btn btn-primary" ng-if="$ctrl.widgetConfig.widget.type === \'weather\'" ng-disabled="!$ctrl.widgetConfig.selectedCity" ng-click="$ctrl.saveWidgetConfig()">Save</button>' +
      '        <button type="button" class="btn btn-primary" ng-if="$ctrl.widgetSupportsConnections()" ng-disabled="!$ctrl.widgetConfig.selectedConnectionId" ng-click="$ctrl.saveWidgetConfig()">Save</button>' +
      '        <button type="button" class="btn btn-primary" ng-if="$ctrl.widgetConfig.widget.type !== \'weather\' && !$ctrl.widgetSupportsConnections()" ng-click="$ctrl.saveWidgetConfig()">Save</button>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="modal-shell" ng-if="$ctrl.connectionModal.isOpen" ng-click="$ctrl.closeCreateConnectionModal()">' +
      '    <div class="modal-card connection-modal" role="dialog" aria-modal="true" ng-click="$event.stopPropagation()">' +
      '      <div class="eyebrow">Create Connection</div>' +
      '      <h2 class="modal-title">New connection</h2>' +
      '      <p class="modal-copy" ng-if="$ctrl.connectionModal.provider === \'todoist\'">Create a Todoist connection by entering its API key.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.connectionModal.provider === \'google-calendar\'">Connect Google Calendar with OAuth so private calendars can be read securely.</p>' +
      '      <p class="modal-copy" ng-if="$ctrl.connectionModal.provider === \'openai\'">Create an OpenAI connection with an API key, model, and optional base URL.</p>' +
      '      <form ng-submit="$ctrl.saveNewConnection()" ng-if="$ctrl.connectionModal.provider === \'todoist\'">' +
        '        <label class="form-label" for="connectionApiKey">Todoist API Key</label>' +
        '        <input id="connectionApiKey" class="form-control form-control-lg" type="password" ng-model="$ctrl.connectionModal.apiKey" placeholder="Enter your Todoist API Key" required />' +
      '        <div class="modal-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeCreateConnectionModal()">Cancel</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.connectionModal.isSaving || !$ctrl.canSaveConnection()">Save</button>' +
      '        </div>' +
      '      </form>' +
      '      <div ng-if="$ctrl.connectionModal.provider === \'google-calendar\'">' +
      '        <p class="widget-config-helper">You will be redirected to Google, then returned here after access is granted.</p>' +
      '        <div class="modal-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeCreateConnectionModal()">Cancel</button>' +
      '          <button type="button" class="btn btn-primary" ng-click="$ctrl.startGoogleCalendarOAuth()">Continue with Google</button>' +
      '        </div>' +
      '      </div>' +
      '      <form ng-submit="$ctrl.saveNewConnection()" ng-if="$ctrl.connectionModal.provider === \'openai\'">' +
      '        <label class="form-label" for="openAiApiKey">OpenAI API Key</label>' +
      '        <input id="openAiApiKey" class="form-control form-control-lg" type="password" ng-model="$ctrl.connectionModal.apiKey" placeholder="sk-..." required />' +
      '        <label class="form-label mt-3" for="openAiModel">Model</label>' +
      '        <input id="openAiModel" class="form-control form-control-lg" type="text" ng-model="$ctrl.connectionModal.model" placeholder="gpt-5-mini" required />' +
      '        <label class="form-label mt-3" for="openAiBaseUrl">Base URL</label>' +
      '        <input id="openAiBaseUrl" class="form-control form-control-lg" type="text" ng-model="$ctrl.connectionModal.baseUrl" placeholder="https://api.openai.com" />' +
      '        <div class="modal-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.closeCreateConnectionModal()">Cancel</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.connectionModal.isSaving || !$ctrl.canSaveConnection()">Save</button>' +
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
      '          <p class="modal-copy mb-0">Weather, news, tasks, calendar, and xkcd are ready to place. More widgets can slot into this same library later.</p>' +
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

  DashboardPageController.$inject = ['DashboardService', 'DashboardSnapshotService', 'AudioBriefingService', 'ConnectionService', 'WidgetService', 'WidgetRegistryService', 'ReferenceDataService', 'UiShellService', 'NotificationService', '$scope', '$window', '$q', '$location'];

  function DashboardPageController(DashboardService, DashboardSnapshotService, AudioBriefingService, ConnectionService, WidgetService, WidgetRegistryService, ReferenceDataService, UiShellService, NotificationService, $scope, $window, $q, $location) {
    var $ctrl = this;
    var hasCompletedInitialStateLoad = false;
    var pendingWidgetOAuthResult = readPendingWidgetOAuthResult();
    var audioElement = null;
    var audioPlaybackUrl = '';

    $ctrl.ready = false;
    $ctrl.isEditing = false;
    $ctrl.ui = UiShellService.state;
    $ctrl.modalForm = {};
    $ctrl.widgetDefinitions = WidgetRegistryService.list();
    $ctrl.widgetCatalog = buildWidgetCatalog();
    $ctrl.widgetConfig = buildEmptyWidgetConfigState();
    $ctrl.connectionModal = buildEmptyConnectionModalState();
    $ctrl.refreshingWidgetId = '';
    $ctrl.audioBriefing = null;
    $ctrl.audioBriefingPreferences = buildDefaultAudioBriefingPreferences();
    $ctrl.isGeneratingAudioBriefing = false;
    $ctrl.isAudioPlaying = false;
    $ctrl.isAudioLoading = false;

    $ctrl.$onInit = function onInit() {
      bindUiWatchers();
      DashboardService.load().then(function handleDashboardLoad() {
        $ctrl.ready = true;
        return syncState().then(function handleInitialSync() {
          return restoreWidgetOAuthFlowIfPresent();
        });
      }).catch(function handleDashboardLoadError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to load dashboards right now.'), 'Unable to load dashboard');
      }).finally(function markReady() {
        hasCompletedInitialStateLoad = true;
        $ctrl.ready = true;
      });
    };

    $ctrl.$onDestroy = function onDestroy() {
      if (audioElement) {
        audioElement.pause();
        audioElement = null;
      }

      releaseAudioPlaybackUrl();
    };

    $ctrl.openEditDashboardModal = function openEditDashboardModal() {
      if (!$ctrl.activeDashboard) {
        return;
      }

      UiShellService.openDashboardModal('edit');
    };

    $ctrl.openCreateDashboardModal = function openCreateDashboardModal() {
      UiShellService.openDashboardModal('create');
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
          var preferencesRequest = isCreateMode || !$ctrl.activeDashboard
            ? $q.resolve()
            : AudioBriefingService.updatePreferences($ctrl.activeDashboard.id, $ctrl.modalForm.audioBriefing || {});

          preferencesRequest.then(function handleSavedPreferences() {
            $ctrl.closeModal();
            syncState().then(function handleStateSync() {
              $ctrl.isEditing = isCreateMode;
            });
          });
        });
      }).catch(function handleDashboardSaveError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to save the dashboard right now.'), 'Unable to save dashboard');
      });
    };

    $ctrl.archiveDashboard = function archiveDashboard() {
      if (!$ctrl.activeDashboard || $ctrl.ui.dashboardModalMode !== 'edit') {
        return;
      }

      if (!window.confirm('Archive this dashboard? Its widgets will be archived too, but existing data will be kept.')) {
        return;
      }

      DashboardService.archive($ctrl.activeDashboard.id).then(function handleArchivedDashboard() {
        $ctrl.isEditing = false;
        $ctrl.closeWidgetConfigModal();
        UiShellService.closeWidgetPanel();
        $ctrl.closeModal();
        return syncState();
      }).catch(function handleArchiveDashboardError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to archive the dashboard right now.'), 'Unable to archive dashboard');
      });
    };

    $ctrl.selectDashboard = function selectDashboard(dashboardId) {
      DashboardService.setActive(dashboardId);
      $ctrl.isEditing = false;
      $ctrl.closeWidgetConfigModal();
      UiShellService.closeWidgetPanel();
      syncState();
    };

    $ctrl.toggleEditing = function toggleEditing() {
      if ($ctrl.isEditing) {
        persistDashboard().then(function handlePersistedDashboard() {
          $ctrl.isEditing = false;
          $ctrl.closeWidgetConfigModal();
          UiShellService.closeWidgetPanel();
          syncState();
        }).catch(function handlePersistError(error) {
          NotificationService.error(getErrorMessage(error, 'Unable to save dashboard layout right now.'), 'Unable to save dashboard');
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

    $ctrl.openWidgetConfigModal = function openWidgetConfigModal(widget, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      if (!$ctrl.isEditing || !widget) {
        return;
      }

      $ctrl.widgetConfig = {
        isOpen: true,
        widget: widget,
        cityQuery: getSelectedCityDisplayName(widget.config && widget.config.location),
        searchResults: [],
        selectedCity: widget.config && widget.config.location ? angular.copy(widget.config.location) : null,
        includeInBriefing: widget.includeInBriefing,
        availableConnections: [],
        selectedConnectionId: widget.config && widget.config.connectionId ? widget.config.connectionId : '',
        isLoadingConnections: false,
        isSearching: false,
        hasSearched: false
      };

      if (widgetSupportsConnections(widget.type)) {
        loadConnectionsForWidget(widget.type);
      }
    };

    $ctrl.closeWidgetConfigModal = function closeWidgetConfigModal() {
      $ctrl.widgetConfig = buildEmptyWidgetConfigState();
      $ctrl.connectionModal = buildEmptyConnectionModalState();
    };

    $ctrl.searchCities = function searchCities() {
      if ($ctrl.widgetConfig.widget.type !== 'weather') {
        return;
      }

      $ctrl.widgetConfig.isSearching = true;
      $ctrl.widgetConfig.hasSearched = false;

      ReferenceDataService.searchCities($ctrl.widgetConfig.cityQuery).then(function handleResults(items) {
        $ctrl.widgetConfig.searchResults = items;
        $ctrl.widgetConfig.hasSearched = true;
      }).catch(function handleError() {
        $ctrl.widgetConfig.searchResults = [];
        $ctrl.widgetConfig.hasSearched = true;
        NotificationService.error('Reference city search is currently unavailable.', 'City search failed');
      }).finally(function clearSearching() {
        $ctrl.widgetConfig.isSearching = false;
      });
    };

    $ctrl.selectCity = function selectCity(city) {
      $ctrl.widgetConfig.selectedCity = angular.copy(city);
    };

    $ctrl.isSelectedCity = function isSelectedCity(city) {
      return !!($ctrl.widgetConfig.selectedCity && city && $ctrl.widgetConfig.selectedCity.id === city.id);
    };

    $ctrl.getSelectedCityDisplayName = getSelectedCityDisplayName;
    $ctrl.getWidgetConfigTitle = getWidgetConfigTitle;
    $ctrl.getSelectedConnection = getSelectedConnection;
    $ctrl.widgetSupportsConnections = widgetSupportsConnections;
    $ctrl.canSaveConnection = canSaveConnection;

    $ctrl.saveWidgetConfig = function saveWidgetConfig() {
      var widget = $ctrl.widgetConfig.widget;

      if (!widget) {
        return;
      }

      widget.config = widget.config || {};
      widget.includeInBriefingOverride = $ctrl.widgetConfig.includeInBriefing === widget.includeInBriefingDefault
        ? null
        : !!$ctrl.widgetConfig.includeInBriefing;
      widget.includeInBriefing = $ctrl.widgetConfig.includeInBriefing;

      if (widget.type === 'weather') {
        if (!$ctrl.widgetConfig.selectedCity) {
          return;
        }

        widget.config.location = angular.copy($ctrl.widgetConfig.selectedCity);
        applyWeatherWidgetPreview(widget);
        $ctrl.closeWidgetConfigModal();
        return;
      }

      if (widgetSupportsConnections(widget.type)) {
        if (!$ctrl.widgetConfig.selectedConnectionId) {
          return;
        }

        applyConnectionWidgetPreview(widget, getSelectedConnection());
        $ctrl.closeWidgetConfigModal();
        return;
      }

      $ctrl.closeWidgetConfigModal();
    };

    $ctrl.removeWidget = function removeWidget() {
      var widget = $ctrl.widgetConfig.widget;

      if (!$ctrl.activeDashboard || !$ctrl.isEditing || !widget) {
        return;
      }

      if (!window.confirm('Remove this widget from the dashboard?')) {
        return;
      }

      WidgetService.removeWidget($ctrl.activeDashboard.id, widget.id).then(function handleWidgetRemoved() {
        if ($ctrl.refreshingWidgetId === widget.id) {
          $ctrl.refreshingWidgetId = '';
        }

        $ctrl.closeWidgetConfigModal();
        $ctrl.widgets = WidgetService.listForDashboard($ctrl.activeDashboard.id);
      }).catch(function handleRemoveWidgetError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to remove the widget right now.'), 'Unable to remove widget');
      });
    };

    $ctrl.openCreateConnectionModal = function openCreateConnectionModal() {
      if (!$ctrl.widgetConfig.widget || !widgetSupportsConnections($ctrl.widgetConfig.widget.type)) {
        return;
      }

      $ctrl.connectionModal = buildEmptyConnectionModalState(getConnectionProviderForWidgetType($ctrl.widgetConfig.widget.type));
      $ctrl.connectionModal.isOpen = true;
    };

    $ctrl.closeCreateConnectionModal = function closeCreateConnectionModal() {
      $ctrl.connectionModal = buildEmptyConnectionModalState();
    };

    $ctrl.saveNewConnection = function saveNewConnection() {
      if ($ctrl.connectionModal.provider === 'google-calendar') {
        $ctrl.startGoogleCalendarOAuth();
        return;
      }

      $ctrl.connectionModal.isSaving = true;

      ConnectionService.create({
        type: $ctrl.connectionModal.provider,
        credentials: buildConnectionCredentials($ctrl.connectionModal)
      }).then(function handleConnectionCreated(connection) {
        $ctrl.widgetConfig.availableConnections = [connection].concat($ctrl.widgetConfig.availableConnections);
        $ctrl.widgetConfig.selectedConnectionId = connection.id;
        $ctrl.closeCreateConnectionModal();
        NotificationService.success('Connection created and selected for this widget.', 'Connection created');
      }).catch(function handleCreateConnectionError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to create the connection right now.'), 'Unable to create connection');
      }).finally(function clearCreateConnectionLoading() {
        $ctrl.connectionModal.isSaving = false;
      });
    };

    $ctrl.startGoogleCalendarOAuth = function startGoogleCalendarOAuth() {
      if ($ctrl.widgetConfig.widget) {
        ConnectionService.saveWidgetOAuthContext({
          dashboardId: $ctrl.activeDashboard ? $ctrl.activeDashboard.id : '',
          widgetId: $ctrl.widgetConfig.widget.id,
          widgetType: $ctrl.widgetConfig.widget.type
        });
      }

      ConnectionService.startGoogleCalendarOAuth($window.location.href).catch(function handleGoogleOAuthStartError(error) {
        ConnectionService.saveWidgetOAuthContext(null);
        NotificationService.error(getErrorMessage(error, 'Unable to start Google Calendar connection right now.'), 'Unable to start Google connection');
      });
    };

    $ctrl.addWidget = function addWidget(type) {
      if (!$ctrl.activeDashboard) {
        return;
      }

      WidgetService.addWidget($ctrl.activeDashboard.id, type).then(function handleWidgetAdded() {
        UiShellService.closeWidgetPanel();
        syncState();
      }).catch(function handleAddWidgetError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to add that widget right now.'), 'Unable to add widget');
      });
    };

    $ctrl.persistWidgetPosition = function persistWidgetPosition(widget) {
      WidgetService.updatePosition($ctrl.activeDashboard.id, widget.id, widget.x, widget.y);
    };

    $ctrl.persistWidgetSize = function persistWidgetSize(widget) {
      WidgetService.updateSize($ctrl.activeDashboard.id, widget.id, widget.width, widget.height);
    };

    $ctrl.refreshWidget = function refreshWidget(widget, $event) {
      if ($event) {
        $event.preventDefault();
        $event.stopPropagation();
      }

      if (!$ctrl.activeDashboard || !widget || $ctrl.refreshingWidgetId) {
        return;
      }

      $ctrl.refreshingWidgetId = widget.id;
      widget.isLoading = true;

      DashboardSnapshotService.loadLatestForDashboard($ctrl.activeDashboard.id).then(function handleSnapshot(snapshot) {
        WidgetService.applySnapshot($ctrl.activeDashboard.id, snapshot);
        $ctrl.widgets = WidgetService.listForDashboard($ctrl.activeDashboard.id);
      }).catch(function handleSnapshotRefreshError(error) {
        WidgetService.applySnapshot($ctrl.activeDashboard.id, null);
        $ctrl.widgets = WidgetService.listForDashboard($ctrl.activeDashboard.id);
        NotificationService.error(getErrorMessage(error, 'Unable to refresh the widget right now.'), 'Widget refresh failed');
      }).finally(function clearRefreshingWidget() {
        $ctrl.refreshingWidgetId = '';
      });
    };

    $ctrl.isRefreshingWidget = function isRefreshingWidget(widget) {
      return !!(widget && $ctrl.refreshingWidgetId === widget.id);
    };

    $ctrl.generateAudioBriefing = function generateAudioBriefing(force) {
      if (!$ctrl.activeDashboard || $ctrl.isGeneratingAudioBriefing) {
        return;
      }

      $ctrl.isGeneratingAudioBriefing = true;

      AudioBriefingService.generate($ctrl.activeDashboard.id, {
        force: !!force
      }).then(function handleGeneratedAudioBriefing(result) {
        $ctrl.audioBriefing = result ? result.briefing : null;
        NotificationService.success(result && result.reused ? 'The latest matching audio briefing was reused.' : 'A new audio briefing is ready to play.', 'Audio Briefing updated');
      }).catch(function handleGenerateAudioBriefingError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to generate the audio briefing right now.'), 'Audio Briefing failed');
      }).finally(function clearGeneratingState() {
        $ctrl.isGeneratingAudioBriefing = false;
      });
    };

    $ctrl.canPlayAudioBriefing = function canPlayAudioBriefing() {
      return !!($ctrl.audioBriefing && $ctrl.audioBriefing.audio && $ctrl.audioBriefing.status === 'READY' && !$ctrl.isAudioLoading);
    };

    $ctrl.toggleAudioPlayback = function toggleAudioPlayback() {
      if (!$ctrl.canPlayAudioBriefing()) {
        return;
      }

      if (audioElement && !audioElement.paused) {
        audioElement.pause();
        return;
      }

      $ctrl.isAudioLoading = true;

      ensureAudioElement().then(function handleAudioElementReady() {
        return audioElement.play();
      }).catch(function handleAudioPlayError(error) {
        $scope.$applyAsync(function applyAudioPlayError() {
          $ctrl.isAudioLoading = false;
          $ctrl.isAudioPlaying = false;
          NotificationService.error(getErrorMessage(error, 'The audio briefing could not be played.'), 'Playback failed');
        });
      });
    };

    $ctrl.getAudioBriefingSummary = function getAudioBriefingSummary() {
      if (!$ctrl.audioBriefing) {
        return 'Generate the latest dashboard-level spoken summary from your selected widgets.';
      }

      if ($ctrl.audioBriefing.sourceWidgetTypes && $ctrl.audioBriefing.sourceWidgetTypes.length) {
        return 'Includes ' + $ctrl.audioBriefing.sourceWidgetTypes.join(', ') + '.';
      }

      return 'The latest dashboard-level spoken summary is ready.';
    };

    $ctrl.getAudioBriefingStatusLabel = function getAudioBriefingStatusLabel() {
      if ($ctrl.isGeneratingAudioBriefing) {
        return 'Generating';
      }

      if (!$ctrl.audioBriefingPreferences.enabled) {
        return 'Disabled';
      }

      if (!$ctrl.audioBriefing) {
        return 'Not generated';
      }

      if ($ctrl.audioBriefing.status === 'READY') {
        return 'Ready';
      }

      if ($ctrl.audioBriefing.status === 'FAILED') {
        return 'Failed';
      }

      if ($ctrl.audioBriefing.status === 'GENERATING') {
        return 'Generating';
      }

      return 'Pending';
    };

    $ctrl.formatDuration = function formatDuration(seconds) {
      if (!seconds) {
        return '';
      }

      return Math.max(1, Math.round(seconds / 60)) + ' min';
    };

    $ctrl.formatTimestamp = function formatTimestamp(value) {
      if (!value) {
        return '';
      }

      return new Date(value).toLocaleString();
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

      return !!(definition && definition.resizable);
    };

    function syncState() {
      var activeDashboardId;

      $ctrl.dashboards = DashboardService.list();
      $ctrl.activeDashboard = DashboardService.getActive();

      if (!$ctrl.activeDashboard) {
        $ctrl.closeWidgetConfigModal();
        $ctrl.widgets = [];
        $ctrl.audioBriefing = null;
        $ctrl.audioBriefingPreferences = buildDefaultAudioBriefingPreferences();
        return Promise.resolve([]);
      }

      activeDashboardId = $ctrl.activeDashboard.id;
      $ctrl.widgets = WidgetService.listForDashboard(activeDashboardId);

      return $q.all([
        WidgetService.loadForDashboard(activeDashboardId),
        AudioBriefingService.getPreferences(activeDashboardId),
        AudioBriefingService.getLatest(activeDashboardId)
      ]).then(function handleWidgetLoad(results) {
        var widgets = results[0];
        var audioBriefingPreferences = results[1];
        var audioBriefing = results[2];

        if (!$ctrl.activeDashboard || $ctrl.activeDashboard.id !== activeDashboardId) {
          return widgets;
        }

        $ctrl.widgets = widgets;
        $ctrl.audioBriefingPreferences = audioBriefingPreferences || buildDefaultAudioBriefingPreferences();
        $ctrl.audioBriefing = audioBriefing;
        return DashboardSnapshotService.loadLatestForDashboard(activeDashboardId).then(function handleSnapshot(snapshot) {
          if (!$ctrl.activeDashboard || $ctrl.activeDashboard.id !== activeDashboardId) {
            return widgets;
          }

          WidgetService.applySnapshot(activeDashboardId, snapshot);
          $ctrl.widgets = WidgetService.listForDashboard(activeDashboardId);
          return $ctrl.widgets;
        }).catch(function ignoreSnapshotFailure() {
          if (!$ctrl.activeDashboard || $ctrl.activeDashboard.id !== activeDashboardId) {
            return widgets;
          }

          WidgetService.applySnapshot(activeDashboardId, null);
          $ctrl.widgets = WidgetService.listForDashboard(activeDashboardId);
          return $ctrl.widgets;
        });
      }).catch(function handleWidgetLoadError(error) {
        $ctrl.widgets = [];
        NotificationService.error(getErrorMessage(error, 'Unable to load dashboard widgets right now.'), 'Unable to load dashboard');
        return [];
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
          if (!hasCompletedInitialStateLoad) {
            return;
          }

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
              description: '',
              audioBriefing: buildDefaultAudioBriefingPreferences()
            };
          }

          if (mode === 'edit' && $ctrl.activeDashboard) {
            $ctrl.modalForm = {
              name: $ctrl.activeDashboard.name,
              description: $ctrl.activeDashboard.description,
              audioBriefing: angular.copy($ctrl.audioBriefingPreferences || buildDefaultAudioBriefingPreferences())
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

    function buildEmptyWidgetConfigState() {
      return {
        isOpen: false,
        widget: null,
        cityQuery: '',
        searchResults: [],
        selectedCity: null,
        includeInBriefing: false,
        availableConnections: [],
        selectedConnectionId: '',
        isLoadingConnections: false,
        isSearching: false,
        hasSearched: false
      };
    }

    function buildDefaultAudioBriefingPreferences() {
      return {
        enabled: true,
        autoGenerate: false,
        targetDurationSeconds: 75,
        tone: 'calm, concise, professional',
        language: 'en-GB',
        voiceName: 'default',
        includeWidgetTypes: []
      };
    }

    function buildEmptyConnectionModalState(provider) {
      var nextProvider = provider || 'todoist';

      return {
        isOpen: false,
        provider: nextProvider,
        apiKey: '',
        model: nextProvider === 'openai' ? 'gpt-5-mini' : '',
        baseUrl: nextProvider === 'openai' ? 'https://api.openai.com' : '',
        isSaving: false
      };
    }

    function restoreWidgetOAuthFlowIfPresent() {
      var context = ConnectionService.getWidgetOAuthContext();

      if (!pendingWidgetOAuthResult || !pendingWidgetOAuthResult.connectionId || pendingWidgetOAuthResult.provider !== 'google-calendar') {
        return $q.resolve();
      }

      clearPendingWidgetOAuthResultFromUrl();

      if (!context || !context.widgetId || !context.dashboardId || context.dashboardId !== ($ctrl.activeDashboard && $ctrl.activeDashboard.id)) {
        ConnectionService.clearWidgetOAuthContext();
        return $q.resolve();
      }

      var resumedWidget = ($ctrl.widgets || []).find(function findWidget(widget) {
        return widget.id === context.widgetId;
      });

      if (!resumedWidget || !widgetSupportsConnections(context.widgetType || resumedWidget.type)) {
        return $q.resolve();
      }

      $ctrl.isEditing = true;

      return ConnectionService.list(getConnectionProviderForWidgetType(resumedWidget.type)).then(function handleConnections(connections) {
        var currentWidgets = WidgetService.listForDashboard(context.dashboardId);
        var currentWidget = (currentWidgets || []).find(function findCurrentWidget(widget) {
          return widget.id === context.widgetId;
        });
        var selectedConnection = (connections || []).find(function findConnection(connection) {
          return connection.id === pendingWidgetOAuthResult.connectionId;
        });

        if (!selectedConnection) {
          ConnectionService.clearWidgetOAuthContext();
          NotificationService.error('The Google Calendar connection was created, but it could not be loaded into the widget automatically.', 'Connection restore failed');
          return;
        }

        if (!currentWidget) {
          ConnectionService.clearWidgetOAuthContext();
          NotificationService.error('The Google Calendar connection was created, but the calendar widget could not be found to stage it automatically.', 'Connection restore failed');
          return;
        }

        currentWidget.config = currentWidget.config || {};
        applyConnectionWidgetPreview(currentWidget, selectedConnection);
        $ctrl.widgets = currentWidgets;
        ConnectionService.clearWidgetOAuthContext();
        NotificationService.success('Google Calendar connected and staged on the widget. Click Save Dashboard to persist it.', 'Connection added');
      }).catch(function handleRestoreOAuthWidgetError(error) {
        ConnectionService.clearWidgetOAuthContext();
        NotificationService.error(getErrorMessage(error, 'The Google Calendar connection was created, but it could not be staged on the widget automatically.'), 'Connection restore failed');
      });
    }

    function readPendingWidgetOAuthResult() {
      var connectionId;
      var provider;

      connectionId = $location.search().oauthConnectionId;
      provider = $location.search().oauthProvider;

      if (!connectionId || !provider) {
        return null;
      }

      return {
        connectionId: connectionId,
        provider: provider
      };
    }

    function clearPendingWidgetOAuthResultFromUrl() {
      var currentUrl;
      var hash;
      var queryIndex;
      var hashPath;
      var hashQuery;

      try {
        currentUrl = new URL($window.location.href);
      } catch (error) {
        pendingWidgetOAuthResult = null;
        return;
      }

      hash = ($window.location.hash || '').replace(/^#/, '');
      queryIndex = hash.indexOf('?');

      if (queryIndex === -1) {
        pendingWidgetOAuthResult = null;
        return;
      }

      hashPath = hash.slice(0, queryIndex);
      hashQuery = new URLSearchParams(hash.slice(queryIndex + 1));
      hashQuery.delete('oauthConnectionId');
      hashQuery.delete('oauthProvider');
      currentUrl.hash = hashQuery.toString()
        ? '#' + hashPath + '?' + hashQuery.toString()
        : '#' + hashPath;
      $window.history.replaceState({}, '', currentUrl.toString());
      pendingWidgetOAuthResult = null;
    }

    function applyWeatherWidgetPreview(widget) {
      var location = widget.config && widget.config.location ? widget.config.location : null;
      var locationLabel = getSelectedCityDisplayName(location);

      widget.data = widget.data || {};
      widget.data.location = locationLabel || 'Select a city';
      widget.data.temperature = widget.data.temperature || '18°';
      widget.data.condition = widget.data.condition || 'Partly sunny';
      widget.data.highLow = widget.data.highLow || 'H: 20°  L: 11°';
      widget.data.summary = locationLabel
        ? 'Mock data for the MVP. This widget will later hydrate from a briefing snapshot.'
        : 'Choose a city in edit mode to configure this widget.';
      widget.data.details = locationLabel
        ? [
            { label: 'Feels like', value: '17°' },
            { label: 'Rain', value: '10%' },
            { label: 'UV', value: 'Moderate' }
          ]
        : [];
    }

    function applyTasksWidgetPreview(widget, connection) {
      if (!connection) {
        return;
      }

      widget.config.connectionId = connection.id;
      widget.config.connectionName = connection.name;
      widget.config.provider = connection.type;
      widget.data = {
        provider: connection.type,
        connectionLabel: connection.name,
        emptyMessage: 'Live tasks will appear after you save the dashboard.',
        groups: [
          {
            label: 'Due Today',
            items: [
              { title: 'Reply to insurance email', meta: 'today' },
              { title: 'Confirm dinner reservation', meta: 'today' }
            ]
          },
          {
            label: 'Due Tomorrow',
            items: [
              { title: 'Draft project update', meta: 'tomorrow' },
              { title: 'Buy birthday card', meta: 'tomorrow' }
            ]
          },
          {
            label: 'No Due Date',
            items: [
              { title: 'Declutter camera roll', meta: '' },
              { title: 'Research standing desk options', meta: '' }
            ]
          }
        ]
      };
    }

    function applyCalendarWidgetPreview(widget, connection) {
      if (!connection) {
        return;
      }

      widget.config.connectionId = connection.id;
      widget.config.connectionName = connection.name;
      widget.config.provider = connection.type;
      widget.data = {
        provider: connection.type,
        connectionLabel: connection.name,
        dateLabel: 'Today',
        emptyMessage: 'Live appointments will appear after you save the dashboard.',
        appointments: [
          {
            time: '09:00',
            title: 'Stand-up',
            location: 'Teams'
          },
          {
            time: '11:30',
            title: 'Planning session',
            location: 'Studio'
          },
          {
            time: '16:00',
            title: 'Doctor appointment',
            location: 'Rue des Fleurs'
          }
        ]
      };
    }

    function applyNewsWidgetPreview(widget, connection) {
      if (!connection) {
        return;
      }

      widget.config.connectionId = connection.id;
      widget.config.connectionName = connection.name;
      widget.config.provider = connection.type;
      widget.data = {
        headline: 'News Briefing',
        markdown: '# News Briefing\n\nHeadlines will appear after you save the dashboard and refresh the snapshot.',
        categories: [],
        emptyMessage: 'The selected LLM connection will summarize your configured RSS feeds after the next snapshot.',
        sourceErrors: []
      };
    }

    function applyConnectionWidgetPreview(widget, connection) {
      if (widget.type === 'tasks') {
        applyTasksWidgetPreview(widget, connection);
        return;
      }

      if (widget.type === 'calendar') {
        applyCalendarWidgetPreview(widget, connection);
        return;
      }

      if (widget.type === 'news') {
        applyNewsWidgetPreview(widget, connection);
      }
    }

    function loadConnectionsForWidget(widgetType) {
      $ctrl.widgetConfig.isLoadingConnections = true;

      ConnectionService.list(getConnectionProviderForWidgetType(widgetType)).then(function handleConnections(connections) {
        $ctrl.widgetConfig.availableConnections = connections;
      }).catch(function handleConnectionLoadError(error) {
        $ctrl.widgetConfig.availableConnections = [];
        NotificationService.error(getErrorMessage(error, 'Connections are currently unavailable.'), 'Unable to load connections');
      }).finally(function clearConnectionLoading() {
        $ctrl.widgetConfig.isLoadingConnections = false;
      });
    }

    function getSelectedConnection() {
      return ($ctrl.widgetConfig.availableConnections || []).find(function findConnection(connection) {
        return connection.id === $ctrl.widgetConfig.selectedConnectionId;
      }) || null;
    }

    function getSelectedCityDisplayName(location) {
      if (typeof location === 'string' && location.trim()) {
        return location;
      }

      if (!location || typeof location !== 'object') {
        return '';
      }

      if (typeof location.displayName === 'string' && location.displayName.trim()) {
        return location.displayName;
      }

      if (typeof location.name === 'string' && location.name.trim()) {
        if (typeof location.countryCode === 'string' && location.countryCode.trim()) {
          return location.name + ', ' + location.countryCode;
        }

        return location.name;
      }

      return '';
    }

    function getWidgetConfigTitle() {
      if (!$ctrl.widgetConfig.widget) {
        return 'Configure Widget';
      }

      if ($ctrl.widgetConfig.widget.type === 'weather') {
        return 'Configure Weather Widget';
      }

      if ($ctrl.widgetConfig.widget.type === 'tasks') {
        return 'Configure Task List';
      }

      if ($ctrl.widgetConfig.widget.type === 'calendar') {
        return 'Configure Calendar';
      }

      if ($ctrl.widgetConfig.widget.type === 'news') {
        return 'Configure News Widget';
      }

      if ($ctrl.widgetConfig.widget.type === 'xkcd') {
        return 'Latest xkcd';
      }

      return 'Configure ' + $ctrl.widgetConfig.widget.title;
    }

    function widgetSupportsConnections(widgetType) {
      var type = widgetType || ($ctrl.widgetConfig.widget && $ctrl.widgetConfig.widget.type);

      return type === 'tasks' || type === 'calendar' || type === 'news';
    }

    function getConnectionProviderForWidgetType(widgetType) {
      if (widgetType === 'tasks') {
        return 'todoist';
      }

      if (widgetType === 'calendar') {
        return 'google-calendar';
      }

      if (widgetType === 'news') {
        return 'openai';
      }

      return '';
    }

    function canSaveConnection() {
      if ($ctrl.connectionModal.provider === 'google-calendar') {
        return true;
      }

      if ($ctrl.connectionModal.provider === 'openai') {
        return !!($ctrl.connectionModal.apiKey && $ctrl.connectionModal.model);
      }

      return !!$ctrl.connectionModal.apiKey;
    }

    function buildConnectionCredentials(connectionModal) {
      var credentials = {};

      if (connectionModal.apiKey) {
        credentials.apiKey = connectionModal.apiKey;
      }

      if (connectionModal.provider === 'openai') {
        credentials.model = connectionModal.model || 'gpt-5-mini';

        if (connectionModal.baseUrl) {
          credentials.baseUrl = connectionModal.baseUrl;
        }
      }

      return credentials;
    }

    function attachAudioElement() {
      if (audioElement) {
        audioElement.pause();
      }

      audioElement = new Audio(audioPlaybackUrl);
      audioElement.addEventListener('playing', function handlePlaying() {
        $scope.$applyAsync(function applyPlaying() {
          $ctrl.isAudioPlaying = true;
          $ctrl.isAudioLoading = false;
        });
      });
      audioElement.addEventListener('pause', function handlePause() {
        $scope.$applyAsync(function applyPause() {
          $ctrl.isAudioPlaying = false;
          $ctrl.isAudioLoading = false;
        });
      });
      audioElement.addEventListener('ended', function handleEnded() {
        $scope.$applyAsync(function applyEnded() {
          $ctrl.isAudioPlaying = false;
          $ctrl.isAudioLoading = false;
        });
      });
      audioElement.addEventListener('error', function handleError() {
        $scope.$applyAsync(function applyError() {
          $ctrl.isAudioPlaying = false;
          $ctrl.isAudioLoading = false;
        });
      });
    }

    function ensureAudioElement() {
      if (audioElement && audioPlaybackUrl) {
        return $q.resolve(audioElement);
      }

      return AudioBriefingService.fetchAudioPlaybackUrl($ctrl.audioBriefing.audio).then(function handlePlaybackUrl(nextPlaybackUrl) {
        releaseAudioPlaybackUrl();
        audioPlaybackUrl = nextPlaybackUrl;
        attachAudioElement();
        return audioElement;
      });
    }

    function releaseAudioPlaybackUrl() {
      if (audioPlaybackUrl) {
        URL.revokeObjectURL(audioPlaybackUrl);
        audioPlaybackUrl = '';
      }
    }

    function getErrorMessage(error, fallbackMessage) {
      if (error && error.data && typeof error.data.message === 'string' && error.data.message) {
        return error.data.message;
      }

      return fallbackMessage;
    }
  }
})();
