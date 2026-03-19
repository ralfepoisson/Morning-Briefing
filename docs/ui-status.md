# UI Status

This document tracks the current state of the web UI MVP under `src/web/`.

## Current status

The frontend currently exists as a Bootstrap + AngularJS single-page application. Dashboard list, widget CRUD, and weather widget configuration now target the backend REST API, while widget content itself remains mocked in the UI/backend definition layer.

## Implemented

### Application shell

- AngularJS app scaffold under `src/web/`
- npm project initialised for the frontend
- Bootstrap styling integrated
- Font Awesome Free integrated for UI icons
- Theme-aware branding using `logo-dark.png` and `logo-light.png`

### Top navigation

- Horizontal top navigation bar
- Dark mode and light mode toggle
- Theme preference is stored in local storage and restored on page load
- Dashboard dropdown in the top navigation for selecting existing dashboards
- Dashboard creation action inside the top navigation dropdown
- Simplified top navigation with secondary sections removed from the main bar
- Compact branding treatment using the provided logo assets

### Dashboard workspace

- Dashboard title and description shown in a compact header area
- Modal-based dashboard configuration
- Modal-based dashboard creation
- Newly created dashboards open in edit mode on first load
- Explicit dashboard edit mode
- `Edit Dashboard` / `Save Dashboard` flow
- Dashboard list and create actions are wired to the backend REST API
- Dashboard save now persists widget layout and widget configuration edits through backend widget update endpoints

### Widget editing

- Widgets can be dragged in edit mode
- Widget edit affordances now use per-widget circular cog buttons in edit mode
- Widget library opens from a right-side panel
- Widget library adds widgets through backend widget endpoints
- Dashboard widgets now load from backend widget endpoints
- Widget library includes placeholder slots for future widget types

### Weather widget

- Mocked weather widget implemented
- Weather tile includes current conditions, supporting summary, and detail chips
- Weather widget can be configured with a city in dashboard edit mode
- Weather location search uses backend reference-city endpoints

### Calendar widget

- Mocked calendar widget implemented
- Calendar tile shows same-day appointments
- Each appointment shows time, title, and location
- Calendar tile supports vertical resizing in edit mode

## Current limitations

- Widget content is mocked and does not yet come from briefing snapshots or live connectors
- Dashboard metadata updates are only partially wired and broader dashboard management is still minimal
- Layout editing is custom and lightweight rather than using a dedicated dashboard grid library
- Widget resizing is currently implemented only for calendar widgets
- Only weather widgets currently expose configurable settings

## Next likely UI steps

- Add more widget types to the widget library
- Add configuration UIs for calendar and task widgets
- Improve dashboard switching and multi-dashboard management
- Connect widgets to snapshot-backed or live data
- Refine spacing, responsive behaviour, and visual polish across themes
