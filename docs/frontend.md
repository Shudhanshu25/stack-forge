# Frontend

React and Vite. Views and the routes they live at:

| View | Route | What it shows |
| --- | --- | --- |
| Log in / register | `/login`, `/register` | Accounts; a new user goes straight into the creation wizard |
| Email verification | `/verify-email?token=…` | Confirms the email from the emailed link; until then a banner offers to resend it and simulations cannot start |
| Password reset | `/forgot-password` | Three steps on one page: email, the 6-digit code from the email (resend after 30 s), the new password twice (signs out everywhere). `/reset-password` redirects here |
| Google sign-in | `/auth/google/done` | Return point after Google; restores the session |
| **Account** | `/account` | Profile and sign-in methods; AI usage today against the daily quota; signed-in devices with sign-out per device; data export; account deletion |
| Privacy | `/privacy` | What is stored, what is sent to the LLM provider and Resend, export and deletion rights, retention |
| Startups | `/startups` | Startup cards; **Play** resumes the latest game, **New game** starts one (rule or LLM agents) |
| Creation wizard | `/startups/new` | 9 steps: name, industry, location, business model, capital, product, price, market size, difficulty. The location step picks a state, then a city filtered by state or "Another city" with its size, and shows the location profile card before confirming |
| Edit startup | `/startups/:id/edit` | All wizard fields on one form |
| **Dashboard** | `/simulations/:id` | Header (product, startup, turn); market event cards; KPI cards with change since last turn; revenue and profit chart; decision panel with preview and the live pipeline checklist; market panel; AI CEO side panel |
| **Scenario comparison** | `/simulations/:id/scenarios` | Two decision sets from the current state, horizon 1–6, same seed and rules agents; totals as side-by-side bars and a table of differences; revenue, profit, customers, churn and cash over time; neutral trade-offs; nothing saved |
| **Analytics: financial** | `/simulations/:id/analytics/financial` | Gross margin, burn rate, runway, CAC, LTV, ARPU; revenue against expenses; cash; expense breakdown |
| **Analytics: customers** | `/simulations/:id/analytics/customers` | Customers and churn by segment; new against churned; segment table |
| **Analytics: market** | `/simulations/:id/analytics/market` | Your price against competitors; competitor share; your share; sentiment, pressure and awareness; demand index |
| **Analytics: decisions** | `/simulations/:id/analytics/decisions` | Previewed against actual impact per decision, with direction agreement |
| **Analytics: location** | `/simulations/:id/analytics/location` | What the location costs this month against the national baseline, line by line, its share of the cost base, the demand multipliers, and the profile card |
| **Analytics: forecasts** | `/simulations/:id/analytics/forecasts` | Forecast against actual for revenue and customers, with error metrics |
| Report export | buttons on every analytics tab | CSV, JSON and PDF downloads (`GET /simulations/:id/report?format=…`) |
| **Turn timeline** | `/simulations/:id/timeline` | Each turn, newest first: decisions, outcome, events, market reaction, AI CEO, forecast |
| **Admin** | `/admin` (ADMIN only) | Users, startups, simulations, turns, average turn duration, AI requests, ML predictions, failed jobs, engine and model versions |

The onboarding coach appears on top of these pages for a new user; see below.

Every figure on these pages comes from `GET /simulations/:id/analytics`, which the simulation service computes from the stored turn records. The browser only formats numbers; it calculates nothing.

The simulation views share one layout route, which loads the simulation, its turns and its analytics once (each settles separately, so one failure does not blank the page). The chart-heavy views load on demand, so login and the wizard never download the chart library.

## Accessibility

The dashboard, wizard and play flow work by keyboard alone, and so does every command through the command palette: a skip link leads to the content, every control has a label, focus is always visible (2 px accent outline), and scrollable tables are focusable regions. Text, controls and chart labels meet WCAG AA contrast in both themes (button backgrounds use `--accent-strong`, 5.5:1 against white). Every chart has a **Table** view with the same numbers. Layouts work at 375 px without horizontal scrolling.

`npm run test:a11y -w frontend` builds the app, serves it with `vite preview` and, in Chromium against a mocked API built from the backend's recorded fixtures (`e2e/mock-api.ts`), runs axe (WCAG 2.1 A and AA) on the main routes in both themes (selected through the system colour scheme) at desktop and phone width, with reduced motion so it measures settled pages; checks for horizontal scrolling on a phone; drives the login form, the wizard, a turn and the command palette by keyboard; checks that the theme choice survives a reload; and checks that reduced motion leaves no animation running. It runs in CI on every pull request. `SHOT_DIR=<folder> npx playwright test e2e/screenshots.spec.ts` (from `frontend/`) saves screenshots of the main views in both themes for review.

## Design system and themes

