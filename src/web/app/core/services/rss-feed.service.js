(function () {
  'use strict';

  angular.module('morningBriefingApp').service('RssFeedService', RssFeedService);

  RssFeedService.$inject = ['LocalStorageService'];

  function RssFeedService(LocalStorageService) {
    var STORAGE_KEY = 'morningBriefing.rssFeeds';

    this.listCategories = function listCategories() {
      return cloneCategories(loadCategories());
    };

    this.createCategory = function createCategory(payload) {
      var categories = loadCategories();
      var categoryName = sanitizeText(payload && payload.name);

      if (!categoryName) {
        throw new Error('Enter a category name.');
      }

      if (findCategoryByName(categoryName, categories)) {
        throw new Error('A category with that name already exists.');
      }

      var category = {
        id: createId('category'),
        name: categoryName,
        description: sanitizeText(payload && payload.description),
        feeds: []
      };

      categories.push(category);
      persistCategories(categories);

      return cloneCategory(category);
    };

    this.updateCategory = function updateCategory(categoryId, payload) {
      var categories = loadCategories();
      var category = findCategoryById(categoryId, categories);
      var categoryName = sanitizeText(payload && payload.name);

      if (!category) {
        throw new Error('Category not found.');
      }

      if (!categoryName) {
        throw new Error('Enter a category name.');
      }

      if (findCategoryByName(categoryName, categories, categoryId)) {
        throw new Error('A category with that name already exists.');
      }

      category.name = categoryName;
      category.description = sanitizeText(payload && payload.description);
      persistCategories(categories);

      return cloneCategory(category);
    };

    this.deleteCategory = function deleteCategory(categoryId) {
      var categories = loadCategories();
      var categoryIndex = categories.findIndex(function (category) {
        return category.id === categoryId;
      });

      if (categoryIndex === -1) {
        throw new Error('Category not found.');
      }

      categories.splice(categoryIndex, 1);
      persistCategories(categories);

      return cloneCategories(categories);
    };

    this.addFeed = function addFeed(categoryId, payload) {
      var categories = loadCategories();
      var category = findCategoryById(categoryId, categories);
      var feedName = sanitizeText(payload && payload.name);
      var feedUrl = sanitizeUrl(payload && payload.url);

      if (!category) {
        throw new Error('Choose a category before adding a feed.');
      }

      if (!feedName) {
        throw new Error('Enter a feed name.');
      }

      if (!feedUrl) {
        throw new Error('Enter a valid RSS feed URL.');
      }

      if (category.feeds.some(function (feed) {
        return feed.url.toLowerCase() === feedUrl.toLowerCase();
      })) {
        throw new Error('That feed URL is already in this category.');
      }

      category.feeds.push({
        id: createId('feed'),
        name: feedName,
        url: feedUrl
      });

      persistCategories(categories);

      return cloneCategory(category);
    };

    this.removeFeed = function removeFeed(categoryId, feedId) {
      var categories = loadCategories();
      var category = findCategoryById(categoryId, categories);

      if (!category) {
        throw new Error('Category not found.');
      }

      category.feeds = category.feeds.filter(function (feed) {
        return feed.id !== feedId;
      });

      persistCategories(categories);

      return cloneCategory(category);
    };

    function loadCategories() {
      var storedValue = LocalStorageService.get(STORAGE_KEY);

      if (!storedValue) {
        persistCategories(DEFAULT_CATEGORIES);
        return cloneCategories(DEFAULT_CATEGORIES);
      }

      try {
        return normalizeCategories(JSON.parse(storedValue));
      } catch (error) {
        persistCategories(DEFAULT_CATEGORIES);
        return cloneCategories(DEFAULT_CATEGORIES);
      }
    }

    function persistCategories(categories) {
      LocalStorageService.set(STORAGE_KEY, JSON.stringify(normalizeCategories(categories)));
    }
  }

  var DEFAULT_CATEGORIES = [
    {
      id: 'category-world',
      name: 'World',
      description: 'International headlines and major geopolitics.',
      feeds: []
    },
    {
      id: 'category-business',
      name: 'Business',
      description: 'Markets, companies, and the broader economy.',
      feeds: []
    },
    {
      id: 'category-technology',
      name: 'Technology',
      description: 'AI, software, devices, and product launches.',
      feeds: []
    }
  ];

  function normalizeCategories(value) {
    if (!Array.isArray(value) || !value.length) {
      return cloneCategories(DEFAULT_CATEGORIES);
    }

    return value.reduce(function (categories, category, categoryIndex) {
      var categoryName = sanitizeText(category && category.name);

      if (!categoryName) {
        return categories;
      }

      categories.push({
        id: sanitizeText(category && category.id) || createFallbackId('category', categoryIndex),
        name: categoryName,
        description: sanitizeText(category && category.description),
        feeds: Array.isArray(category && category.feeds)
          ? category.feeds.reduce(function (feeds, feed, feedIndex) {
            var feedName = sanitizeText(feed && feed.name);
            var feedUrl = sanitizeUrl(feed && feed.url);

            if (!feedName || !feedUrl) {
              return feeds;
            }

            feeds.push({
              id: sanitizeText(feed && feed.id) || createFallbackId('feed', categoryIndex + '-' + feedIndex),
              name: feedName,
              url: feedUrl
            });

            return feeds;
          }, [])
          : []
      });

      return categories;
    }, []);
  }

  function findCategoryById(categoryId, categories) {
    return (categories || []).find(function (category) {
      return category.id === categoryId;
    }) || null;
  }

  function findCategoryByName(name, categories, ignoredCategoryId) {
    var normalizedName = name.toLowerCase();

    return (categories || []).find(function (category) {
      return category.id !== ignoredCategoryId && category.name.toLowerCase() === normalizedName;
    }) || null;
  }

  function cloneCategories(categories) {
    return (categories || []).map(cloneCategory);
  }

  function cloneCategory(category) {
    return {
      id: category.id,
      name: category.name,
      description: category.description || '',
      feeds: Array.isArray(category.feeds)
        ? category.feeds.map(function (feed) {
          return {
            id: feed.id,
            name: feed.name,
            url: feed.url
          };
        })
        : []
    };
  }

  function sanitizeText(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function sanitizeUrl(value) {
    var urlValue = sanitizeText(value);

    if (!urlValue) {
      return '';
    }

    try {
      var parsedUrl = new URL(urlValue);

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return '';
      }

      return parsedUrl.toString();
    } catch (error) {
      return '';
    }
  }

  function createId(prefix) {
    return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function createFallbackId(prefix, suffix) {
    return prefix + '-' + suffix;
  }
})();
