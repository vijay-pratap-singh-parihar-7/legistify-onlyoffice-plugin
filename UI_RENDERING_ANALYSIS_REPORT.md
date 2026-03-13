# ONLYOFFICE Plugin UI Rendering & Behavior Analysis — Technical Report

**Scope:** Deep codebase analysis only. No code was modified.  
**Reference:** contract-frontend (working) vs legistify-onlyoffice-plugin (issues).  
**Context:** Plugin runs inside an ONLYOFFICE iframe.

---

## 1. How contract-frontend Implements the UI Correctly

### 1.1 Architecture and Stack

- **Framework:** React with Redux (`detailsAiSlice` for AI panel section state).
- **Panel placement:** 
  - **OnlyOffice editor:** Right-side panel via `SidePanel.js`; content keyed by `content[tabs]` (Share, Threads, Notify, Ask AI, Summary, Obligation, Clauses, Library, View, AI Playbook, **Clause Approval**, Approval).
  - **Contract detail:** AI panel in an offcanvas (`CustomCanvas` + `AIHomePage`) toggled by `showAiOptions`.
- **Clause Approval (reference):** Implemented as a single React component: `ClauseApproval.js` (OnlyOffice SidePanel), using Fluent UI (`@fluentui/react-components`) for layout and controls, plus **react-select** for Reminder and **AsyncSelect** for team members.

### 1.2 Component Hierarchy (Clause Approval)

- **ClauseApproval** uses:
  - Fluent: `Input`, `Textarea`, `Button`, `Text`, `Accordion`, etc.
  - **Select** (react-select) for Reminder: `options={remindOptions}` (1–10), `placeholder="Reminder"`, `classNamePrefix='select'`, shared `selectDefaultProps` (theme, className).
  - **AsyncSelect** (react-select/async) for “Search team members”: `loadOptions`, `cacheOptions`, **defaultOptions**, `placeholder="Search team members"`, `onInputChange={handleOrgUserInputChange}` (strip non-word chars), value from `level.fullName` / `level.orgUsers?.[0]`.
- **Styles:** Fluent `makeStyles` for layout, borders, errors; **:global(.select__control)**, **:global(.select__placeholder)** etc. for react-select so the dropdown and placeholder look consistent.

### 1.3 Placeholder and Prompt Input (Ask Legistify AI)

