(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('overflowAutopan', overflowAutopan);

  overflowAutopan.$inject = ['$window', '$timeout', '$interval'];

  function overflowAutopan($window, $timeout, $interval) {
    return {
      restrict: 'A',
      link: function link(scope, element) {
        var host = element[0];
        var tickPromise = null;
        var refreshPromise = null;
        var resizeObserver = null;
        var mutationObserver = null;
        var direction = 1;
        var threshold = 50;
        var stepSize = 1;
        var stepIntervalMs = 36;
        var pauseUntil = 0;
        var isHovered = false;

        function maxScrollTop() {
          return Math.max(0, host.scrollHeight - host.clientHeight);
        }

        function stopTicker() {
          if (tickPromise) {
            $interval.cancel(tickPromise);
            tickPromise = null;
          }
        }

        function resetPosition() {
          direction = 1;
          pauseUntil = 0;
          host.scrollTop = 0;
        }

        function tick() {
          var limit = maxScrollTop();
          var now = Date.now();
          var nextValue;

          if (limit <= threshold) {
            resetPosition();
            stopTicker();
            return;
          }

          if (isHovered) {
            return;
          }

          if (pauseUntil && now < pauseUntil) {
            return;
          }

          nextValue = host.scrollTop + (stepSize * direction);

          if (direction > 0 && nextValue >= limit) {
            host.scrollTop = limit;
            direction = -1;
            pauseUntil = now + 1200;
            return;
          }

          if (direction < 0 && nextValue <= 0) {
            host.scrollTop = 0;
            direction = 1;
            pauseUntil = now + 1200;
            return;
          }

          host.scrollTop = nextValue;
        }

        function refresh() {
          if (maxScrollTop() <= threshold) {
            resetPosition();
            stopTicker();
            return;
          }

          if (!tickPromise) {
            tickPromise = $interval(tick, stepIntervalMs, 0, false);
          }
        }

        function scheduleRefresh() {
          if (refreshPromise) {
            $timeout.cancel(refreshPromise);
          }

          refreshPromise = $timeout(function runRefresh() {
            refreshPromise = null;
            refresh();
          }, 80, false);
        }

        if ($window.ResizeObserver) {
          resizeObserver = new $window.ResizeObserver(scheduleRefresh);
          resizeObserver.observe(host);
          if (host.parentElement) {
            resizeObserver.observe(host.parentElement);
          }
        }

        if ($window.MutationObserver) {
          mutationObserver = new $window.MutationObserver(scheduleRefresh);
          mutationObserver.observe(host, {
            childList: true,
            subtree: true,
            characterData: true
          });
        }

        element.on('mouseenter', function handleMouseEnter() {
          isHovered = true;
        });

        element.on('mouseleave', function handleMouseLeave() {
          isHovered = false;
        });

        scheduleRefresh();
        $timeout(refresh, 300, false);
        $timeout(refresh, 1200, false);

        scope.$on('$destroy', function destroy() {
          stopTicker();

          if (refreshPromise) {
            $timeout.cancel(refreshPromise);
          }

          if (resizeObserver) {
            resizeObserver.disconnect();
          }

          if (mutationObserver) {
            mutationObserver.disconnect();
          }

          element.off('mouseenter');
          element.off('mouseleave');
        });
      }
    };
  }
})();