Two themes, dark and light, built from one set of design tokens: CSS custom properties in `src/styles.css`. Every colour, shadow, chart colour and motion value is a token; components use only tokens. `src/design-tokens.test.ts` fails if a colour literal appears anywhere else, and checks that both themes define the same tokens.

- **One type scale** (12, 13, 15, 18, 24 and 32 px, system sans) and **one accent**, blue `#3987e5`, in both themes. Links use `--accent-text` (`#4a92e8` dark, `#2468c2` light) and filled buttons `--accent-strong` (`#2468c2`), so both meet AA on their backgrounds.
- **Dark** separates cards from the near-black page (`#0d0d0d`) by tone (`#1a1a19`), with warm neutrals for ink (`#ffffff`, `#c3c2b7`, `#8f8d86`).
- **Light** is the same product in daylight, not an inverted copy: a warm off-white page (`#f5f4ef`) with white cards lifted by a hairline border and a soft shadow, ink `#191917` / `#4a4944` / `#6b6963`, and the dark theme's hues for status and series, darkened just enough for AA on white.
- **Contrast:** body text, secondary text, links and status text are at least 4.5:1 on every surface of their theme; series colours and chart marks at least 3:1.
- **Status colours** (green, red, amber) never carry meaning alone: deltas have an arrow and a sign ("▲ +₹14.3K vs last turn"), events say "Good news" or "Bad news", errors start with ✕. Churn counts as better when it falls.
- **Amounts** use Indian formatting, for example ₹8.45L, ₹1.2Cr and 12,34,567.

**Choosing the theme.** With no stored choice the operating system setting decides, and the page follows it if it changes. The header toggle (and the command palette) overrides it; the choice is kept in `localStorage` (`sf-theme`) for that browser, and **Use the system theme** in the palette forgets it. `public/theme.js` is a blocking script in `<head>` that sets `data-theme` on `<html>` before the first paint, so the page never flashes the wrong theme; `src/lib/theme.ts` and `ThemeProvider` keep it current afterwards.

## Motion

Motion only shows that data changed. One easing curve (`--ease`, `cubic-bezier(0.2, 0, 0, 1)`) and three durations (`--dur-fast` 150 ms, `--dur` 200 ms, `--dur-slow` 300 ms) are tokens; script-driven motion reads the same tokens (`src/lib/motion.ts`). CSS animations use transform and opacity only, so layout never shifts.

| Where | What moves |
| --- | --- |
| KPI cards | When a turn completes the value counts from the old figure to the new one; the change indicator flashes green or red briefly. Screen readers get the final figure only. |
| Charts | A new turn moves the existing line to its new shape and adds the new point; the first draw is static, never "drawn from empty". Switching the range (all, last 12, last 6 turns) or chart/table view transitions between states. |
| Turn pipeline | A checklist that ticks off each stage as its WebSocket event arrives, with the active stage marked. Timing is the real events; nothing is delayed. |
| Market events | A card slides in for each event that fired, with what it does and how many turns it lasts; it can be dismissed. Active events stay listed in the market panel with turns remaining. |
| Scenario comparison | The two branches' bars grow side by side from zero (negative values grow the other way from a zero line). |
| Navigation | Pages and views fade in; the command palette opens from the button that opened it; glossary tooltips open from their term. |

One reading of the spec: chart lines are SVG geometry, so a new turn interpolates the line's points rather than a transform; this happens inside a fixed-size chart and never moves layout, which is what the transform-and-opacity rule protects.

**Reduced motion.** When the system asks for it, the duration tokens become 0, the count-up and chart animations are switched off in script, and the skeleton pulse and button spinners stop. Values still update; they just change at once.

## Loading, empty, error and feedback states

- **Skeletons** shaped like the content (`src/components/feedback/Skeletons.tsx`) stand in for the dashboard, analytics, turn history, startup list, admin tiles, sessions table and lazily loaded pages. Each is one "Loading …" status for assistive technology. Spinners appear only inside busy buttons.
- **Empty states** (`EmptyState`) say what will appear and offer the one action that fills it: no startups yet (create one); a simulation with no turns (play turn 1 with the starting plan); analytics with too little history, no decisions or no forecasts (go and play); the AI CEO unavailable (ask again, with the reason); no scenario run (compare the two branches); an empty timeline.
- **Error states per panel** (`ErrorState`, with **Retry**): the simulation, its turn history and its analytics load independently, so a failed request shows an error only in the panels that need it (key metrics and charts, market, AI CEO, timeline, analytics) and leaves the rest working. `PanelBoundary` contains a rendering failure to one dashboard panel.
- **Toasts** (`src/components/feedback/Toaster.tsx`) for turn complete, job failed, job cancelled, the daily AI quota reached (the turn ran in rules mode), report and data exports ready (or failed), and network loss and recovery (browser offline/online, or the API unreachable, probed every 5 s until it answers). Errors are announced assertively and stay until dismissed; others are announced politely and leave after 6 s, pausing while hovered or focused. On wide screens the stack sits over the right-hand column (the AI CEO), clear of the decision panel; in the one-column layout it docks at the bottom edge.

