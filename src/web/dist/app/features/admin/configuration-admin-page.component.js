(function () {
  'use strict';

  angular.module('morningBriefingApp').component('configurationAdminPage', {
    template:
      '<section class="dashboards-admin-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Configuration</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Manage the shared OpenAI configuration used by AI summarization and dashboard briefing generation.</p>' +
      '    </div>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.ready">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">AI</div>' +
      '      <h2 class="connectors-panel-title">OpenAI configuration</h2>' +
      '    </div>' +
      '    <form class="admin-configuration-form" ng-submit="$ctrl.save()">' +
      '      <label class="form-label" for="adminConfigurationOpenAiKey">OpenAI API key</label>' +
      '      <input id="adminConfigurationOpenAiKey" class="form-control form-control-lg" type="password" ng-model="$ctrl.form.openAiApiKey" placeholder="{{$ctrl.configuration && $ctrl.configuration.hasOpenAiApiKey ? \'Stored key present. Enter a new key to replace it.\' : \'sk-...\'}}" />' +
      '      <p class="widget-config-helper">Used for the shared AI summarization and briefing generation flows.</p>' +
      '      <label class="form-label mt-3" for="adminConfigurationOpenAiModel">Model</label>' +
      '      <select id="adminConfigurationOpenAiModel" class="form-select form-select-lg" ng-model="$ctrl.form.openAiModel" ng-options="model for model in $ctrl.availableOpenAiModels"></select>' +
      '      <div class="widget-config-helper" ng-if="$ctrl.configuration && $ctrl.configuration.updatedAt">Last updated {{$ctrl.configuration.updatedAt | date:\'medium\'}}</div>' +
      '      <div class="modal-actions mt-4">' +
      '        <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.reload()" ng-disabled="$ctrl.isSaving">Reload</button>' +
      '        <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.isSaving">' +
      '          <span ng-if="!$ctrl.isSaving">Save configuration</span>' +
      '          <span ng-if="$ctrl.isSaving">Saving...</span>' +
      '        </button>' +
      '      </div>' +
      '    </form>' +
      '  </section>' +
      '</section>',
    controller: ConfigurationAdminPageController
  });

  ConfigurationAdminPageController.$inject = ['AdminConfigurationService', 'NotificationService', 'CurrentUserService', '$location'];

  function ConfigurationAdminPageController(AdminConfigurationService, NotificationService, CurrentUserService, $location) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isSaving = false;
    $ctrl.configuration = null;
    $ctrl.availableOpenAiModels = [];
    $ctrl.form = {
      openAiApiKey: '',
      openAiModel: ''
    };

    $ctrl.$onInit = function onInit() {
      ensureAdminAccess().then(function handleAccess(user) {
        if (user) {
          return loadConfiguration();
        }

        return null;
      });
    };

    $ctrl.reload = function reload() {
      return loadConfiguration();
    };

    $ctrl.save = function save() {
      $ctrl.isSaving = true;

      return AdminConfigurationService.update({
        openAiApiKey: $ctrl.form.openAiApiKey,
        openAiModel: $ctrl.form.openAiModel
      }).then(function handleSaved(configuration) {
        $ctrl.configuration = configuration;
        $ctrl.availableOpenAiModels = configuration ? configuration.availableOpenAiModels || [] : [];
        $ctrl.form.openAiApiKey = '';
        $ctrl.form.openAiModel = configuration ? configuration.openAiModel : '';
        NotificationService.success('Shared AI configuration has been updated.', 'Configuration saved');
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'The configuration could not be saved right now.'), 'Configuration failed');
      }).finally(function clearSavingState() {
        $ctrl.isSaving = false;
      });
    };

    function loadConfiguration() {
      return AdminConfigurationService.get().then(function handleLoaded(configuration) {
        $ctrl.configuration = configuration;
        $ctrl.availableOpenAiModels = configuration ? configuration.availableOpenAiModels || [] : [];
        $ctrl.form.openAiApiKey = '';
        $ctrl.form.openAiModel = configuration ? configuration.openAiModel : '';
        $ctrl.ready = true;
      }).catch(function handleError(error) {
        $ctrl.ready = false;
        NotificationService.error(getErrorMessage(error, 'The configuration is currently unavailable.'), 'Unable to load configuration');
      });
    }

    function ensureAdminAccess() {
      return CurrentUserService.load().then(function handleCurrentUserLoaded(user) {
        if (user && user.isAdmin) {
          return user;
        }

        NotificationService.error('You need admin access to view that page.', 'Admin access required');
        $location.path('/');
        return null;
      }).catch(function handleAccessError(error) {
        NotificationService.error(getErrorMessage(error, 'We could not verify your access right now.'), 'Unable to verify access');
        $location.path('/');
        return null;
      });
    }
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && error.data.message) {
      return error.data.message;
    }

    return fallbackMessage;
  }
})();
