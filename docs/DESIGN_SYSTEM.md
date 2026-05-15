# FoundersHQ — Design System

> This is not a generic SaaS dashboard. It is a tool that founders open when they are anxious about money. Calm. Trustworthy. Dense without being noisy. Read this before opening any TSX file.

## Brand voice

- **Plain English.** No "synergize". No "unlock". No exclamation marks in product copy. Say what is true.
- **Operative.** Buttons name an action and an outcome: "Mark invoice as paid", not "Confirm".
- **Numbers first, words second.** A figure is the headline; the label is the subtitle.
- **Honest about uncertainty.** "Base case" and "Pessimistic" are first-class words. We never present a forecast as a fact.

## Visual identity

### Color tokens

We do not use shadcn's default palette. Override `tailwind.config` and `globals.css` with the following CSS variables:

```css
/* Light */
--bg:            oklch(0.99 0.005 100);   /* near-white, faint warm */
--surface:       oklch(0.97 0.005 100);   /* card */
--surface-2:     oklch(0.94 0.008 100);   /* nested */
--ink:           oklch(0.18 0.02 250);    /* primary text — near-black ink */
--ink-2:         oklch(0.38 0.02 250);    /* secondary text */
--ink-3:         oklch(0.58 0.02 250);    /* tertiary, captions */
--line:          oklch(0.90 0.01 250);    /* borders */
--accent:        oklch(0.55 0.18 145);    /* positive — moss/forest, not Slack-green */
--accent-ink:    oklch(0.99 0 0);
--warn:          oklch(0.78 0.15 75);     /* amber */
--danger:        oklch(0.58 0.20 25);     /* warm red, not 911 */
--info:          oklch(0.55 0.15 230);    /* used sparingly */

/* Dark — primary mode */
--bg:            oklch(0.16 0.01 250);
--surface:       oklch(0.19 0.012 250);
--surface-2:     oklch(0.23 0.014 250);
--ink:           oklch(0.96 0.005 100);
--ink-2:         oklch(0.78 0.01 250);
--ink-3:         oklch(0.58 0.01 250);
--line:          oklch(0.32 0.01 250);
--accent:        oklch(0.78 0.18 145);
--warn:          oklch(0.82 0.16 75);
--danger:        oklch(0.70 0.20 25);
```

Rules:
- **Default to dark mode.** Detect system preference; persist user choice.
- **Money is not blue.** Positive cash flow uses `--accent`, negative uses `--danger`, neutral uses `--ink`.
- **Severity colors are reserved for severity.** Don't use red for "delete" buttons or amber for "warning" generally — reserve them for runway / spend / collections signals.

### Typography

- **UI font:** `Inter` (variable), with `font-feature-settings: "ss01", "cv11", "tnum"`.
- **Numeric font:** `JetBrains Mono` (variable) for any column of currency, every cell in a data table, every cash figure on the dashboard. **Always `font-variant-numeric: tabular-nums`** so digits don't dance.
- **Display:** the dashboard hero numbers use `Inter` 600 weight at a large size with `letter-spacing: -0.02em`. We do not use a display serif.
- **Scale (rem):** 0.75 · 0.8125 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 1.875 · 2.25 · 3. No half-steps. Bigger than 3 is a heading in a marketing page, not the app.

### Spacing & layout

- 4-unit base (`0.25rem`). Use `gap`/`p-*` in multiples of 1, 2, 3, 4, 6, 8, 12, 16. No `p-5`, no `p-7`.
- Card density: 12–16px internal padding, not 24. We are denser than Stripe Dashboard, looser than Bloomberg Terminal.
- The app shell is 64px top bar, 240px collapsible side nav (rail mode 56px), main content max 1440px centered.

### Iconography

- `lucide-react` (already installed). Use the 16px size in tables and inline; 20px in nav; 24px for empty states.
- Custom icons only for: company logo, integration logos (use brand SVGs), and the "evidence" chevron (a single custom glyph).

## Components

### Money

A single component for displaying any currency amount. **Do not call `toLocaleString` directly anywhere else.**

```tsx
<Money value={12345.67} currency="USD" />          // $12,345.67
<Money value={-1234} currency="USD" signed />      // –$1,234.00 (en-dash, --danger)
<Money value={cashWeeks} unit="weeks" precision={1} />
```

