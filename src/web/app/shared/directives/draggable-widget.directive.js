(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('draggableWidget', draggableWidget);

  function draggableWidget() {
    return {
      restrict: 'A',
      scope: {
        widget: '=',
        onMove: '&',
        enabled: '<'
      },
      link: function link(scope, element) {
        function syncPosition() {
          element.css({
            transform: 'translate(' + scope.widget.x + 'px, ' + scope.widget.y + 'px)'
          });
        }

        syncPosition();
        element.toggleClass('widget-card--editable', !!scope.enabled);

        var interactable = interact(element[0]).draggable({
          modifiers: [
            interact.modifiers.restrictRect({
              restriction: 'parent',
              endOnly: true
            })
          ],
          listeners: {
            move: function onMove(event) {
              scope.$applyAsync(function applyMove() {
                scope.widget.x += event.dx;
                scope.widget.y += event.dy;
                syncPosition();
              });
            },
            end: function onEnd() {
              scope.$applyAsync(function applyEnd() {
                scope.onMove({
                  widget: scope.widget
                });
              });
            }
          }
        });

        scope.$watchGroup(['widget.x', 'widget.y'], syncPosition);
        scope.$watch('enabled', function watchEnabled(isEnabled) {
          interactable.draggable({
            enabled: !!isEnabled
          });
          element.toggleClass('widget-card--editable', !!isEnabled);
        });

        scope.$on('$destroy', function destroy() {
          interactable.unset();
        });
      }
    };
  }
})();
