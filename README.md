# Daily Briefing Dashboard

## Vision

Daily Briefing Dashboard is a personalised “single pane of glass” for the start of the day.

The core idea is simple: when the user wakes up, they should be able to open one screen — on a phone, desktop, or television — and immediately see the information that matters most for that day. Rather than manually checking multiple apps, websites, feeds, and calendars, the platform aggregates and prepares a curated morning briefing in advance.

The long-term product vision is a configurable, multi-tenant dashboard platform with modular widgets, tenant-level connectors, optional AI-driven summarisation, and support for multiple dashboards per user depending on context such as workdays, weekends, holidays, travel, or specific projects.

Examples of content that may appear on a dashboard include:

- Weather
- Calendar appointments
- AI and technology news
- Geopolitical news
- Local news
- RSS feed summaries
- Tasks or reminders
- Personalised “what matters today” summaries

## Product concept

The dashboard is composed of movable and resizable widgets. Each widget represents a content source or computed insight. Users can configure multiple dashboards, for example:

- Workday Dashboard
- Weekend Dashboard
- Holiday Dashboard
- Project Dashboard

A user may either switch between dashboards manually or, in a later version, allow the system to activate dashboards automatically based on rules such as day of week, travel state, or project context.

The platform is designed from the outset to support future productisation, which is why the initial model includes:

- Tenant as a first-class entity
- Users belonging to tenants
- Tenant-level connectors and credentials
- Multiple dashboards per user
- Configurable widget instances per dashboard
- Snapshot-based briefing generation

## Why a snapshot-based architecture

A key design principle is that the morning dashboard should load quickly and reliably.

Instead of fetching live data from every external service at the moment the user opens the dashboard, the platform can prepare the briefing ahead of time using a scheduled pipeline. This produces a daily briefing snapshot and per-widget snapshots containing the resolved content that should be shown.

Benefits include:

- Faster load times
- Reduced dependency on live API latency
- Lower risk of rate limits
- Better support for TV or kiosk-like display modes
- Easier debugging and historical replay
- Efficient use of AI summarisation or ranking

In practice, the dashboard shown at 07:00 may already have been prepared at 05:45 or 06:00.

## Role of AI agents in the pipeline

AI agents are not required for the MVP, but they are an important part of the longer-term vision.

The safest architectural approach is to treat agents as enrichment components inside the briefing generation pipeline, not as the core control plane of the system. In other words, the system should still function if AI processing is reduced, disabled, or replaced with deterministic logic.

Examples of agent responsibilities include:

- Summarising collections of articles
- Ranking news by relevance to user preferences
- Extracting key items from RSS feeds
- Producing “top three things to know today”
- Merging similar stories from multiple sources
- Filtering noise from high-volume feeds
- Generating concise display text for limited screen sizes

Recommended principle:

- deterministic connectors and schedulers first
- AI enrichment second
- autonomous agent orchestration later, only where it provides clear value

## MVP proposal

The MVP should be intentionally narrow.

### MVP objective

Deliver a working web-based dashboard with a small number of widgets, beginning with weather, using a modular data model and a layout that can evolve into a richer dashboard product.

### Suggested first milestone

- Single tenant
- Single user
- One dashboard
- One weather widget
- Tenant-level weather connector configuration
- Basic drag-and-drop or grid placement
- Snapshot generation for the weather widget

### Suggested second milestone

- Multiple widgets on one dashboard
- Dashboard persistence
- Multiple dashboards per user
- Manual dashboard switching
- Tenant-level connector management with edit support
- Additional widgets such as calendar or RSS

### Suggested third milestone

- Scheduled daily briefing generation
- News ingestion
- AI summarisation of selected feeds
- TV-friendly display mode

## Functional requirements

### Core requirements

- Users can sign in
- Users belong to a tenant
- Users can have multiple dashboards
- Dashboards contain widgets
- Widgets can be positioned and resized
- Widget configuration is persisted
- Tenant-level connectors can be configured
- Existing connectors can be reviewed and edited after creation
- A scheduler can prepare daily briefing content
- The UI can display either live data or generated snapshots

### Content requirements

- Weather widget support
- Calendar widget support in a later increment
- RSS/news widget support
- Local news and thematic news support
- Basic user preferences for filtering and source selection

### Administration requirements

- Tenant isolation
- Secure management of external credentials
- Connector health and sync monitoring
- Auditability of snapshot generation

## Non-functional requirements

### Performance

- Dashboard should load quickly, ideally from precomputed briefing data
- Widget rendering should not require multiple blocking API calls at page load