Behaviours:
- Always tabular numerals.
- Uses `Intl.NumberFormat` for currency; falls back gracefully for unknown codes.
- En-dash for negatives, not hyphen-minus.
- Hover reveals original-currency value when org base currency ≠ source currency.

### Sparkline

Tiny inline chart for any time series. Used inline in metric cards, table rows, and the rail navigation.

### EvidenceChip

A pill that, when clicked, opens the `RecordSheet` for the underlying transaction or invoice. Carries the UUID. Always shown adjacent to any LLM-produced explanation.

### MetricCard

Headline number, label, sparkline, delta vs prior period, and (when applicable) an evidence link. One component, two density levels (`compact` for grids of 4+, `expanded` for hero positions).

### DataTable

Built on `@tanstack/react-table` (install). Features:
- Column sort, multi-column sort.
- Sticky header + sticky first column on horizontal scroll.
- Cmd-click row to open `RecordSheet`.
- Row selection with bulk actions in a sticky bottom bar.
- "Empty after filter" state distinct from "no data at all" state.
- Keyboard navigation (j/k or arrow keys), `/` to focus filter.

### CommandPalette (Cmd-K)

- Fuzzy search across: pages, transactions (by id / merchant / amount), invoices (by id / customer / amount), customers, commitments, vendors, insights.
- Runs actions: "Mark all overdue invoices…", "Switch org", "Start new scenario", "Connect Plaid".
- Recently visited records pinned to top.

### Copilot (Cmd-J)

A side panel (not a chat page). Lives in the right rail. Conversation is scoped to the current page's context — if you're on `/runway`, it knows the forecast inputs; on `/invoices`, the open invoice. It cannot answer questions outside the facts payload assembled server-side and the guardrails reject any response that fails validation.

### RecordSheet

Slide-over from the right. One per record type (transaction, invoice, customer, commitment, vendor finding, insight). Tabs: Overview, Documents, History, Notes. Closeable with Esc.

### ScenarioDiff

Side-by-side cards showing two scenarios. Shared y-axis on the forecast chart. Numeric deltas highlighted with `--accent` or `--danger`. Used on `/scenarios/compare` and inside the Decision Engine.

### InsightCard

Three lines max: severity dot, headline (with embedded EvidenceChips), one-line action. Hover shows the full body. Dragging assigns; right-click resolves.

## Patterns

### Loading / empty / error

Every async block has three named states and a transition between them. Skeletons match final layout (no layout shift). Empty states explain what would appear and offer the action that would put data there. Error states show the request-id (from response header) for support.

### Forms

- All editing uses inline edit (click value, type, blur or Enter to save) where the form has ≤ 3 fields. Modal forms only for multi-step (create scenario, invite member, connect integration).
- `react-hook-form` + `zod` for everything that isn't inline.
- Submit button is always to the right; cancel is `Esc` or click-away.

### Confirm destructives

A small inline confirm row replaces the row being deleted ("Delete this transaction? Yes · Cancel"), instead of a modal. Modal only for irreversible bulk actions.

### Toasts

- Sonner. Top-right. Max 3 stacked.
- Success toasts are 2s. Errors stay until dismissed and include the request-id.
- Don't toast on routine actions ("Saved"). Toast on actions that happen out-of-band (background sync complete).

### Keyboard

| Shortcut | Action |
|---|---|
| Cmd-K | Command palette |
| Cmd-J | Copilot |
| Cmd-/ | Show all shortcuts |
| g d | Go to Dashboard |
| g r | Go to Runway |
| g i | Go to Invoices |
| g s | Go to Spending |
| g f | Go to Funding |
| g x | Go to Inbox |
| j / k | Down / up in tables and lists |
| Esc | Close sheet / cancel inline edit |

### Accessibility

- WCAG 2.2 AA minimum on color contrast (tokens above are checked).
- All interactive elements reachable via Tab in document order.
- `aria-live="polite"` for toasts and the SSE "new transactions" announcement.
- Tables use `<th scope>` and row headers where rows are records.

## What we do not do

- No carousels on the dashboard.
- No spinners over 200ms — replace with skeletons.
- No animated counters on financial figures. They imply movement that isn't there.
- No gradients on money. Gradients are decorative; numbers are not decoration.
- No "AI sparkle" icon overlays on every button. The Copilot has one entry point.
- No drag-and-drop for things that don't have a spatial meaning. Reordering categories: yes. Reordering metric cards: no (unless we ship customizable dashboards as an explicit feature).