- **Component:** `PromptContainer.js` (CD_PromptContainer).
- **Markup:** Reactstrap `Input` (textarea), `className="c_d_ai_prompt_input"`, `placeholder="Ask Legistify AI"`, `id="c_d_ai_myTextarea"`.
- **Styling:** Dedicated SCSS file `promptContainer.scss`:
  - `.c_d_ai_prompt_input`: font-size **16px**, color, line-height, **&::placeholder { color: #9aa0a6 }**, focus hides placeholder (opacity 0), disabled state overrides.
  - Media query for smaller font on narrow screens.
- **Behavior:** Controlled input, focus/blur with 200ms delay for suggestion clicks, Enter to send, auto-resize textarea via `useEffect`.

### 1.4 Reminder Dropdown

- **Implementation:** react-select **Select** with:
  - `options={remindOptions}` (array of `{ value: '1'..'10', label: '1'..'10' }`),
  - `placeholder="Reminder"`,
  - `value={remindOptions.find((option) => option.value === form.reminderDays)}`,
  - `isClearable`,
  - Fluent-style error state and `reactSelect` / `reactSelectError` classes.
- **Result:** Consistent look (control height, border, placeholder color) and accessibility; menu can extend outside the panel depending on react-select version and portal usage.

### 1.5 Auto Summarize Button

- **Implementation:** Fluent `Button` with `appearance="transparent"`, `onClick={handleGenerateSummary}`, `disabled={generatingSummary || !form.clause}`.
- **Styling:** `makeStyles`: `autoSummarizeButton`, `autoSummarizeEnabled` (primary blue), `autoSummarizeDisabled` (gray, not-allowed).
- **API:** `generateContractClauseSummary` from services (POST `ai-assistant/generate-contract-clause-summary`); on success, form summary is updated via React state.

### 1.6 Team Member Search Dropdown

- **Implementation:** react-select **AsyncSelect**:
  - **defaultOptions:** Loads initial options on focus (often with empty string) so dropdown can open before typing.
  - **loadOptions:** Debounced (1000ms) call to `fetchAllOrgUsers({ contractId, value: inputValue })`; response `response?.data?.orgUsers`; filter by already selected user IDs; map to `{ label: item.fullName, value: { id, img } }`; single-select per level.
  - **onInputChange:** `handleOrgUserInputChange` — `newValue.replace(/\W/g, '')` so only word characters are sent.
- **API:** `constants.FETCH_ALL_ORG_USERS` → `org-user/all-users?email=${data?.value || ''}` (contractId passed but not used in URL in current services).
- **Result:** Dropdown opens on focus (initial load), shows results as user types, consistent styling and no overflow issues when menu is in DOM/portal.

### 1.7 State and Lifecycle

- Form and list state live in React state / Redux; no full-DOM replace. Only the relevant parts re-render; refs and focus stay valid. Dropdowns are part of the React tree (or portaled by the library).

---

## 2. How legistify-onlyoffice-plugin Implements It

### 2.1 Architecture and Stack

- **No React:** Vanilla JS; panel is a single HTML document (`index.html`) loaded in the OnlyOffice **iframe**.
- **Structure:** Tabs (Playbook, Review Hub, Copilot) and a **drawer** for Summary, Clauses, Obligations, Library, **Clause Approval**, AI Copilot. Drawer content is either a **clone** of a view (with IDs suffixed by `-drawer`) or **replaced** by innerHTML (e.g. approval form).
- **Clause Approval:** Implemented in `approval.js`: module-level state (`form`, `errors`, `showNewApprovalForm`, etc.); **renderForm()** returns an HTML string; **updateApprovalContent()** does `content.innerHTML = renderForm()` (or list/detail HTML). So the entire form is recreated on every state change.

### 2.2 Placeholder and Prompt Input (Ask Legistify AI)

- **Markup:** In `askAI.js`, the Ask AI view is built as an HTML string and assigned with `askAIView.innerHTML = htmlContent`. The prompt is a **textarea** with:
  - `id="prompt-input-ref"`, `class="c_d_ai_prompt_input form-control"`, `placeholder="Ask Legistify AI"`,
  - **inline styles:** `font-size: 12px`, `font-family: inherit`, etc.
- **Styling:** `plugin.css` has `.c_d_ai_prompt_input` and `.c_d_ai_prompt_input::placeholder` (color #9aa0a6), but **font-size in CSS is 16px** while **inline style is 12px** (inline wins). So placeholder and input can look smaller/inconsistent compared to contract-frontend.
- **Behavior:** Handlers (`handlePromptInput`, `handleGenerate`, etc.) are global; after each re-render, refs are re-queried from the new DOM.

### 2.3 Reminder Dropdown

- **Implementation:** **Native `<select>`** in the form HTML string:
  - `class="approval-form-select"`, inline styles (padding, border, font-size 11px, font-family).
  - Options: one “Reminder” (value ""), then 1–10.
- **Styling:** No dedicated rules in `plugin.css` for `.approval-form-select`; only inline styles. In an iframe, native select uses browser defaults (e.g. different padding, arrow, font), so it can look and behave differently from contract-frontend’s react-select.

### 2.4 Auto Summarize Button

- **Implementation:** Inline `<button>` in the form string: `onclick="handleGenerateSummary()"`, `disabled="${generatingSummary || !form.clause}"`, inline styles (padding, font-size, colors, cursor).
- **Behavior:** Matches contract-frontend logically (same API: generate-contract-clause-summary), but appearance is ad hoc (no shared design tokens or Fluent-style classes).

### 2.5 Team Member Search Dropdown

- **Implementation:** Custom dropdown, not react-select:
  - **Input:** `<input>` with `id="team-member-input-${index}"`, `class="approval-form-input team-member-input"`, `placeholder="Search team members"`, `oninput="handleTeamMemberSearch(${index}, this.value)"`, `onfocus="handleTeamMemberFocus(${index})"`.
  - **Dropdown:** `<div id="team-member-dropdown-${index}" class="team-member-dropdown" style="display: none; position: absolute; ... z-index: 1000; ...">`. Shown when `fetchTeamMembers(index, value)` runs; content is set via `dropdown.innerHTML` (loading state, list of items, or “No team members found”).
- **API:** Same endpoint: `org-user/all-users?email=${encodeURIComponent(cleanValue)}`; response normalized to `data?.data?.orgUsers || data?.data?.users || data?.orgUsers || data?.users`.
- **Debounce:** 1000ms in `handleTeamMemberSearch`; dropdown only shown when `value.trim().length > 0`; on focus, if there’s already a value, `fetchTeamMembers` is called.
- **Close:** Document-level click listener closes dropdown if click is outside `.team-member-input` and `.team-member-dropdown`.
- **Re-render:** After `selectTeamMember`, `updateApprovalContent()` runs, so **entire form is re-rendered** (innerHTML). New input and dropdown nodes are created; any open dropdown is destroyed.

### 2.6 Left Panel and Drawer

- **Drawer:** `.drawer-content` has **overflow: hidden**; `.drawer-view` has **overflow: hidden**. The approval form is rendered inside `#approval-content-drawer` (or `#approval-content`) which sits inside this hierarchy.
- **No portal:** The team member dropdown is a sibling of the input inside the form; it is **not** portaled to `document.body`, so it stays inside the same overflow chain.
- **Result:** A dropdown that extends below the input can be **clipped** by an ancestor’s `overflow: hidden`, so it can appear as if the “dropdown does not appear.”

---

## 3. Key Differences Causing the Issues

| Area | contract-frontend | legistify-onlyoffice-plugin |
|------|-------------------|-----------------------------|
| **Placeholder / prompt** | SCSS with explicit font-size (16px), placeholder color, focus/disabled; React component | Inline font-size 12px overrides CSS 16px; class names match but context is iframe + innerHTML |
| **Reminder** | react-select Select (styled, consistent) | Native `<select>` with only inline styles; no shared CSS class styling |
| **Auto summarize** | Fluent Button + makeStyles | Inline button styles |
| **Team search** | AsyncSelect + defaultOptions (open on focus), loadOptions with 1s debounce, menu in React/portal | Custom input + div dropdown; 1s debounce; **no initial load on focus**; dropdown inside overflow container; **full form re-render on select** |
| **Form updates** | React setState; no DOM replace | `content.innerHTML = renderForm()` on every update |
| **Dropdown placement** | react-select menu (optionally portaled) | Absolute div inside form; subject to drawer overflow |
| **Environment** | Main app document | iframe; only plugin CSS and OnlyOffice base CSS |

Concrete causes:

- **Missing / overridden CSS:** Placeholder and input font-size inconsistency (inline 12px vs SCSS 16px); no centralized styles for approval form inputs/selects.
- **Different dropdown mechanism:** Native select vs react-select (reminder); custom div vs AsyncSelect (team members), with different open-on-focus and menu positioning behavior.
- **Overflow clipping:** `.drawer-content` and `.drawer-view` use `overflow: hidden`; custom dropdown is in-flow and gets clipped.
- **Re-render wipes DOM:** `updateApprovalContent()` replaces the whole form; refs and dropdown DOM are destroyed on every state change (e.g. after selecting a team member).
- **No defaultOptions equivalent:** Plugin only fetches team members when user has typed and after 1s debounce; dropdown does not open with an initial list on focus.
- **Event and timing:** Document click-close can interact with focus/blur and re-render timing (e.g. focus lost before dropdown is shown, or dropdown removed by next innerHTML update).

---

## 4. Root Cause per Issue

### 4.1 Placeholder styling (fonts, sizes, inconsistency)

- **Cause 1:** In the plugin, the prompt textarea uses **inline `font-size: 12px`** (in `askAI.js`), while `plugin.css` sets `.c_d_ai_prompt_input { font-size: 16px }`. Inline wins, so the prompt (and its placeholder) render smaller than in contract-frontend.
- **Cause 2:** Approval form inputs (Clause No, Clause, Summary, Search team members, etc.) are styled **only with inline styles** (e.g. font-size 11px, font-family). There are no `.approval-form-input` / `.approval-form-textarea` rules in `plugin.css`, so placeholder appearance depends on browser defaults and inheritance inside the iframe, and can differ from contract-frontend’s Fluent/react-select styling.

### 4.2 Reminder dropdown not rendering correctly

- **Cause 1:** contract-frontend uses a **react-select** control (custom markup and styles); the plugin uses a **native `<select>`**. Native selects in an iframe can look different (size, arrow, focus ring) and don’t share the same visual design.
- **Cause 2:** No CSS targeting `.approval-form-select` in the plugin, so the reminder control has no design-system alignment; it relies entirely on inline styles and browser defaults.

### 4.3 Auto summarize button (UI behavior/rendering)

- **Cause:** contract-frontend uses a Fluent `Button` with `makeStyles` (colors, disabled state, focus). The plugin uses a plain `<button>` with inline styles. Logic is the same (disabled when no clause or generating), but the look and focus behavior can differ (e.g. focus ring, hover) and there is no shared component or tokens.

### 4.4 Search team members (dropdown not appearing, not all names, inconsistent)

- **Dropdown does not appear:**
  - **Primary:** The custom dropdown div is inside the drawer hierarchy. **`.drawer-content` and `.drawer-view` use `overflow: hidden`**, so the absolutely positioned dropdown is clipped and can be invisible or partially cut off.
  - **Secondary:** Dropdown is only shown when the user has typed and after a **1s debounce**; there is **no “defaultOptions”** behavior, so opening on focus with an initial list doesn’t happen. Users may expect to see a list as soon as they focus the field.
- **Not all team member names appear:**
  - **Possible causes:** Same API and response normalization as contract-frontend, but (1) backend may paginate or limit results (no pagination in plugin), (2) `cleanValue = searchValue.replace(/\W/g, '')` might over-restrict if the API supports more than email/word chars, (3) filtering by `selectedUserIds` is correct but any ID mismatch (e.g. string vs object) could over-filter.
- **Inconsistent search interaction:**
  - Full form re-render on `updateApprovalContent()` destroys the input and dropdown DOM; focus and dropdown state are lost.
  - Document click listener closes the dropdown; if event order or bubbling differs in the iframe, or if a re-render happens right after focus, the dropdown can close immediately or not open reliably.

### 4.5 Left panel rendering differences (overall)

- **Component hierarchy:** contract-frontend is a React tree (SidePanel → content[tabs] → ClauseApproval with Fluent + react-select). The plugin is a single HTML document with tabs and a drawer; content is produced by string templates and injected via innerHTML.
- **State management:** React state/Redux vs module-level variables; no single “component tree” to drive updates, so updates are done by re-building HTML and replacing innerHTML.
- **Event propagation:** In the plugin, handlers are global (`onclick="..."`, `oninput="..."`); after each innerHTML update, the previous nodes (and any attached listeners) are gone. Focus and timing (e.g. blur then click) can behave differently than in React.
- **CSS scope:** Plugin runs in an iframe with only its own CSS and OnlyOffice base; no Bootstrap/Fluent/Reactstrap from the main app. Styles must be fully self-contained; any missing or overridden rule (e.g. inline font-size) changes the look.

---

## 5. Fix Strategy (No Code Changes)

Recommended directions so the plugin behaves as close as possible to contract-frontend without breaking existing features, reusing contract-frontend patterns where feasible, and respecting the OnlyOffice iframe.

### 5.1 Placeholder styling

- **Unify prompt input:** Prefer a single source of truth for the AI prompt textarea (e.g. remove inline `font-size: 12px` in `askAI.js` so `plugin.css` `.c_d_ai_prompt_input` 16px applies), or add a dedicated class and set font-size and placeholder color only in CSS. Align placeholder color and focus/disabled behavior with `promptContainer.scss` (e.g. `#9aa0a6`, opacity 0 on focus).
- **Approval form inputs:** Introduce classes (e.g. `.approval-form-input`, `.approval-form-textarea`, `.approval-form-select`) and move font-family, font-size, placeholder color, and borders from inline into `plugin.css` so placeholders and inputs are consistent and easier to maintain.

### 5.2 Reminder dropdown

- **Option A (minimal):** Add CSS in `plugin.css` for `.approval-form-select` (height, padding, border-radius, font-size, background, arrow) to approximate the react-select look so the native select doesn’t rely only on browser defaults.
- **Option B (match contract-frontend closely):** Replace the native `<select>` with a small custom dropdown (or a lightweight select library that works in vanilla JS) that mirrors react-select’s structure and styling (placeholder, options list, clear). Ensure its menu is either not clipped (see 5.4) or portaled.

### 5.3 Auto summarize button

- Add a shared class (e.g. `.approval-primary-button` or reuse a design token) in `plugin.css` for the Auto Summarize button (normal, hover, disabled, focus) so it matches contract-frontend’s Fluent button appearance and behavior (cursor, opacity) without adding a framework.

### 5.4 Team member search dropdown (critical)

- **Avoid clipping:** Either (1) relax overflow for the drawer when the dropdown is open (e.g. temporary `overflow: visible` on the scroll container that contains the form, or a dedicated wrapper with `overflow: visible`), or (2) render the dropdown in a **portal** (e.g. append to `document.body` inside the iframe) and position it with getBoundingClientRect so it’s not inside any `overflow: hidden` ancestor. Prefer portal so behavior is consistent regardless of scroll.
- **Show dropdown on focus:** Implement “defaultOptions”-like behavior: on first focus of the team member input, call the API with an empty or minimal query (if the backend supports it) and show the dropdown with initial results so the list appears without waiting for 1s after typing.
- **Reduce re-renders that destroy dropdown:** Avoid replacing the entire form DOM on every keystroke or selection. Options: (1) Update only the parts that changed (e.g. the selected value in the input) without re-running `renderForm()` for the whole form, or (2) re-attach focus to the same logical input after re-render and avoid calling `updateApprovalContent()` synchronously right after `selectTeamMember` so the dropdown can close naturally before the form is re-painted.
- **Debounce and API:** Keep a short debounce (e.g. 300–500ms) for search; confirm backend response shape and any pagination so “not all names” is addressed (add pagination or “load more” if the API is paginated).
- **Click-outside:** Keep the document listener to close the dropdown, but ensure it doesn’t run when the user is clicking the dropdown (e.g. use a short timeout so the dropdown open happens after focus, and ensure the dropdown container has a stable class/selector so clicks on it are not treated as “outside”).

### 5.5 Left panel and lifecycle

- **Minimal re-renders:** Where possible, update only the fragment that changed (e.g. approval list, single level row) instead of replacing the whole approval content with innerHTML, so that focus, dropdown state, and cursor position are preserved.
- **Stable refs/IDs:** If the drawer clones views and appends with `-drawer` suffix, ensure any logic that looks up `approval-content` or form elements uses the same ID resolution as `updateApprovalContent()` (e.g. `approval-content-drawer` when in drawer) so the correct container is always updated and no duplicate IDs exist.
- **CSS isolation:** Keep all panel-specific styles in the plugin’s CSS (or a small set of files) so that the iframe is self-contained and only intentional overrides (e.g. from OnlyOffice) apply. Avoid relying on main-app styles.

### 5.6 General

- **Reuse contract-frontend patterns:** Same API endpoints and response normalization (already done for team members); same placeholder text and button labels; same validation rules and error messages. Where the plugin uses custom controls (dropdowns, buttons), mirror contract-frontend’s look and behavior via CSS and minimal DOM updates.
- **OnlyOffice constraints:** Do not depend on styles or scripts from the host page; assume a single iframe document. Use document.body for portals if needed; keep z-index and overflow in mind so dropdowns and modals are visible.
- **Non-breaking:** Changes should be additive (new CSS classes, optional portal) or targeted (stop replacing whole form when only one field changes); avoid removing or changing existing global handlers until behavior is replicated and tested.

---

## Summary Table

| Issue | Root cause | Fix direction |
|-------|------------|----------------|
| Placeholder styling | Inline 12px overrides CSS; no approval-form CSS classes | Single source for prompt font/placeholder; add approval-form classes in CSS |
| Reminder dropdown | Native select + no CSS vs react-select | Style native select in CSS or replace with custom/react-select-like control |
| Auto summarize UI | Inline button styles vs Fluent | Add button classes in plugin.css |
| Team dropdown not appearing | overflow: hidden on drawer + in-flow dropdown | Portal dropdown to body and/or relax overflow when open |
| Team dropdown not all names | Possible API limit/pagination or over-filtering | Confirm API contract; add pagination or “load more” if needed |
| Search inconsistent | Full form innerHTML replace + 1s debounce only, no defaultOptions | Less aggressive re-render; open-on-focus with initial load; stable click-outside |
| Left panel differences | innerHTML updates, no React, iframe CSS | Targeted DOM updates; self-contained CSS; portal for overlays |

This completes the analysis. Implementing the fix strategy above in small steps will align the plugin’s UI and behavior with contract-frontend while keeping the ONLYOFFICE iframe constraints in mind.