### Security

- Tenant data must be isolated
- API credentials should not be stored in plaintext
- Secrets should be externalised to a secure store where possible

### Scalability

- Support future multi-tenant SaaS deployment
- Support additional widgets without major schema redesign
- Allow introduction of more connectors and enrichment services over time

### Reliability

- The dashboard should still function even if one connector fails
- Widget-level errors should be isolated and surfaced cleanly

### Extensibility

- New widget types should be easy to add
- Connector model should support multiple providers of the same category
- AI enrichment should be pluggable, not hard-coded into every widget

## Initial data model direction

The current design direction includes the following core entities:

- Tenant
- User
- Dashboard
- Widget
- Connector
- WidgetConnector
- BriefingSnapshot
- WidgetSnapshot

At a high level:

- a tenant owns users, connectors, dashboards, and snapshots
- a user may own multiple dashboards
- a dashboard contains multiple widgets
- widgets may use one or more connectors
- briefing snapshots store the generated state of a dashboard for a point in time
- widget snapshots store the generated content for each widget in that briefing

## Proposed technology stack

The technology stack should balance speed of delivery, familiarity, and future extensibility.

### Front end

Because the initial preferred stack is Bootstrap plus AngularJS-style SPA development, a practical starting point is:

- HTML
- CSS
- Bootstrap
- JavaScript or TypeScript
- Angular (preferred modern path) or AngularJS if continuing from an existing comfort zone
- Grid layout / widget library for drag-drop and resize behaviour

For the widget layout capability, a grid-based dashboard library is recommended rather than implementing drag-and-drop from scratch.

### Back end

A lightweight back end is sufficient for the MVP:

- Python with FastAPI, or
- Node.js with Express / NestJS

FastAPI is attractive if the project later expands into AI enrichment, scheduling, and data processing pipelines.

### Database

- PostgreSQL

Why PostgreSQL:

- strong relational model for tenants, dashboards, widgets, and connectors
- good JSON support for flexible widget configuration
- mature ecosystem
- well suited for future SaaS growth

### Scheduling and background jobs

- Cron for local MVP development
- APScheduler, Celery, or a queue-based worker model for richer scheduling
- Alternatively, cloud scheduler plus worker functions in later deployment

### Secrets management

- environment variables for local development
- Vault / cloud secret manager / encrypted secret store for production

### Hosting

- Containerised deployment with Docker running locally for Dev and in AWS ECS for Test & Prod.

### Television display

For a Google TV or smart TV scenario, the most pragmatic early approach is:

- responsive web application in a browser
- optional kiosk or fullscreen mode
- later evolution into an Android TV app if needed

## UI requirements

The current UI direction for the web MVP is a personal-information dashboard that feels closer to a lightweight BI workspace than a consumer app landing page.

Implementation status for the current frontend can be tracked in `docs/ui-status.md`.

### Front-end stack

- Use Bootstrap for layout and base UI primitives
- Use AngularJS for the SPA structure
- Use Font Awesome Free for UI icons

### General visual direction

- Prefer a modern, clean, workspace-style dashboard aesthetic
- Keep the dashboard frame visually flat so widgets feel like the primary layer
- Minimise wasted space around the widget canvas
- Support both dark mode and light mode
- Use theme-specific branding assets in the top navigation

### Top navigation

- Use a horizontal top menu
- The top menu should remain visually compact
- Increase left and right spacing so the logo and right-side actions do not sit against the screen edges
- Use `logo-dark.png` in dark mode and `logo-light.png` in light mode
- The logo image already contains the product name, so no duplicate product-name text should appear beside it
- Remove the preview action from the top-right area

### Dashboard header and controls

- Keep the dashboard title area compact so most vertical space is reserved for widgets
- Show the dashboard name and description near the top of the workspace
- Provide a configuration button using a cog icon
- Place the configuration button inline with the dashboard editing controls
- Use an `Edit Dashboard` button to enter layout-editing mode
- Replace `Edit Dashboard` with `Save Dashboard` while editing
- Do not show widget-layout controls when not editing

### Dashboard configuration

- Creating a dashboard should happen through a modal
- Editing the current dashboard name and description should happen through a modal
- A `+ Dashboard` button should exist in the top navigation
- Creating a dashboard should take the user to a blank dashboard

### Widget editing behaviour

- Widgets should be draggable only while the dashboard is in edit mode
- The widget-add control should be hidden unless the dashboard is in edit mode
- The visual layout grid should not become messy or duplicated between normal and edit states

### Widget library panel

