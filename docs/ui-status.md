# UI Status

This document tracks the current state of the web UI MVP under `src/web/`.

## Current status

The frontend currently exists as a Bootstrap + AngularJS single-page application. Dashboard list, widget CRUD, and weather widget configuration now target the backend REST API. Snapshot-based widgets now prefer explicit loading or failure states instead of seeded mock content while data is pending.

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
- Username/avatar button in the top right now opens a dedicated user profile page

### Dashboard workspace

- Dashboard title and description shown in a compact header area
- Modal-based dashboard configuration
- Modal-based dashboard creation
- Newly created dashboards open in edit mode on first load
- Explicit dashboard edit mode
- `Edit Dashboard` / `Save Dashboard` flow
- Icon-only dashboard refresh control beside `Edit Dashboard` reloads the current dashboard widgets and latest snapshot state, showing a loading spinner until the refresh completes
- Dashboard list and create actions are wired to the backend REST API
- Dashboard save now persists widget layout and widget configuration edits through backend widget update endpoints

### Widget editing

- Widgets can be dragged in edit mode
- Widget edit affordances now use per-widget circular cog buttons in edit mode
- Widget library opens from a right-side panel
- Widget library adds widgets through backend widget endpoints
- Dashboard widgets now load from backend widget endpoints
- Unsaved widget layout and size edits are now preserved when additional widgets are added during the same edit session
- Widget library includes placeholder slots for future widget types

### Weather widget

- Snapshot-backed weather widget implemented
- Weather tile includes current conditions, supporting summary, and detail chips when a snapshot is available
- Snapshot-backed widgets now show the latest snapshot timestamp in a muted footer at the bottom right of each widget card
- Weather widget can be configured with a city in dashboard edit mode
- Weather location search uses backend reference-city endpoints

### Calendar widget

- Snapshot-backed calendar widget implemented
- Calendar tile shows same-day appointments when snapshot data is available
- Each appointment shows time, title, and location
- Calendar tile supports vertical resizing in edit mode

### Email widget

- Gmail-backed email widget implemented
- Email tile supports multiple Gmail search filters and merges the matching messages into a single list
- Each email row shows timestamp, sender, subject, and read or unread status
- Email widget follows the same dashboard connection flow pattern as the calendar widget
- Widget configuration modals now offer an in-place Google reconnect action when the latest OAuth-backed snapshot failed during token refresh

### Connectors management

- Top navigation now routes to a dedicated Connectors page
- The Connectors page lists existing tenant connections with provider, auth type, status, and last update time
- Todoist connections can be renamed and have their API key replaced from the Connectors page
- Task-widget connection creation remains available from widget edit mode

### Admin operations

- The Widget Admin page lists the latest snapshot result for every widget
- Admins can manually queue snapshot regeneration per widget or for all snapshot-backed widgets in one action

### User profile and delivery configuration

- Dedicated Profile page under `#/profile`
- Users can edit display name, phonetic name, email address, profile image, timezone, and preferred language
- Generated briefing audio now greets the user with their phonetic name first, then their first name, then a generic greeting
- Profile data now persists through the backend `users/me` API instead of being treated as auth-token-only metadata
- News summaries and generated audio briefing scripts now follow the preferred language saved on the user profile
- Profile image uploads are stored with the user profile as base64 image data
- Large profile images are resized in the browser before they are saved
- Timezone selection now uses a dropdown built from browser-supported IANA timezones
- Profile configuration includes Telegram delivery preferences for generated dashboard audio briefings
- Telegram delivery is modeled under a channel-based `briefingDelivery` shape so WhatsApp and Discord can be added later without reshaping the page

## Current limitations

- Widgets depend on snapshot persistence, so newly configured widgets may briefly show a loading state until the first snapshot is available
- Dashboard metadata updates are only partially wired and broader dashboard management is still minimal
- Layout editing is custom and lightweight rather than using a dedicated dashboard grid library
- Widget resizing is currently implemented only for calendar widgets
- Weather, calendar, task, and email widgets expose meaningful configuration flows, while other widgets remain simpler
- Telegram delivery still depends on server-side bot credentials being configured in the backend environment

## Next likely UI steps

- Add more widget types to the widget library
- Add richer configuration for newly introduced providers across calendar, email, and task widgets
- Improve dashboard switching and multi-dashboard management
- Add richer delivery-channel onboarding help and channel testing flows
- Refine spacing, responsive behaviour, and visual polish across themes
