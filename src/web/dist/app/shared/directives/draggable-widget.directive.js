(function () {
  'use strict';

  angular.module('morningBriefingApp').directive('draggableWidget', draggableWidget);

  draggableWidget.$inject = ['WidgetRegistryService'];

  function draggableWidget(WidgetRegistryService) {
    return {
      restrict: 'A',
      scope: {
        widget: '=',
        onMove: '&',
        onResize: '&',
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

        interactable.resizable({
          edges: {
            right: '.widget-resize-handle',
            bottom: '.widget-resize-handle'
          },
          modifiers: [
            interact.modifiers.restrictSize({
              min: {
                width: getMinWidth(),
                height: getMinHeight()
              }
            })
          ],
          listeners: {
            move: function onResizeMove(event) {
              if (!isResizable()) {
                return;
              }

              scope.$applyAsync(function applyResizeMove() {
                scope.widget.width = Math.round(event.rect.width);
                scope.widget.height = Math.round(event.rect.height);
              });
            },
            end: function onResizeEnd() {
              if (!isResizable()) {
                return;
              }

              scope.$applyAsync(function applyResizeEnd() {
                scope.onResize({
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
          interactable.resizable({
            enabled: !!isEnabled && isResizable()
          });
          element.toggleClass('widget-card--editable', !!isEnabled);
        });

        scope.$on('$destroy', function destroy() {
          interactable.unset();
        });

        function isResizable() {
          var definition = WidgetRegistryService.get(scope.widget.type);

          return !!(definition && definition.resizable);
        }

        function getMinWidth() {
          var definition = WidgetRegistryService.get(scope.widget.type);

          return definition && definition.resizable && definition.resizable.minWidth
            ? definition.resizable.minWidth
            : 140;
        }

        function getMinHeight() {
          var definition = WidgetRegistryService.get(scope.widget.type);

          return definition && definition.resizable && definition.resizable.minHeight
            ? definition.resizable.minHeight
            : 140;
        }
      }
    };
  }
})();