- The `+ Widget` action should open a sliding panel on the right
- The panel should show a grid of widget choices
- Plan the grid for roughly 20 widget types
- Unimplemented widget slots can use muted placeholder tiles

### Implemented widget types

- Weather widget
- Calendar widget

### Weather widget requirements

- Use mocked content in the UI for now
- Present current conditions and supporting detail in a coherent card layout
- Ensure the card height is sufficient so content does not overflow awkwardly

### Calendar widget requirements

- Show appointments for the current day
- For each appointment, show time, title, and location
- Use mocked data in the UI for now
- Allow the calendar widget to be resized vertically to become taller or shorter

## Weather API recommendation for MVP

A sensible free provider to start with is a public weather API with a free tier. OpenWeather is a common candidate for prototypes because it is widely used and straightforward to integrate, though it is worth comparing free-tier limits, forecast depth, and licensing conditions against alternatives before locking in the provider.

The architecture should avoid hard-coding to one vendor. The connector abstraction should allow weather providers to be swapped later.

## Suggested repository structure

```text
daily-briefing-dashboard/
├── README.md
├── docs/
│   ├── architecture/
│   ├── adr/
│   └── data-model/
├── frontend/
├── backend/
├── infra/
├── scripts/
└── plantuml/
```

## Suggested first development sequence

1. Create repository and baseline README
2. Model core entities in PostgreSQL
3. Build a very small front end with one dashboard and one weather widget
4. Persist widget placement and configuration
5. Add tenant-level connector configuration
6. Add scheduled generation of a weather widget snapshot
7. Expand to additional widgets and dashboards
8. Introduce news/RSS aggregation
9. Add AI summarisation as an optional enrichment layer
10. Optimise for TV display mode

## Architectural guardrails

These are worth keeping in mind from the beginning:

- Do not make the MVP dependent on agents
- Do not fetch everything live on page load
- Keep secrets out of normal tables where possible
- Use JSON fields only where flexibility is genuinely useful
- Keep tenant_id on major tables for easier security and operations
- Start with a modular monolith before considering microservices
- Design widgets as independent units with isolated failure handling

## Open design questions

Some questions to resolve as the design matures:

- Should dashboard activation be fully manual at first, or rule-based from the start?
- Should snapshots be generated per user, per dashboard, or partially shared at tenant level?
- Which content should always be live versus snapshot-based?
- How much personalisation should be explicit rules versus AI ranking?
- What is the best UI mode for a bedroom TV: passive display, remote control navigation, or auto-rotating panels?

## Conclusion

Daily Briefing Dashboard is best approached as a focused, modular product that starts with one or two useful widgets and evolves into a configurable briefing platform. The key architectural insight is to separate widget configuration from generated widget content, which enables scheduling, caching, AI enrichment, and high-performance display across phone, desktop, and TV use cases.

The MVP should remain deliberately simple, but the model should already leave room for:

- multi-tenancy
- multiple dashboards per user
- connector abstraction
- snapshot-based delivery
- later AI-assisted briefing enrichment

# Evidence-Driven Strategy Layer

HelmOS is not only a system for **designing a business**, but for **testing whether that business should exist**.

Traditional startup tools often help founders produce:

-   well-structured ideas
-   compelling narratives
-   polished business cases

However, these artefacts frequently lack **empirical grounding**, leading to overconfidence and poor decision-making.

HelmOS introduces an **evidence-driven strategy layer**, where all strategic artefacts are treated as:

> **Hypotheses to be tested, not truths to be documented**

Every core component of a business concept (problem, customer, value proposition, pricing, etc.) is explicitly linked to:

-   underlying assumptions
-   required evidence
-   current validation status

This transforms HelmOS from a documentation tool into a **decision-support system for venture creation**.

---

# Closed-Loop Learning System

HelmOS operates as a **closed-loop learning system** for building companies.

Rather than following a linear process (idea → plan → execution), the platform continuously cycles through:

**IDEATE → RESEARCH → HYPOTHESISE → TEST → LEARN → REFINE**

### Loop Stages

1.  **Ideation**
    -   Founder defines initial problem, customer, and concept
    -   Outputs are treated as _provisional hypotheses_
2.  **Market Research (Secondary Evidence)**
    -   Agents analyse:
        -   competitors
        -   existing solutions
        -   industry reports
        -   market signals
    -   Output: **context and identified knowledge gaps**
3.  **Hypothesis Generation**
    -   Agents derive:
        -   explicit hypotheses
        -   key uncertainties
        -   prioritised risks
