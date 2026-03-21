(function () {
  'use strict';

  angular.module('morningBriefingApp').component('rssFeedsPage', {
    template:
      '<section class="rss-feeds-page">' +
      '  <div class="connectors-hero">' +
      '    <div>' +
      '      <div class="stage-kicker">RSS Feeds</div>' +
      '      <h1 class="stage-title stage-title--compact">Curate your news sources</h1>' +
      '      <p class="stage-copy stage-copy--compact mb-0">Organize RSS feeds into categories that the News widget will use later for summaries and headlines.</p>' +
      '    </div>' +
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.loadCategories()" ng-disabled="$ctrl.isLoading">' +
      '      <i class="fa-solid fa-rotate-right" aria-hidden="true"></i>' +
      '      <span>Refresh</span>' +
      '    </button>' +
      '  </div>' +
      '  <div class="rss-feeds-layout">' +
      '    <aside class="connectors-list-panel rss-feeds-categories-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Categories</div>' +
      '        <h2 class="connectors-panel-title">Feed groups</h2>' +
      '      </div>' +
      '      <p class="connectors-panel-copy">Create categories that match how you want the News widget grouped.</p>' +
      '      <form class="rss-feeds-form" ng-submit="$ctrl.saveCategory()" novalidate>' +
      '        <label class="form-label" for="rssCategoryName">Category name</label>' +
      '        <input id="rssCategoryName" class="form-control" type="text" ng-model="$ctrl.categoryForm.name" placeholder="Technology" required />' +
      '        <label class="form-label mt-3" for="rssCategoryDescription">Description</label>' +
      '        <textarea id="rssCategoryDescription" class="form-control rss-feeds-textarea" ng-model="$ctrl.categoryForm.description" placeholder="What kind of stories belong here?"></textarea>' +
      '        <p class="connectors-panel-copy" ng-if="$ctrl.isLoading">Loading categories...</p>' +
      '        <div class="modal-actions modal-actions--page rss-feeds-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.startNewCategory()">New category</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.isSavingCategory || !$ctrl.categoryForm.name">{{$ctrl.categoryForm.id ? "Save category" : "Add category"}}</button>' +
      '        </div>' +
      '      </form>' +
      '      <div class="connectors-empty-state" ng-if="!$ctrl.isLoading && !$ctrl.categories.length">' +
      '        <strong>No categories yet</strong>' +
      '        <span>Create your first category to start collecting RSS feeds for the News widget.</span>' +
      '      </div>' +
      '      <div class="rss-feed-category-list">' +
      '        <button type="button" class="connector-list-item rss-feed-category-item" ng-repeat="category in $ctrl.categories track by category.id" ng-class="{\'connector-list-item--active\': $ctrl.isSelectedCategory(category)}" ng-click="$ctrl.selectCategory(category)">' +
      '          <div class="connector-list-item__header">' +
      '            <strong>{{category.name}}</strong>' +
      '            <span class="rss-feed-count-badge">{{category.feeds.length}}</span>' +
      '          </div>' +
      '          <span class="connector-list-item__meta">{{category.description || "No description yet"}}</span>' +
      '        </button>' +
      '      </div>' +
      '    </aside>' +
      '    <section class="connectors-detail-panel rss-feeds-detail-panel">' +
      '      <div class="connectors-panel-header">' +
      '        <div class="eyebrow">Feeds</div>' +
      '        <h2 class="connectors-panel-title">{{$ctrl.selectedCategory ? $ctrl.selectedCategory.name : "Select a category"}}</h2>' +
      '      </div>' +
      '      <div class="connectors-empty-state connectors-empty-state--detail" ng-if="!$ctrl.selectedCategory">' +
      '        <strong>Choose a category first</strong>' +
      '        <span>Add one on the left or select an existing category to start collecting feeds.</span>' +
      '      </div>' +
      '      <div ng-if="$ctrl.selectedCategory">' +
      '        <p class="connectors-panel-copy">{{$ctrl.selectedCategory.description || "This category does not have a description yet."}}</p>' +
      '        <form class="rss-feeds-form rss-feeds-form--feed" ng-submit="$ctrl.addFeed()" novalidate>' +
      '          <div class="rss-feeds-feed-grid">' +
      '            <div>' +
      '              <label class="form-label" for="rssFeedName">Feed name</label>' +
      '              <input id="rssFeedName" class="form-control" type="text" ng-model="$ctrl.feedForm.name" placeholder="Ars Technica" required />' +
      '            </div>' +
      '            <div>' +
      '              <label class="form-label" for="rssFeedUrl">Feed URL</label>' +
      '              <input id="rssFeedUrl" class="form-control" type="url" ng-model="$ctrl.feedForm.url" placeholder="https://example.com/rss.xml" required />' +
      '            </div>' +
      '          </div>' +
      '          <div class="modal-actions modal-actions--page rss-feeds-actions">' +
      '            <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.clearFeedForm()">Clear</button>' +
      '            <button type="submit" class="btn btn-primary" ng-disabled="$ctrl.isSavingFeed || !$ctrl.feedForm.name || !$ctrl.feedForm.url">Add feed</button>' +
      '            <button type="button" class="btn btn-outline-danger" ng-click="$ctrl.deleteSelectedCategory()" ng-disabled="$ctrl.isDeletingCategory || !$ctrl.selectedCategory">Delete category</button>' +
      '          </div>' +
      '        </form>' +
      '        <div class="rss-feed-list" ng-if="$ctrl.selectedCategory.feeds.length">' +
      '          <article class="rss-feed-item" ng-repeat="feed in $ctrl.selectedCategory.feeds track by feed.id">' +
      '            <div class="rss-feed-item__copy">' +
      '              <strong>{{feed.name}}</strong>' +
      '              <a class="rss-feed-item__url" ng-href="{{feed.url}}" target="_blank" rel="noreferrer">{{feed.url}}</a>' +
      '            </div>' +
      '            <button type="button" class="btn btn-sm btn-outline-light" ng-click="$ctrl.removeFeed(feed.id)" ng-disabled="$ctrl.isSavingFeed">Remove</button>' +
      '          </article>' +
      '        </div>' +
      '        <div class="connectors-empty-state" ng-if="!$ctrl.selectedCategory.feeds.length">' +
      '          <strong>No feeds yet</strong>' +
      '          <span>Add your first RSS source for this category using the form above.</span>' +
      '        </div>' +
      '      </div>' +
      '    </section>' +
      '  </div>' +
      '</section>',
    controller: RssFeedsPageController
  });

  RssFeedsPageController.$inject = ['RssFeedService', 'NotificationService'];

  function RssFeedsPageController(RssFeedService, NotificationService) {
    var $ctrl = this;

    $ctrl.categories = [];
    $ctrl.selectedCategory = null;
    $ctrl.categoryForm = buildEmptyCategoryForm();
    $ctrl.feedForm = buildEmptyFeedForm();
    $ctrl.isLoading = false;
    $ctrl.isSavingCategory = false;
    $ctrl.isSavingFeed = false;
    $ctrl.isDeletingCategory = false;

    $ctrl.$onInit = function onInit() {
      $ctrl.loadCategories();
    };

    $ctrl.loadCategories = function loadCategories(selectedCategoryId) {
      $ctrl.isLoading = true;

      return RssFeedService.listCategories().then(function handleCategories(categories) {
        $ctrl.categories = categories;
        syncSelectedCategory(selectedCategoryId);
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'RSS feeds are currently unavailable.'), 'Unable to load RSS feeds');
      }).finally(function clearLoading() {
        $ctrl.isLoading = false;
      });
    };

    $ctrl.selectCategory = function selectCategory(category) {
      $ctrl.selectedCategory = category;
      $ctrl.categoryForm = {
        id: category.id,
        name: category.name,
        description: category.description || ''
      };
    };

    $ctrl.isSelectedCategory = function isSelectedCategory(category) {
      return !!($ctrl.selectedCategory && category && $ctrl.selectedCategory.id === category.id);
    };

    $ctrl.startNewCategory = function startNewCategory() {
      $ctrl.selectedCategory = null;
      $ctrl.categoryForm = buildEmptyCategoryForm();
    };

    $ctrl.saveCategory = function saveCategory() {
      var request;

      if (!$ctrl.categoryForm.name) {
        return;
      }

      $ctrl.isSavingCategory = true;

      request = $ctrl.categoryForm.id
        ? RssFeedService.updateCategory($ctrl.categoryForm.id, $ctrl.categoryForm)
        : RssFeedService.createCategory($ctrl.categoryForm);

      request.then(function handleSaved(category) {
        NotificationService.success($ctrl.categoryForm.id ? 'Category updated.' : 'Category created.', 'RSS category saved');
        $ctrl.categoryForm = buildEmptyCategoryForm();
        return $ctrl.loadCategories(category.id);
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to save category.'), 'Unable to save category');
      }).finally(function clearSaving() {
        $ctrl.isSavingCategory = false;
      });
    };

    $ctrl.addFeed = function addFeed() {
      if (!$ctrl.selectedCategory || !$ctrl.feedForm.name || !$ctrl.feedForm.url) {
        return;
      }

      $ctrl.isSavingFeed = true;

      RssFeedService.addFeed($ctrl.selectedCategory.id, $ctrl.feedForm).then(function handleAdded(category) {
        $ctrl.feedForm = buildEmptyFeedForm();
        NotificationService.success('Feed added.', 'RSS feed saved');
        return $ctrl.loadCategories(category.id);
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to add feed.'), 'Unable to add feed');
      }).finally(function clearSaving() {
        $ctrl.isSavingFeed = false;
      });
    };

    $ctrl.removeFeed = function removeFeed(feedId) {
      if (!$ctrl.selectedCategory) {
        return;
      }

      $ctrl.isSavingFeed = true;

      RssFeedService.removeFeed($ctrl.selectedCategory.id, feedId).then(function handleRemoved(category) {
        NotificationService.success('Feed removed.', 'RSS feed removed');
        return $ctrl.loadCategories(category.id);
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to remove feed.'), 'Unable to remove feed');
      }).finally(function clearSaving() {
        $ctrl.isSavingFeed = false;
      });
    };

    $ctrl.deleteSelectedCategory = function deleteSelectedCategory() {
      var currentCategoryId;

      if (!$ctrl.selectedCategory) {
        return;
      }

      currentCategoryId = $ctrl.selectedCategory.id;
      $ctrl.isDeletingCategory = true;

      RssFeedService.deleteCategory(currentCategoryId).then(function handleDeleted() {
        NotificationService.success('Category deleted.', 'RSS category removed');
        $ctrl.categoryForm = buildEmptyCategoryForm();
        $ctrl.feedForm = buildEmptyFeedForm();
        return $ctrl.loadCategories();
      }).catch(function handleError(error) {
        NotificationService.error(getErrorMessage(error, 'Unable to delete category.'), 'Unable to delete category');
      }).finally(function clearDeleting() {
        $ctrl.isDeletingCategory = false;
      });
    };

    $ctrl.clearFeedForm = function clearFeedForm() {
      $ctrl.feedForm = buildEmptyFeedForm();
    };

    function syncSelectedCategory(selectedCategoryId) {
      var nextSelectedCategory = null;

      if (selectedCategoryId) {
        nextSelectedCategory = findCategoryById(selectedCategoryId, $ctrl.categories);
      }

      if (!nextSelectedCategory && $ctrl.selectedCategory) {
        nextSelectedCategory = findCategoryById($ctrl.selectedCategory.id, $ctrl.categories);
      }

      $ctrl.selectedCategory = nextSelectedCategory || ($ctrl.categories.length ? $ctrl.categories[0] : null);

      if ($ctrl.selectedCategory) {
        $ctrl.categoryForm = {
          id: $ctrl.selectedCategory.id,
          name: $ctrl.selectedCategory.name,
          description: $ctrl.selectedCategory.description || ''
        };
      }
    }

  }

  function buildEmptyCategoryForm() {
    return {
      id: '',
      name: '',
      description: ''
    };
  }

  function buildEmptyFeedForm() {
    return {
      name: '',
      url: ''
    };
  }

  function findCategoryById(categoryId, categories) {
    return (categories || []).find(function findCategory(category) {
      return category.id === categoryId;
    }) || null;
  }

  function getErrorMessage(error, fallbackMessage) {
    if (error && error.data && typeof error.data.message === 'string' && error.data.message.trim()) {
      return error.data.message;
    }

    return fallbackMessage;
  }
})();
