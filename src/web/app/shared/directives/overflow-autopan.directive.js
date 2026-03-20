(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('overflowAutopan', overflowAutopan);

  overflowAutopan.$inject = ['$window', '$timeout', '$interval'];

  function overflowAutopan($window, $timeout, $interval) {
    return {
      restrict: 'A',
      link: function link(scope, element) {
        var host = element[0];
        var animationFrameId = null;
        var refreshIntervalId = null;
        var resizeObserver = null;
        var mutationObserver = null;
        var pausedUntil = 0;
        var direction = 1;
        var lastTimestamp = 0;
        var speed = 0.03;
        var threshold = 50;

        function getMaxScrollTop() {
          return Math.max(0, host.scrollHeight - host.clientHeight);
        }

        function stop() {
          if (animationFrameId) {
            $window.cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
          }
        }

        function step(timestamp) {
          var delta;
          var maxScrollTop;
          var nextScrollTop;

          animationFrameId = $window.requestAnimationFrame(step);

          if (!lastTimestamp) {
            lastTimestamp = timestamp;
          }

          maxScrollTop = getMaxScrollTop();

          if (maxScrollTop <= threshold) {
            host.scrollTop = 0;
            direction = 1;
            pausedUntil = 0;
            lastTimestamp = timestamp;
            return;
          }

          if (pausedUntil && timestamp < pausedUntil) {
            lastTimestamp = timestamp;
            return;
          }

          delta = (timestamp - lastTimestamp) * speed * direction;
          lastTimestamp = timestamp;
          nextScrollTop = host.scrollTop + delta;

          if (direction > 0 && nextScrollTop >= maxScrollTop) {
            host.scrollTop = maxScrollTop;
            direction = -1;
            pausedUntil = timestamp + 900;
            return;
          }

          if (direction < 0 && nextScrollTop <= 0) {
            host.scrollTop = 0;
            direction = 1;
            pausedUntil = timestamp + 900;
            return;
          }

          host.scrollTop = nextScrollTop;
        }

        function refresh() {
          lastTimestamp = 0;

          if (getMaxScrollTop() <= threshold) {
            host.scrollTop = 0;
            direction = 1;
            pausedUntil = 0;
            stop();
            return;
          }

          if (!animationFrameId) {
            animationFrameId = $window.requestAnimationFrame(step);
          }
        }

        if ($window.ResizeObserver) {
          resizeObserver = new $window.ResizeObserver(function handleResize() {
            refresh();
          });
          resizeObserver.observe(host);
          if (host.parentElement) {
            resizeObserver.observe(host.parentElement);
          }
        }

        if ($window.MutationObserver) {
          mutationObserver = new $window.MutationObserver(function handleMutations() {
            refresh();
          });
          mutationObserver.observe(host, {
            childList: true,
            subtree: true,
            characterData: true
          });
        }

        refreshIntervalId = $interval(refresh, 1500, 0, false);

        $timeout(refresh, 0, false);
        $timeout(refresh, 250, false);
        $timeout(refresh, 1000, false);

        scope.$on('$destroy', function destroy() {
          stop();

          if (refreshIntervalId) {
            $interval.cancel(refreshIntervalId);
          }

          if (resizeObserver) {
            resizeObserver.disconnect();
          }

          if (mutationObserver) {
            mutationObserver.disconnect();
          }
        });
      }
    };
  }
})();
