# Stack Forge Specification: Milestone 9

Append this to `docs/SPEC.md`. Rules and conventions in `CLAUDE.md` still apply.

## Milestone 9: Interface polish

This milestone changes presentation only. No API, schema or engine changes.

### Theming

- All colors, shadows and chart colors come from design tokens defined as CSS variables. No component contains a hardcoded color.
- Two themes, dark and light. The default follows the operating system setting; a toggle in the header overrides it, and the choice is remembered per browser and applied before first paint so the page never flashes the wrong theme.
- Each theme has its own chart palette. Positive and negative values stay distinguishable in both themes and are never signalled by color alone (pair with an arrow or sign).
- Both themes meet WCAG AA contrast for text, controls and chart labels.

### Motion

Motion shows that data changed; nothing animates for decoration. Durations are 150 to 300 ms with one shared easing curve, defined as tokens. Animate transform and opacity only, so layout does not shift.

- **KPI cards:** when a turn completes, each value counts from the old figure to the new one, with a brief positive or negative highlight on the change indicator.
- **Charts:** a new turn extends the existing line; the chart does not redraw from empty. Switching views or ranges transitions between states.
- **Turn pipeline:** stages appear as a checklist that ticks off as each WebSocket stage event arrives, with the active stage indicated. Timing follows the real events; no artificial delays.
- **Market events:** an event card slides in when an event fires and can be dismissed. Active multi-turn events remain visible with turns remaining.
- **Scenario comparison:** the two branches' bars grow side by side from zero when results arrive.
- **Navigation:** view changes use a short fade; panels and dialogs open from their trigger.

When the user's system requests reduced motion, all of the above are replaced by instant state changes. Values still update; they just do not animate.

### Loading, empty and feedback states

- **Skeletons** shaped like the content they replace, for the dashboard, analytics views and turn history. Spinners remain only inside buttons.
- **Toasts** for turn complete, job failed, job cancelled, token quota reached (with the note that the turn ran in rules mode), export ready, and network loss and recovery. Toasts are announced to screen readers, stack without covering the decision panel, and errors persist until dismissed.
- **Empty states** for: no startups yet, a simulation with no turns, analytics with too little history, advisor unavailable, and no scenario run. Each says what will appear there and offers the one action that fills it.
- **Error states** per panel, so one failed request does not blank the dashboard, each with a retry.

### Command palette

Opened with Ctrl+K or Cmd+K, and from a visible button in the header. Commands: go to each view, switch startup, submit turn, open scenario comparison, ask the AI CEO in each of its three modes, toggle theme, export report, log out. Fuzzy search over command names, full keyboard operation, focus trapped while open and returned to the trigger on close. Commands that are unavailable in the current state are shown disabled with the reason.

### Tests

Component tests for theme persistence and system-preference fallback, reduced-motion behavior, command palette keyboard flow, and each empty and error state. The Milestone 8 accessibility check runs on the main routes in both themes.

**Done when:** every view is correct in both themes with no hardcoded colors left, a turn plays through with live pipeline ticks and KPI count-up, reduced-motion mode shows no animation, every listed empty, loading and error state is reachable, the command palette runs every listed command by keyboard alone, and the accessibility check passes in both themes.
