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
      '    <button type="button" class="btn btn-outline-light connectors-refresh-button" ng-click="$ctrl.resetDefaults()">' +
      '      <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>' +
      '      <span>Reset forms</span>' +
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
      '        <p class="connectors-panel-copy connectors-panel-copy--success" ng-if="$ctrl.categorySuccessMessage">{{$ctrl.categorySuccessMessage}}</p>' +
      '        <p class="connectors-panel-copy connectors-panel-copy--error" ng-if="$ctrl.categoryErrorMessage">{{$ctrl.categoryErrorMessage}}</p>' +
      '        <div class="modal-actions modal-actions--page rss-feeds-actions">' +
      '          <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.startNewCategory()">New category</button>' +
      '          <button type="submit" class="btn btn-primary" ng-disabled="!$ctrl.categoryForm.name">{{$ctrl.categoryForm.id ? "Save category" : "Add category"}}</button>' +
      '        </div>' +
      '      </form>' +
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
      '          <p class="connectors-panel-copy connectors-panel-copy--success" ng-if="$ctrl.feedSuccessMessage">{{$ctrl.feedSuccessMessage}}</p>' +
      '          <p class="connectors-panel-copy connectors-panel-copy--error" ng-if="$ctrl.feedErrorMessage">{{$ctrl.feedErrorMessage}}</p>' +
      '          <div class="modal-actions modal-actions--page rss-feeds-actions">' +
      '            <button type="button" class="btn btn-outline-secondary" ng-click="$ctrl.clearFeedForm()">Clear</button>' +
      '            <button type="submit" class="btn btn-primary" ng-disabled="!$ctrl.feedForm.name || !$ctrl.feedForm.url">Add feed</button>' +
      '            <button type="button" class="btn btn-outline-danger" ng-click="$ctrl.deleteSelectedCategory()" ng-disabled="!$ctrl.selectedCategory">Delete category</button>' +
      '          </div>' +
      '        </form>' +
      '        <div class="rss-feed-list" ng-if="$ctrl.selectedCategory.feeds.length">' +
      '          <article class="rss-feed-item" ng-repeat="feed in $ctrl.selectedCategory.feeds track by feed.id">' +
      '            <div class="rss-feed-item__copy">' +
      '              <strong>{{feed.name}}</strong>' +
      '              <a class="rss-feed-item__url" ng-href="{{feed.url}}" target="_blank" rel="noreferrer">{{feed.url}}</a>' +
      '            </div>' +
      '            <button type="button" class="btn btn-sm btn-outline-light" ng-click="$ctrl.removeFeed(feed.id)">Remove</button>' +
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

  RssFeedsPageController.$inject = ['RssFeedService'];

  function RssFeedsPageController(RssFeedService) {
    var $ctrl = this;

    $ctrl.categories = [];
    $ctrl.selectedCategory = null;
    $ctrl.categoryForm = buildEmptyCategoryForm();
    $ctrl.feedForm = buildEmptyFeedForm();
    $ctrl.categoryErrorMessage = '';
    $ctrl.categorySuccessMessage = '';
    $ctrl.feedErrorMessage = '';
    $ctrl.feedSuccessMessage = '';

    $ctrl.$onInit = function onInit() {
      refreshCategories();
    };

    $ctrl.selectCategory = function selectCategory(category) {
      $ctrl.selectedCategory = category;
      $ctrl.categoryForm = {
        id: category.id,
        name: category.name,
        description: category.description || ''
      };
      clearCategoryMessages();
      clearFeedMessages();
    };

    $ctrl.isSelectedCategory = function isSelectedCategory(category) {
      return !!($ctrl.selectedCategory && category && $ctrl.selectedCategory.id === category.id);
    };

    $ctrl.startNewCategory = function startNewCategory() {
      $ctrl.selectedCategory = null;
      $ctrl.categoryForm = buildEmptyCategoryForm();
      clearCategoryMessages();
    };

    $ctrl.saveCategory = function saveCategory() {
      try {
        if ($ctrl.categoryForm.id) {
          RssFeedService.updateCategory($ctrl.categoryForm.id, $ctrl.categoryForm);
          $ctrl.categorySuccessMessage = 'Category updated.';
          clearCategoryError();
          refreshCategories($ctrl.categoryForm.id);
        } else {
          var newCategory = RssFeedService.createCategory($ctrl.categoryForm);
          $ctrl.categorySuccessMessage = 'Category created.';
          clearCategoryError();
          $ctrl.categoryForm = buildEmptyCategoryForm();
          refreshCategories(newCategory.id);
          clearFeedMessages();
          return;
        }
      } catch (error) {
        $ctrl.categoryErrorMessage = error.message || 'Unable to save category.';
        $ctrl.categorySuccessMessage = '';
      }
    };

    $ctrl.addFeed = function addFeed() {
      if (!$ctrl.selectedCategory) {
        return;
      }

      try {
        RssFeedService.addFeed($ctrl.selectedCategory.id, $ctrl.feedForm);
        $ctrl.feedForm = buildEmptyFeedForm();
        $ctrl.feedSuccessMessage = 'Feed added.';
        $ctrl.feedErrorMessage = '';
        refreshCategories($ctrl.selectedCategory.id);
      } catch (error) {
        $ctrl.feedErrorMessage = error.message || 'Unable to add feed.';
        $ctrl.feedSuccessMessage = '';
      }
    };

    $ctrl.removeFeed = function removeFeed(feedId) {
      if (!$ctrl.selectedCategory) {
        return;
      }

      try {
        RssFeedService.removeFeed($ctrl.selectedCategory.id, feedId);
        $ctrl.feedSuccessMessage = 'Feed removed.';
        $ctrl.feedErrorMessage = '';
        refreshCategories($ctrl.selectedCategory.id);
      } catch (error) {
        $ctrl.feedErrorMessage = error.message || 'Unable to remove feed.';
        $ctrl.feedSuccessMessage = '';
      }
    };

    $ctrl.deleteSelectedCategory = function deleteSelectedCategory() {
      if (!$ctrl.selectedCategory) {
        return;
      }

      try {
        var removedCategoryId = $ctrl.selectedCategory.id;

        RssFeedService.deleteCategory(removedCategoryId);
        $ctrl.categoryForm = buildEmptyCategoryForm();
        $ctrl.feedForm = buildEmptyFeedForm();
        $ctrl.categorySuccessMessage = 'Category deleted.';
        $ctrl.categoryErrorMessage = '';
        $ctrl.feedSuccessMessage = '';
        $ctrl.feedErrorMessage = '';
        refreshCategories();
      } catch (error) {
        $ctrl.categoryErrorMessage = error.message || 'Unable to delete category.';
        $ctrl.categorySuccessMessage = '';
      }
    };

    $ctrl.clearFeedForm = function clearFeedForm() {
      $ctrl.feedForm = buildEmptyFeedForm();
      clearFeedMessages();
    };

    $ctrl.resetDefaults = function resetDefaults() {
      $ctrl.categoryForm = $ctrl.selectedCategory
        ? {
          id: $ctrl.selectedCategory.id,
          name: $ctrl.selectedCategory.name,
          description: $ctrl.selectedCategory.description || ''
        }
        : buildEmptyCategoryForm();
      $ctrl.feedForm = buildEmptyFeedForm();
      clearCategoryMessages();
      clearFeedMessages();
    };

    function refreshCategories(selectedCategoryId) {
      $ctrl.categories = RssFeedService.listCategories();

      if (!$ctrl.categories.length) {
        $ctrl.selectedCategory = null;
        return;
      }

      if (selectedCategoryId) {
        $ctrl.selectedCategory = findCategoryById(selectedCategoryId, $ctrl.categories);
      }

      if (!$ctrl.selectedCategory) {
        $ctrl.selectedCategory = $ctrl.categories[0];
      }

      if ($ctrl.selectedCategory) {
        $ctrl.categoryForm = {
          id: $ctrl.selectedCategory.id,
          name: $ctrl.selectedCategory.name,
          description: $ctrl.selectedCategory.description || ''
        };
      }
    }

    function clearCategoryMessages() {
      $ctrl.categoryErrorMessage = '';
      $ctrl.categorySuccessMessage = '';
    }

    function clearCategoryError() {
      $ctrl.categoryErrorMessage = '';
    }

    function clearFeedMessages() {
      $ctrl.feedErrorMessage = '';
      $ctrl.feedSuccessMessage = '';
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
    return (categories || []).find(function (category) {
      return category.id === categoryId;
    }) || null;
  }
})();