## Command palette

**Ctrl+K** (**Cmd+K** on a Mac) or the **Commands** button in the header opens it when signed in.

| Group | Commands |
| --- | --- |
| Simulation | Submit turn (with the decisions on screen), open scenario comparison, export report as CSV, JSON or PDF |
| AI CEO | Ask in Explain, Analyze or Scenario mode |
| Go to | Dashboard, Analytics, Timeline, Your startups, New startup, Account, Admin (admins), Privacy |
| Startups | Switch to each of your startups (resumes its latest simulation) |
| Appearance | Switch to the other theme; use the system theme |
| Account | Log out |

Search is fuzzy over names and keywords (`src/lib/fuzzy.ts`). It is a modal dialog with a combobox and a listbox: arrow keys move, Enter runs, Escape (or Ctrl+K) closes, Tab stays inside, and focus returns to whatever opened it. Commands that cannot run now are listed disabled with the reason ("Open a simulation first", "A turn is already running", "Play a turn first"). Panels that own an action register it while mounted (`useCommandSource`): the decision panel registers **Submit turn**, the AI CEO panel its three modes.

## Location

The **profile card** (`components/location/LocationProfileCard.tsx`) shows each index in plain language against the national baseline: "Salaries: high", "Talent: easy to hire", "State compliance: light" (within ±0.08 of 1.0 reads "near the national average"), each with its multiplier, an *estimate* label where the value is an estimate, and every source under *Sources*. It also says how much demand effects count for the chosen industry. The dashboard header shows the city and state ("Location not set" for startups from before locations). The edit page keeps the location editable until a simulation starts and shows it as fixed afterwards. The glossary term *Why location matters* explains the idea in the wizard, in the Location tab and in the onboarding tour.

## Charts

`src/components/charts` wraps Recharts. The rules follow the dataviz method:

- **Categorical series** use a fixed order: blue, orange, aqua, yellow, magenta, as tokens `--series-1` to `--series-5` with a palette per theme. The dark order was validated with adjacent CVD ΔE ≥ 8.4, normal-vision ΔE ≥ 19.3 and contrast ≥ 3:1; the light palette keeps the hues, darkened to at least 3:1 on white. A series keeps its colour when others are hidden.
- **Theme tokens in SVG.** SVG presentation attributes do not accept `var()`, so `useChartPalette()` resolves the tokens to the current theme's computed values and resolves them again when the theme changes.
- **One y-axis per chart.** Measures in different units go in separate charts; scenarios use small multiples.
- **Marks:** 2 px lines, solid hairline gridlines, and a 2 px surface gap between stacked bars.
- **Dashes** are used only for forecasts, where they mean "projection".
- **Labelling:** every chart with two or more series has a legend. Charts with up to four series also label each line at its end.
- **Interaction:** every chart has a crosshair tooltip and a **Table** toggle, so no value is reachable only by hovering or only by colour.
- **Before the first turn**, charts show an empty state instead of a degenerate axis.

## Onboarding

`src/onboarding/Onboarding.tsx` runs a first-launch walkthrough with the six steps the spec lists:

1. create your startup;
2. set pricing;
3. allocate marketing;
4. hire;
5. play the turn and observe the market reaction;
6. analyze results.

How it behaves:

- **Display.** A coach card describes each step, and the relevant control is outlined.
- **Advancing.** Steps advance when the user acts. Creating a startup during the tour starts its simulation and opens the dashboard. Editing price, marketing or headcount moves on (a **Next** button lets the user keep a value). A completed turn moves to the last step.
- **Finishing.** **Finish** or **Skip tour** records completion on the server (`POST /auth/me/onboarding`), so the tour shows once per account. **Tour** in the header replays it.

**Glossary tooltips** (`<Term k="…">`) define CAC, LTV, churn, burn rate, runway, market share and gross margin. They appear on hover, keyboard focus or tap. The definitions match how the simulation service computes each metric.

## Turn progress

`useTurnRunner` plays turns and follows them over the WebSocket. Events are recorded per job id, so a turn that finishes before the POST returns its id still shows the right result. While the socket is down, it polls `GET /jobs/:id`.

The decision panel shows the pipeline as a checklist (`pipelineSteps` in `src/lib/play.ts`): stages whose event has arrived are ticked, the next one is marked active while the job runs, and stages a run passes over without an event are left out rather than shown as stuck. A polite live region announces the active stage.
