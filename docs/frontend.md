# Frontend

React and Vite. Views and the routes they live at:

| View | Route | What it shows |
| --- | --- | --- |
| **Landing** | `/` | Public home page for guests: hero, how it works, features, AI advisor, plans, FAQ. Signed-in users go to `/startups` |
| Log in / register | `/login`, `/register` | Accounts, in a split layout (brand panel beside the form; form only under 1100 px); a new user goes straight into the creation wizard |
| Email verification | `/verify-email?token=…` | Confirms the email from the emailed link; until then a banner offers to resend it and simulations cannot start |
| Password reset | `/forgot-password` | Three steps on one page: email, the 6-digit code from the email (resend after 30 s), the new password twice (signs out everywhere). `/reset-password` redirects here |
| Google sign-in | `/auth/google/done` | Return point after Google; restores the session |
| **Account** | `/account` | Profile and sign-in methods; AI usage today against the daily quota; signed-in devices with sign-out per device; data export; account deletion |
| Privacy | `/privacy` | What is stored, what is sent to the LLM provider and Resend, export and deletion rights, retention |
| Startups | `/startups` | Startup cards; **Play** resumes the latest game, **New game** starts one (rule or LLM agents) |
| Creation wizard | `/startups/new` | 9 steps: name, industry, location, business model, capital, product, price, market size, difficulty. The location step picks a state, then a city filtered by state or "Another city" with its size, and shows the location profile card before confirming |
| Edit startup | `/startups/:id/edit` | All wizard fields on one form |
| **Dashboard** | `/simulations/:id` | Header (product, startup, turn); market event cards; KPI cards with change since last turn; revenue and profit chart; decision panel with preview and the live pipeline checklist; market panel; AI CEO side panel |
| **Decisions** | `/simulations/:id/decisions` | Product & Pricing (`#pricing`), Team & Hiring (`#hiring`) and Marketing: where each lever stands this month (engine figures from the latest turn), then the decision form with preview and the live pipeline |
| **AI Business Advisor** | `/simulations/:id/advisor` | The AI CEO panel on its own page, with what the advisor can and cannot do and example questions |
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

The simulation views share one layout route, which loads the simulation, its turns and its analytics once (each settles separately, so one failure does not blank the page). The layout also owns the simulation's one turn runner, shared by the decision form and the top-bar controller, and announces finished turns. The chart-heavy views load on demand, so login and the wizard never download the chart library.

## App shell

Signed-in pages sit in one frame (`src/components/shell`):

- **Sidebar** (240 px, collapsible to 72 px and remembered in `localStorage` as `sf-sidebar-collapsed`; icons only under 1100 px). Brand, then Overview, My Startup, Business Strategy, Finance, Marketing, Team & Hiring, Product & Pricing, Market Insights, AI Business Advisor, Reports & Analytics; below, Notifications, Help & Support, Settings and the user. Each destination opens the view that owns its numbers (`nav.ts`): Finance is the financial analytics tab, Marketing the customers tab, Market Insights the market tab, Reports the forecasts tab, Team and Product the Decisions page, Notifications the turn timeline, Settings the account page. Outside a simulation they use the last simulation opened (`sf-last-simulation`), or the startup list.
- **Top bar**: breadcrumb (startup / page), the **simulation controller** while a simulation is open, the command palette, notifications, the theme switch and the account menu.
- **Simulation controller**: month, quarter, status and turn progress; **advance one month** plays the next turn with the current plan (`POST …/turns` with no decisions; use the decision form to change the plan first); **auto-play** repeats that with a pause between months of 8 s, 4 s or 1.5 s at 1x, 2x or 5x, and stops when paused, when a turn fails or when the simulation ends. One turn is one month, as in the engine; the controller never computes figures.
- **Phones** (under 900 px): the sidebar becomes a drawer, a bottom bar carries Home, Finance, Advisor, Reports and More, and the controller takes its own row.

Guest pages use a slim header (brand and theme switch); sign-in pages use the split layout.

## Accessibility

The dashboard, wizard and play flow work by keyboard alone, and so does every command through the command palette: a skip link leads to the content, every control has a label, focus is always visible (2 px accent outline), and scrollable tables are focusable regions. Text, controls and chart labels meet WCAG AA contrast in both themes (button backgrounds use `--accent-strong`, 5.5:1 against white). Every chart has a **Table** view with the same numbers. Layouts work at 375 px without horizontal scrolling.

`npm run test:a11y -w frontend` builds the app, serves it with `vite preview` and, in Chromium against a mocked API built from the backend's recorded fixtures (`e2e/mock-api.ts`), runs axe (WCAG 2.1 A and AA) on the main routes in both themes (selected through the system colour scheme) at desktop and phone width, with reduced motion so it measures settled pages; checks for horizontal scrolling on a phone; drives the login form, the wizard, a turn and the command palette by keyboard; checks that the theme choice survives a reload; and checks that reduced motion leaves no animation running. It runs in CI on every pull request. `SHOT_DIR=<folder> npx playwright test e2e/screenshots.spec.ts` (from `frontend/`) saves screenshots of the main views in both themes for review.

## Design system and themes

Two themes, dark and light, built from one set of design tokens: CSS custom properties in `src/styles.css`. Every colour, shadow, chart colour and motion value is a token; components use only tokens. `src/design-tokens.test.ts` fails if a colour literal appears anywhere else, and checks that both themes define the same tokens.

- **Midnight Purple.** One type scale (12, 13, 14, 16, 20 and 28 px) in **Inter** (self-hosted through `@fontsource-variable/inter`, so no request leaves the site), and **one accent**, purple (`#8b5cf6` dark, `#7c3aed` light). Links use `--accent-text` (`#c4b5fd` dark, `#5b21b6` light) and filled buttons `--accent-strong` (`#7c3aed`, 5.7:1 with white), so both meet AA. Cards have a 12 px radius.
- **Dark** separates cards (`#171725`) and raised surfaces (`#1e1e2d`) from the page (`#0b0b12`) by tone, with a `#0e0e17` sidebar and ink `#f8fafc` / `#a1a1b5` / `#8b8ba0`.
- **Light** is the same product in daylight: a cool off-white page (`#f8f9fc`) with white cards lifted by a hairline border (`#e7e5ef`) and a soft shadow, ink `#171525` / `#666579` / `#67667c`.
- **Departures from the brand palette, for contrast:** muted text (`#717184` dark, `#9291a3` light in the brand sheet) is lifted to `#8b8ba0` and darkened to `#67667c`; light-theme green, amber, blue and purple text use darker shades (`#166534`, `#b45309`, `#0369a1`, `#5b21b6`). The brand colours remain for fills, marks and charts.
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

- **Categorical series** use a fixed order: purple, amber, green, sky, pink, as tokens `--series-1` to `--series-5` with a palette per theme; adjacent series differ in lightness as well as hue, and every series is at least 3:1 against its theme's cards. A series keeps its colour when others are hidden.
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
