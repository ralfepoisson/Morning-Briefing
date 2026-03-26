(function () {
  'use strict';

  angular.module('morningBriefingApp').service('AudioBriefingService', AudioBriefingService);

  AudioBriefingService.$inject = ['$http', '$q', 'ApiConfig'];

  function AudioBriefingService($http, $q, ApiConfig) {
    function buildAbsolutePlaybackUrl(playbackUrl) {
      var apiOrigin;

      if (/^https?:\/\//i.test(playbackUrl || '')) {
        return playbackUrl;
      }

      apiOrigin = (ApiConfig.baseUrl || '').replace(/\/api\/v1\/?$/, '');
      return apiOrigin + playbackUrl;
    }

    this.getPreferences = function getPreferences(dashboardId) {
      if (!dashboardId) {
        return $q.resolve(null);
      }

      return $http.get(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/audio-briefing/preferences').then(function handleResponse(response) {
        return response.data || null;
      });
    };

    this.updatePreferences = function updatePreferences(dashboardId, payload) {
      return $http.patch(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/audio-briefing/preferences', payload || {}).then(function handleResponse(response) {
        return response.data || null;
      });
    };

    this.getLatest = function getLatest(dashboardId) {
      if (!dashboardId) {
        return $q.resolve(null);
      }

      return $http.get(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/audio-briefing').then(function handleResponse(response) {
        return response.data || null;
      }).catch(function handleError(error) {
        if (error && error.status === 404) {
          return null;
        }

        throw error;
      });
    };

    this.generate = function generate(dashboardId, options) {
      console.info('[AudioBriefingService] generate request', {
        dashboardId: dashboardId,
        force: !!(options && options.force)
      });
      return $http.post(ApiConfig.baseUrl + '/dashboards/' + dashboardId + '/audio-briefing/generate', {
        force: !!(options && options.force)
      }).then(function handleResponse(response) {
        console.info('[AudioBriefingService] generate response', {
          dashboardId: dashboardId,
          reused: !!(response.data && response.data.reused),
          briefingId: response.data && response.data.briefing ? response.data.briefing.id : null
        });
        return response.data || null;
      });
    };

    this.fetchAudioPlaybackUrl = function fetchAudioPlaybackUrl(audio) {
      if (!audio || !audio.playbackUrl) {
        return $q.reject(new Error('Audio playback is not available.'));
      }

      console.info('[AudioBriefingService] fetch playback audio', {
        audioId: audio.id,
        playbackUrl: buildAbsolutePlaybackUrl(audio.playbackUrl)
      });

      return $http.get(buildAbsolutePlaybackUrl(audio.playbackUrl), {
        responseType: 'arraybuffer'
      }).then(function handleResponse(response) {
        var mimeType = audio.mimeType || response.headers('content-type') || 'audio/wav';
        var blob = new Blob([response.data], {
          type: mimeType
        });
        console.info('[AudioBriefingService] playback audio fetched', {
          audioId: audio.id,
          mimeType: mimeType,
          byteLength: response.data ? response.data.byteLength : 0
        });

        return URL.createObjectURL(blob);
      });
    };
  }
})();