4.  **Validation Design**
    -   System proposes:
        -   test methods (interviews, landing pages, experiments)
        -   required signals
        -   success/failure criteria
5.  **Testing (Primary Evidence)**
    -   Founder executes or delegates experiments
    -   System captures:
        -   behavioural data
        -   engagement signals
        -   commitment indicators
6.  **Evaluation**
    -   Results are analysed
    -   Hypotheses are:
        -   supported
        -   rejected
        -   or remain inconclusive
7.  **Refinement**
    -   Business concept is updated based on evidence
    -   Weak assumptions are either improved or discarded

The loop then repeats.

---

## Key Principle

> **Progress is measured by reduction of uncertainty, not completion of documents.**

---

# Epistemic State Model

HelmOS tracks the **epistemic state** of a business concept.

Instead of only asking:

> “Is this well described?”

The system asks:

> “How well do we actually know this is true?”

Each element of the business (problem, customer, value proposition, etc.) is associated with:

### 1\. Clarity

-   Is the concept clearly defined?

### 2\. Evidence Strength

-   What type of evidence supports it?

### 3\. Confidence Level

-   How likely is it to hold under real-world conditions?

---

## Evidence Hierarchy

HelmOS distinguishes between different types of evidence:

| Evidence Type | Description | Strength |
| --- | --- | --- |
| Assumption | Internal belief or reasoning | Weak |
| Stated Feedback | Surveys, opinions | Low |
| Observed Behaviour | User actions, engagement | Medium |
| Commitment | Payment, time investment, real adoption | Strong |

Agents should prioritise moving concepts **up the evidence hierarchy**.

---

## Example

A value proposition may be:

-   Clearly written ✔
-   But only assumption-backed ❌

HelmOS should explicitly surface this gap.

---

# Market Research as Input, Not Validation

HelmOS treats market research as **contextual input**, not proof of viability.

### Purpose of Market Research

-   Understand the landscape
-   Identify competitors and alternatives
-   Detect patterns and trends
-   Highlight known problems

### Limitations

Market research does **not**:

-   prove demand for a specific solution
-   validate willingness to pay
-   confirm product-market fit

---

## System Behaviour

Market research agents should:

1.  **Summarise the landscape**
2.  **Identify gaps and unknowns**
3.  **Highlight risks and saturation**
4.  **Generate testable hypotheses**

Example outputs:

-   “Market is crowded → differentiation required”
-   “No clear dominant solution → potential opportunity”
-   “No evidence of willingness to pay in this segment”

---

## Key Principle

> **Secondary research informs hypotheses. Primary evidence validates them.**

---

# Hypothesis-Driven Validation Framework

HelmOS provides a structured system for testing business assumptions.

Each hypothesis includes:

-   statement (e.g. “X segment has problem Y”)
-   target segment
-   expected outcome
-   validation method
-   success criteria
-   evidence collected

---

## Validation Methods

The system supports multiple validation approaches:

### Weak Evidence

-   surveys
-   opinion-based interviews

### Medium Evidence

-   click-through behaviour
-   sign-ups
-   usage engagement

### Strong Evidence

-   pre-orders
-   payments
-   time commitment
-   switching behaviour

---

## Agent Responsibilities

Agents should:

-   challenge vague or unfalsifiable hypotheses
-   recommend stronger validation methods where possible
-   discourage over-reliance on opinion-based validation
-   guide founders toward **behavioural and commitment-based evidence**

---

# Augmented Value Proposition Modelling

HelmOS extends traditional frameworks such as the Value Proposition Canvas.

In addition to:

-   jobs
-   pains
-   gains

HelmOS captures:

### Reality Layer

-   current alternatives (including “do nothing”)
-   frequency of the problem
-   severity of the problem
-   switching barriers
-   economic context (who pays, budget source)

### Evidence Layer

-   assumption vs validated insight
-   type of supporting evidence
-   confidence level

---

## Key Principle

> A value proposition is only as strong as the evidence supporting it.

---

# From Business Description to Business Validation

Traditional tools help founders:

> describe a business

HelmOS is designed to help founders:

> **decide whether a business is worth building**

This requires:

-   explicit assumptions
-   structured experimentation
-   continuous learning
-   evidence-based refinement

---

# Strategic Differentiation

HelmOS differentiates itself by:

-   integrating **strategy + execution + validation**
-   embedding **scientific thinking into entrepreneurship**
-   treating **AI as both creator and challenger**
-   prioritising **truth over narrative quality**

---

## Final Principle

> HelmOS is not a tool for writing better business plans.  
> It is a system for **discovering viable businesses under uncertainty**.