/** Shared look of the hosted pages. Plain CSS: no inline styles (CSP). */
export const PAGE_CSS = `
:root { color-scheme: light dark; --bg: #faf7f2; --fg: #1b1713; --muted: #5d554a; --card: #ffffff; --line: #e1d9cc; --accent: #8a5b12; --accent-fg: #ffffff; --ok: #1e7f4b; --bad: #b3261e; }
@media (prefers-color-scheme: dark) { :root { --bg: #14110d; --fg: #f3eee6; --muted: #b5ab9c; --card: #1d1914; --line: #3a3228; --accent: #e0b65e; --accent-fg: #1b1713; --ok: #6fcf97; --bad: #f08a7c; } }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
main { width: 100%; max-width: 440px; background: var(--card); border: 1px solid var(--line); border-radius: 20px; padding: 28px 24px; }
h1 { margin: 0 0 8px; font-size: 1.4rem; }
p { margin: 0 0 16px; color: var(--muted); }
button { width: 100%; min-height: 52px; border: 0; border-radius: 14px; background: var(--accent); color: var(--accent-fg); font: inherit; font-weight: 700; cursor: pointer; }
button:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible { outline: 3px solid var(--fg); outline-offset: 3px; }
#status { margin: 16px 0 0; min-height: 1.5em; font-weight: 600; color: var(--muted); }
#status[data-state="ok"] { color: var(--ok); }
#status[data-state="error"] { color: var(--bad); }
.hint { margin-top: 16px; font-size: .875rem; }
`;
