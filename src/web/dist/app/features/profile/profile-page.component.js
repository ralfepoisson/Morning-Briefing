(function () {
  'use strict';

  angular.module('morningBriefingApp').component('profilePage', {
    template:
      '<section class="profile-page">' +
      '  <form ng-if="$ctrl.ready" ng-submit="$ctrl.save()" novalidate>' +
      '    <div class="profile-hero">' +
      '      <div>' +
      '        <div class="stage-kicker">Profile</div>' +
      '        <h1 class="stage-title stage-title--compact">User profile</h1>' +
      '        <p class="stage-copy stage-copy--compact mb-0">Manage the identity details shown around the app and choose how generated dashboard audio reaches you.</p>' +
      '      </div>' +
      '      <div class="profile-hero__controls">' +
      '        <div class="profile-hero__badge">' +
      '          <span class="profile-hero__avatar" ng-if="$ctrl.form.avatarDataUrl"><img ng-src="{{$ctrl.form.avatarDataUrl}}" alt="" /></span>' +
      '          <span class="profile-hero__avatar profile-hero__avatar--fallback" ng-if="!$ctrl.form.avatarDataUrl">{{$ctrl.getInitials()}}</span>' +
      '          <div>' +
      '            <strong>{{$ctrl.form.displayName || "Your profile"}}</strong>' +
      '            <div class="profile-hero__meta">{{$ctrl.form.email || "Add your preferred email address"}}</div>' +
      '          </div>' +
      '        </div>' +
      '        <div class="profile-hero__actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.reset()" ng-disabled="$ctrl.isSaving">Reset</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.isSaving || !$ctrl.form.displayName || !$ctrl.form.email || !$ctrl.form.timezone">' +
      '            <span ng-if="!$ctrl.isSaving">Save profile</span>' +
      '            <span ng-if="$ctrl.isSaving">Saving...</span>' +
      '          </button>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '    <div class="profile-layout">' +
      '    <section class="profile-card">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Personal details</div>' +
      '        <h2 class="connectors-panel-title">Identity</h2>' +
      '      </div>' +
      '      <div class="profile-grid">' +
      '        <div>' +
      '          <label class="form-label" for="profileName">Name</label>' +
      '          <input id="profileName" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.displayName" placeholder="Your full name" required />' +
      '        </div>' +
      '        <div>' +
      '          <label class="form-label" for="profilePhoneticName">Phonetic name</label>' +
      '          <input id="profilePhoneticName" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.phoneticName" placeholder="Optional pronunciation guide" />' +
      '        </div>' +
      '        <div>' +
      '          <label class="form-label" for="profileEmail">Email address</label>' +
      '          <input id="profileEmail" class="form-control form-control-lg" type="email" ng-model="$ctrl.form.email" placeholder="name@example.com" required />' +
      '        </div>' +
      '        <div>' +
      '          <label class="form-label" for="profileTimezone">Timezone</label>' +
      '          <select id="profileTimezone" class="form-select form-select-lg" ng-model="$ctrl.form.timezone" ng-options="timezone for timezone in $ctrl.timezoneOptions" required></select>' +
      '        </div>' +
      '      </div>' +
      '      <div class="profile-upload-panel mt-3">' +
      '        <div class="profile-upload-panel__preview">' +
      '          <span class="profile-upload-panel__avatar" ng-if="$ctrl.form.avatarDataUrl"><img ng-src="{{$ctrl.form.avatarDataUrl}}" alt="" /></span>' +
      '          <span class="profile-upload-panel__avatar profile-upload-panel__avatar--fallback" ng-if="!$ctrl.form.avatarDataUrl">{{$ctrl.getInitials()}}</span>' +
      '          <div>' +
      '            <div class="profile-delivery-card__title">Profile picture</div>' +
      '            <p class="connectors-panel-copy mb-0">Upload a PNG, JPEG, GIF, or WebP image. Large images are automatically resized before saving.</p>' +
      '          </div>' +
      '        </div>' +
      '        <div class="profile-upload-panel__actions">' +
      '          <label class="btn btn-outline-light mb-0" for="profileAvatarFile">Upload image</label>' +
      '          <input id="profileAvatarFile" class="d-none" type="file" accept="image/png,image/jpeg,image/gif,image/webp" mb-file-change="$ctrl.onAvatarSelected($event)" />' +
      '          <button type="button" class="btn btn-outline-secondary" ng-if="$ctrl.form.avatarDataUrl" ng-click="$ctrl.clearAvatar()">Remove image</button>' +
      '        </div>' +
      '      </div>' +
      '      <div class="profile-upload-panel__error" ng-if="$ctrl.avatarError">{{$ctrl.avatarError}}</div>' +
      '    </section>' +
      '    <section class="profile-card">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Configuration</div>' +
      '        <h2 class="connectors-panel-title">Audio delivery</h2>' +
      '      </div>' +
      '      <div class="profile-delivery-card">' +
      '        <div>' +
      '          <div class="profile-delivery-card__title">Telegram</div>' +
      '          <p class="connectors-panel-copy mb-0">When a dashboard audio briefing finishes generating, send that audio clip to your Telegram chat automatically.</p>' +
      '        </div>' +
      '        <label class="profile-toggle">' +
      '          <input type="checkbox" ng-model="$ctrl.form.briefingDelivery.telegram.enabled" />' +
      '          <span>Enabled</span>' +
      '        </label>' +
      '      </div>' +
      '      <label class="form-label mt-3" for="profileTelegramChatId">Telegram chat ID</label>' +
      '      <input id="profileTelegramChatId" class="form-control form-control-lg" type="text" ng-model="$ctrl.form.briefingDelivery.telegram.chatId" placeholder="123456789 or -100..." />' +
      '      <div class="profile-help-list">' +
      '        <span>Bot delivery uses the server-side Telegram bot configuration.</span>' +
      '        <span>WhatsApp and Discord delivery options will appear in this section later.</span>' +
      '      </div>' +
      '    </section>' +
      '    </div>' +
      '  </form>' +
      '</section>',
    controller: ProfilePageController
  });

  ProfilePageController.$inject = ['CurrentUserService', 'NotificationService', '$location'];

  function ProfilePageController(CurrentUserService, NotificationService, $location) {
    var $ctrl = this;

    $ctrl.ready = false;
    $ctrl.isSaving = false;
    $ctrl.avatarError = '';
    $ctrl.timezoneOptions = buildTimezoneOptions();
    $ctrl.user = null;
    $ctrl.form = buildForm(null);

    $ctrl.$onInit = function onInit() {
      CurrentUserService.load(true).then(function handleUserLoaded(user) {
        $ctrl.user = user;
        $ctrl.form = buildForm(user);
      }).catch(function handleLoadError(error) {
        if (error && error.status === 401) {
          $location.path('/signed-out');
          return;
        }

        NotificationService.error(getErrorMessage(error, 'Your profile is currently unavailable.'), 'Unable to load profile');
      }).finally(function markReady() {
        $ctrl.ready = true;
      });
    };

    $ctrl.reset = function reset() {
      $ctrl.avatarError = '';
      $ctrl.form = buildForm($ctrl.user);
    };

    $ctrl.getInitials = function getInitials() {
      return deriveInitials($ctrl.form.displayName || $ctrl.form.email || 'MB');
    };

    $ctrl.onAvatarSelected = function onAvatarSelected(event) {
      var file = event && event.target && event.target.files ? event.target.files[0] : null;

      $ctrl.avatarError = '';

      if (!file) {
        return;
      }

      if (!/^image\/(png|jpeg|gif|webp)$/.test(file.type || '')) {
        $ctrl.avatarError = 'Choose a PNG, JPEG, GIF, or WebP image.';
        return;
      }

      resizeImageFile(file).then(function handleDataUrl(dataUrl) {
        $ctrl.form.avatarDataUrl = dataUrl;
      }).catch(function handleAvatarError() {
        $ctrl.avatarError = 'The selected image could not be prepared for upload.';
      });
    };

    $ctrl.clearAvatar = function clearAvatar() {
      $ctrl.avatarError = '';
      $ctrl.form.avatarDataUrl = '';
    };

    $ctrl.save = function save() {
      if ($ctrl.form.briefingDelivery.telegram.enabled && !$ctrl.form.briefingDelivery.telegram.chatId) {
        NotificationService.error('Enter a Telegram chat ID before enabling Telegram delivery.', 'Telegram setup incomplete');
        return;
      }

      $ctrl.isSaving = true;

      return CurrentUserService.updateProfile(buildPayload($ctrl.form)).then(function handleSavedUser(user) {
        $ctrl.user = user;
        $ctrl.form = buildForm(user);
        NotificationService.success('Your profile and delivery settings were saved.', 'Profile updated');
      }).catch(function handleSaveError(error) {
        NotificationService.error(getErrorMessage(error, 'Your profile could not be saved right now.'), 'Unable to save profile');
      }).finally(function clearSaving() {
        $ctrl.isSaving = false;
      });
    };
  }

  function buildForm(user) {
    return {
      displayName: user && user.displayName ? user.displayName : '',
      phoneticName: user && user.phoneticName ? user.phoneticName : '',
      email: user && user.email ? user.email : '',
      avatarDataUrl: user && user.avatarDataUrl ? user.avatarDataUrl : '',
      timezone: user && user.timezone ? user.timezone : 'UTC',
      briefingDelivery: {
        telegram: {
          enabled: !!(user && user.briefingDelivery && user.briefingDelivery.telegram && user.briefingDelivery.telegram.enabled),
          chatId: user && user.briefingDelivery && user.briefingDelivery.telegram && user.briefingDelivery.telegram.chatId
            ? user.briefingDelivery.telegram.chatId
            : ''
        }
      }
    };
  }

  function buildPayload(form) {
    return {
      displayName: form.displayName,
      phoneticName: form.phoneticName || null,
      email: form.email,
      avatarDataUrl: form.avatarDataUrl || null,
      timezone: form.timezone,
      briefingDelivery: {
        telegram: {
          enabled: !!(form.briefingDelivery && form.briefingDelivery.telegram && form.briefingDelivery.telegram.enabled),
          chatId: form.briefingDelivery && form.briefingDelivery.telegram && form.briefingDelivery.telegram.chatId
            ? form.briefingDelivery.telegram.chatId
            : null
        }
      }
    };
  }

  function buildTimezoneOptions() {
    if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
      return Intl.supportedValuesOf('timeZone');
    }

    return ['UTC', 'Europe/Paris', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
  }

  function deriveInitials(value) {
    return (value || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(function toInitial(part) {
        return part.charAt(0).toUpperCase();
      })
      .join('') || 'MB';
  }

  function resizeImageFile(file) {
    return loadImageBitmap(file).then(function handleImageLoaded(bitmap) {
      var maxDimension = 768;
      var canvas = document.createElement('canvas');
      var context = canvas.getContext('2d');
      var width = bitmap.width;
      var height = bitmap.height;
      var scale = Math.min(1, maxDimension / Math.max(width, height));
      var outputWidth = Math.max(1, Math.round(width * scale));
      var outputHeight = Math.max(1, Math.round(height * scale));
      var dataUrl;

      canvas.width = outputWidth;
      canvas.height = outputHeight;

      if (!context) {
        throw new Error('Canvas is unavailable.');
      }

      context.drawImage(bitmap, 0, 0, outputWidth, outputHeight);

      dataUrl = canvas.toDataURL('image/webp', 0.82);

      if (!/^data:image\/webp;base64,/.test(dataUrl)) {
        dataUrl = canvas.toDataURL('image/jpeg', 0.82);
      }

      if (bitmap.close) {
        bitmap.close();
      }

      return shrinkDataUrlIfNeeded(canvas, dataUrl, 900000);
    });
  }

  function loadImageBitmap(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file);
    }

    return new Promise(function load(resolve, reject) {
      var objectUrl = URL.createObjectURL(file);
      var image = new Image();

      image.onload = function handleLoad() {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = function handleError() {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to load image.'));
      };

      image.src = objectUrl;
    });
  }

  function shrinkDataUrlIfNeeded(canvas, dataUrl, maxLength) {
    var quality = 0.82;
    var current = dataUrl;

    while (current.length > maxLength && quality > 0.4) {
      quality -= 0.08;
      current = canvas.toDataURL('image/jpeg', quality);
    }

    return current;
  }

  function getErrorMessage(error, fallback) {
    return error && error.data && error.data.message ? error.data.message : fallback;
  }
})();
