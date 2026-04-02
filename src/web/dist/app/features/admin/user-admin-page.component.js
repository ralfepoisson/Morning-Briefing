(function () {
  'use strict';

  angular.module('morningBriefingApp').component('userAdminPage', {
    template:
      '<section class="user-admin-page">' +
      '  <div class="message-broker-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">Admin</div>' +
      '      <h1 class="stage-title stage-title--compact">Users</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Review everyone in this account and decide who can access the admin tools.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.refresh()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="message-broker-summary" ng-if="$ctrl.data">' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Total users</span>' +
      '      <strong>{{$ctrl.data.summary.total}}</strong>' +
      '      <span>People with access to this Morning Briefing account</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Admins</span>' +
      '      <strong>{{$ctrl.data.summary.admins}}</strong>' +
      '      <span>Users who can open the admin area</span>' +
      '    </article>' +
      '    <article class="message-broker-card">' +
      '      <span class="message-broker-card__label">Non-admins</span>' +
      '      <strong>{{$ctrl.data.summary.nonAdmins}}</strong>' +
      '      <span>Standard users without admin controls</span>' +
      '    </article>' +
      '  </div>' +
      '  <section class="message-broker-panel" ng-if="$ctrl.data">' +
      '    <div class="connectors-panel-header">' +
      '      <div class="eyebrow">Directory</div>' +
      '      <h2 class="connectors-panel-title">User access</h2>' +
      '    </div>' +
      '    <div class="message-broker-table-wrap" ng-if="$ctrl.data.items.length">' +
      '      <table class="message-broker-table user-admin-table">' +
      '        <thead>' +
      '          <tr>' +
      '            <th>User</th>' +
      '            <th>Locale</th>' +
      '            <th>Status</th>' +
      '            <th>Last updated</th>' +
      '            <th>Access</th>' +
      '          </tr>' +
      '        </thead>' +
      '        <tbody>' +
      '          <tr ng-repeat="user in $ctrl.data.items track by user.id">' +
      '            <td>' +
      '              <div class="message-broker-table__primary">{{user.displayName || user.email}}</div>' +
      '              <div class="message-broker-table__secondary">{{user.email}}</div>' +
      '              <div class="user-admin-table__chips">' +
      '                <span class="user-admin-chip" ng-if="user.isCurrentUser">You</span>' +
      '                <span class="user-admin-chip" ng-if="user.timezone">{{user.timezone}}</span>' +
      '              </div>' +
      '            </td>' +
      '            <td>{{user.locale || "Unknown"}}</td>' +
      '            <td>' +
      '              <span class="message-broker-status-pill" ng-class="user.isAdmin ? \'message-broker-status-pill--completed\' : \'message-broker-status-pill--skipped\'">{{user.isAdmin ? "Admin" : "Standard"}}</span>' +
      '            </td>' +
      '            <td>{{user.updatedAt | date:\'medium\'}}</td>' +
      '            <td>' +
      '              <button type="button" class="btn btn-sm btn-outline-light user-admin-table__action" ng-click="$ctrl.toggleAdminAccess(user)" ng-disabled="$ctrl.isSaving(user.id) || $ctrl.isLastAdmin(user)">' +
      '                <i class="fa-solid" ng-class="$ctrl.isSaving(user.id) ? \'fa-spinner fa-spin\' : (user.isAdmin ? \'fa-user-minus\' : \'fa-user-shield\')" aria-hidden="true"></i>' +
      '                <span>{{$ctrl.getActionLabel(user)}}</span>' +
      '              </button>' +
      '              <div class="message-broker-table__secondary" ng-if="$ctrl.isLastAdmin(user)">At least one admin must remain.</div>' +
      '            </td>' +
      '          </tr>' +
      '        </tbody>' +
      '      </table>' +
      '    </div>' +
      '    <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.data.items.length && !$ctrl.isLoading">' +
      '      <strong>No users found</strong>' +
      '      <span>Users will appear here after they sign in for the first time.</span>' +
      '    </div>' +
      '  </section>' +
      '</section>',
    controller: UserAdminPageController
  });

  UserAdminPageController.$inject = ['AdminUserService', 'CurrentUserService', 'NotificationService', '$location'];

  function UserAdminPageController(AdminUserService, CurrentUserService, NotificationService, $location) {
    var $ctrl = this;

    $ctrl.data = null;
    $ctrl.isLoading = false;
    $ctrl.savingById = {};

    $ctrl.$onInit = function onInit() {
      ensureAdminAccess().then(function handleAccess(user) {
        if (user) {
          loadUsers();
        }
      });
    };

    $ctrl.refresh = function refresh() {
      loadUsers();
    };

    $ctrl.isSaving = function isSaving(userId) {
      return !!$ctrl.savingById[userId];
    };

    $ctrl.getActionLabel = function getActionLabel(user) {
      if ($ctrl.isSaving(user.id)) {
        return user.isAdmin ? 'Removing admin...' : 'Granting admin...';
      }

      return user.isAdmin ? 'Remove admin' : 'Make admin';
    };

    $ctrl.isLastAdmin = function isLastAdmin(user) {
      return !!(user && user.isAdmin && $ctrl.data && $ctrl.data.summary.admins <= 1);
    };

    $ctrl.toggleAdminAccess = function toggleAdminAccess(user) {
      if (!user || !user.id || $ctrl.isSaving(user.id) || $ctrl.isLastAdmin(user)) {
        return;
      }

      $ctrl.savingById[user.id] = true;

      return AdminUserService.updateAccess(user.id, !user.isAdmin).then(function handleUpdated(response) {
        var updatedUser = response && response.user ? response.user : null;

        if (!updatedUser) {
          return loadUsers();
        }

        updateUser(updatedUser);
        NotificationService.success(
          updatedUser.displayName + (updatedUser.isAdmin ? ' now has admin access.' : ' no longer has admin access.'),
          updatedUser.isAdmin ? 'Admin access granted' : 'Admin access removed'
        );
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'User access could not be updated right now.'), 'Unable to update access');
        return loadUsers();
      }).finally(function clearPending() {
        delete $ctrl.savingById[user.id];
      });
    };

    function ensureAdminAccess() {
      return CurrentUserService.load().then(function handleCurrentUserLoaded(user) {
        if (user && user.isAdmin) {
          return user;
        }

        NotificationService.error('You need admin access to view that page.', 'Admin access required');
        $location.path('/dashboard');
        return null;
      }).catch(function handleAccessError(error) {
        NotificationService.error(getErrorMessage(error, 'We could not verify your access right now.'), 'Unable to verify access');
        $location.path('/dashboard');
        return null;
      });
    }

    function loadUsers() {
      $ctrl.isLoading = true;

      return AdminUserService.list().then(function handleUsersLoaded(data) {
        var items = data && data.items ? data.items : [];

        $ctrl.data = {
          items: items,
          summary: buildSummary(items)
        };
      }).catch(function handleError(error) {
        $ctrl.data = null;
        NotificationService.error(getErrorMessage(error, 'Users are currently unavailable.'), 'Unable to load users');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    }

    function updateUser(updatedUser) {
      var items;
      var itemIndex;

      if (!$ctrl.data || !$ctrl.data.items) {
        return;
      }

      items = $ctrl.data.items.slice();
      itemIndex = items.findIndex(function findUser(item) {
        return item.id === updatedUser.id;
      });

      if (itemIndex === -1) {
        return loadUsers();
      }

      items[itemIndex] = updatedUser;
      $ctrl.data = {
        items: items,
        summary: buildSummary(items)
      };
    }

    function buildSummary(items) {
      var adminCount = items.filter(function filterAdmins(item) {
        return item.isAdmin;
      }).length;

      return {
        total: items.length,
        admins: adminCount,
        nonAdmins: items.length - adminCount
      };
    }
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && error.data.message) {
      return error.data.message;
    }

    return fallbackMessage;
  }
})();
