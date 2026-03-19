# UI Status

This document tracks the current state of the web UI MVP under `src/web/`.

## Current status

The frontend currently exists as a Bootstrap + AngularJS single-page application. Dashboard list and create flows now target the backend REST API, while widget content and layout state remain mocked in the UI layer.

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
- Dashboard save now persists widget layout edits through backend widget update endpoints

### Widget editing

- Widgets can be dragged in edit mode
- Widget library opens from a right-side panel
- Widget library adds widgets through backend widget endpoints
- Dashboard widgets now load from backend widget endpoints
- Widget library includes placeholder slots for future widget types

### Weather widget

- Mocked weather widget implemented
- Weather tile includes current conditions, supporting summary, and detail chips

### Calendar widget

- Mocked calendar widget implemented
- Calendar tile shows same-day appointments
- Each appointment shows time, title, and location
- Calendar tile supports vertical resizing in edit mode

## Current limitations

- Widget state is in memory only and is not yet persisted
- Widget content is mocked and does not yet come from briefing snapshots or live connectors
- Dashboard metadata updates are only partially wired and broader dashboard management is still minimal
- Layout editing is custom and lightweight rather than using a dedicated dashboard grid library
- Widget resizing is currently implemented only for calendar widgets

## Next likely UI steps

- Persist dashboard and widget layout state
- Add more widget types to the widget library
- Improve dashboard switching and multi-dashboard management
- Connect widgets to snapshot-backed or live data
- Refine spacing, responsive behaviour, and visual polish across themes
