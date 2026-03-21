(function () {
  'use strict';

  angular.module('morningBriefingApp').service('RssFeedService', RssFeedService);

  RssFeedService.$inject = ['$http', '$q', 'LocalStorageService', 'ApiConfig'];

  function RssFeedService($http, $q, LocalStorageService, ApiConfig) {
    var STORAGE_KEY = 'morningBriefing.rssFeeds';
    var backendAvailable = true;

    this.listCategories = function listCategories() {
      return requestBackendCategories().catch(function handleBackendFailure() {
        backendAvailable = false;
        return loadLegacyCategories();
      });
    };

    this.createCategory = function createCategory(payload) {
      if (!backendAvailable) {
        return $q.resolve(createLegacyCategory(payload));
      }

      return $http.post(ApiConfig.baseUrl + '/rss-feeds/categories', {
        name: payload.name,
        description: payload.description || ''
      }).then(function handleResponse(response) {
        return response.data;
      }).catch(function handleFailure() {
        backendAvailable = false;
        return createLegacyCategory(payload);
      });
    };

    this.updateCategory = function updateCategory(categoryId, payload) {
      if (!backendAvailable) {
        return $q.resolve(updateLegacyCategory(categoryId, payload));
      }

      return $http.patch(ApiConfig.baseUrl + '/rss-feeds/categories/' + encodeURIComponent(categoryId), {
        name: payload.name,
        description: payload.description || ''
      }).then(function handleResponse(response) {
        return response.data;
      }).catch(function handleFailure() {
        backendAvailable = false;
        return updateLegacyCategory(categoryId, payload);
      });
    };

    this.deleteCategory = function deleteCategory(categoryId) {
      if (!backendAvailable) {
        deleteLegacyCategory(categoryId);
        return $q.resolve();
      }

      return $http.delete(ApiConfig.baseUrl + '/rss-feeds/categories/' + encodeURIComponent(categoryId)).catch(function handleFailure() {
        backendAvailable = false;
        deleteLegacyCategory(categoryId);
      });
    };

    this.addFeed = function addFeed(categoryId, payload) {
      if (!backendAvailable) {
        return $q.resolve(addLegacyFeed(categoryId, payload));
      }

      return $http.post(ApiConfig.baseUrl + '/rss-feeds/categories/' + encodeURIComponent(categoryId) + '/feeds', {
        name: payload.name,
        url: payload.url
      }).then(function handleResponse(response) {
        return response.data;
      }).catch(function handleFailure() {
        backendAvailable = false;
        return addLegacyFeed(categoryId, payload);
      });
    };

    this.removeFeed = function removeFeed(categoryId, feedId) {
      if (!backendAvailable) {
        return $q.resolve(removeLegacyFeed(categoryId, feedId));
      }

      return $http.delete(
        ApiConfig.baseUrl + '/rss-feeds/categories/' + encodeURIComponent(categoryId) + '/feeds/' + encodeURIComponent(feedId)
      ).then(function handleResponse(response) {
        return response.data;
      }).catch(function handleFailure() {
        backendAvailable = false;
        return removeLegacyFeed(categoryId, feedId);
      });
    };

    function requestBackendCategories() {
      return $http.get(ApiConfig.baseUrl + '/rss-feeds').then(function handleResponse(response) {
        var items = response.data.items || [];

        if (items.length) {
          return items;
        }

        return importLegacyIntoBackend(items);
      });
    }

    function importLegacyIntoBackend(existingItems) {
      var legacyCategories = loadLegacyCategories();

      if (!legacyCategories.length) {
        return existingItems;
      }

      return legacyCategories.reduce(function chainImport(promise, category) {
        return promise.then(function importCategory() {
          return $http.post(ApiConfig.baseUrl + '/rss-feeds/categories', {
            name: category.name,
            description: category.description || ''
          }).then(function handleCategoryCreated(response) {
            return (category.feeds || []).reduce(function chainFeedImport(feedPromise, feed) {
              return feedPromise.then(function importFeed() {
                return $http.post(ApiConfig.baseUrl + '/rss-feeds/categories/' + encodeURIComponent(response.data.id) + '/feeds', {
                  name: feed.name,
                  url: feed.url
                });
              });
            }, $q.resolve());
          });
        });
      }, $q.resolve()).then(function handleImported() {
        LocalStorageService.remove(STORAGE_KEY);

        return $http.get(ApiConfig.baseUrl + '/rss-feeds').then(function refresh(response) {
          return response.data.items || existingItems;
        });
      }).catch(function ignoreImportError() {
        return existingItems.length ? existingItems : legacyCategories;
      });
    }

    function loadLegacyCategories() {
      var rawValue = LocalStorageService.get(STORAGE_KEY);
      var parsed;

      if (!rawValue) {
        return [];
      }

      try {
        parsed = JSON.parse(rawValue);
      } catch (error) {
        return [];
      }

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(function filterCategory(category) {
        return category && typeof category.name === 'string' && category.name.trim();
      }).map(cloneCategory);
    }

    function saveLegacyCategories(categories) {
      LocalStorageService.set(STORAGE_KEY, JSON.stringify(categories));
    }

    function createLegacyCategory(payload) {
      var categories = loadLegacyCategories();
      var name = sanitizeText(payload && payload.name);
      var category;

      if (!name) {
        throw new Error('Category name is required.');
      }

      if (findCategoryByName(categories, name)) {
        throw new Error('A category with that name already exists.');
      }

      category = {
        id: createId('category'),
        name: name,
        description: sanitizeText(payload && payload.description),
        feeds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      categories.push(category);
      saveLegacyCategories(categories);

      return cloneCategory(category);
    }

    function updateLegacyCategory(categoryId, payload) {
      var categories = loadLegacyCategories();
      var category = findCategoryById(categories, categoryId);
      var name = sanitizeText(payload && payload.name);

      if (!category) {
        throw new Error('Category not found.');
      }

      if (!name) {
        throw new Error('Category name is required.');
      }

      if (findCategoryByName(categories, name, categoryId)) {
        throw new Error('A category with that name already exists.');
      }

      category.name = name;
      category.description = sanitizeText(payload && payload.description);
      category.updatedAt = new Date().toISOString();
      saveLegacyCategories(categories);

      return cloneCategory(category);
    }

    function deleteLegacyCategory(categoryId) {
      var categories = loadLegacyCategories();
      var nextCategories = categories.filter(function filterCategory(category) {
        return category.id !== categoryId;
      });

      if (nextCategories.length === categories.length) {
        throw new Error('Category not found.');
      }

      saveLegacyCategories(nextCategories);
    }

    function addLegacyFeed(categoryId, payload) {
      var categories = loadLegacyCategories();
      var category = findCategoryById(categories, categoryId);
      var name = sanitizeText(payload && payload.name);
      var url = sanitizeUrl(payload && payload.url);

      if (!category) {
        throw new Error('Category not found.');
      }

      if (!name) {
        throw new Error('Feed name is required.');
      }

      if (!url) {
        throw new Error('A valid feed URL is required.');
      }

      if ((category.feeds || []).some(function hasFeed(feed) {
        return feed.url.toLowerCase() === url.toLowerCase();
      })) {
        throw new Error('That feed URL already exists in this category.');
      }

      category.feeds = category.feeds || [];
      category.feeds.push({
        id: createId('feed'),
        name: name,
        url: url,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      category.updatedAt = new Date().toISOString();
      saveLegacyCategories(categories);

      return cloneCategory(category);
    }

    function removeLegacyFeed(categoryId, feedId) {
      var categories = loadLegacyCategories();
      var category = findCategoryById(categories, categoryId);
      var nextFeeds;

      if (!category) {
        throw new Error('Category not found.');
      }

      nextFeeds = (category.feeds || []).filter(function filterFeed(feed) {
        return feed.id !== feedId;
      });

      if (nextFeeds.length === (category.feeds || []).length) {
        throw new Error('Feed not found.');
      }

      category.feeds = nextFeeds;
      category.updatedAt = new Date().toISOString();
      saveLegacyCategories(categories);

      return cloneCategory(category);
    }
  }

  function cloneCategory(category) {
    return {
      id: category.id,
      name: category.name,
      description: category.description || '',
      feeds: Array.isArray(category.feeds) ? category.feeds.map(function mapFeed(feed) {
        return {
          id: feed.id,
          name: feed.name,
          url: feed.url,
          createdAt: feed.createdAt,
          updatedAt: feed.updatedAt
        };
      }) : [],
      createdAt: category.createdAt,
      updatedAt: category.updatedAt
    };
  }

  function findCategoryById(categories, categoryId) {
    return (categories || []).find(function findCategory(category) {
      return category.id === categoryId;
    }) || null;
  }

  function findCategoryByName(categories, name, ignoredCategoryId) {
    var normalizedName = name.toLowerCase();

    return (categories || []).find(function findCategory(category) {
      return category.id !== ignoredCategoryId && category.name.toLowerCase() === normalizedName;
    }) || null;
  }

  function sanitizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function sanitizeUrl(value) {
    var text = sanitizeText(value);

    if (!text) {
      return '';
    }

    try {
      var url = new URL(text);

      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return '';
      }

      return url.toString();
    } catch (error) {
      return '';
    }
  }

  function createId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
})();
