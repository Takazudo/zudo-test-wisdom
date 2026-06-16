/** @jsxRuntime automatic */
/** @jsxImportSource preact */
// TEMPORARY WORKAROUND for an upstream @takazudo/zudo-doc bug (0.2.9):
// mermaid diagrams render on a direct page load but go BLANK after a
// client-side (SPA) navigation into a second mermaid page — silently, with
// no JS error.
//
// Root cause (upstream, reported via /dev-upstream-report):
// zudo-doc's mermaid init (`code-syntax/mermaid-init-script.ts`) re-renders
// diagrams from a MutationObserver watching <html> `style`/`data-theme`
// (intended for the theme-toggle / color-tweak panel). But zfb's client-router
// `swapRootAttributes()` removes+re-adds ALL <html> attributes on EVERY soft
// navigation, which trips that observer and runs `reinitMermaid()` ~300ms after
// each nav. `reinitMermaid()` removes the rendered <svg> but leaves mermaid's
// `data-processed` marker set, and the original graph source was already
// consumed into the SVG — so the subsequent re-render no-ops (mermaid skips
// `data-processed` nodes) and the diagram is left permanently blank.
//
// This script snapshots each diagram's good rendered SVG and restores it the
// moment the destructive reinit blanks it. It reuses zudo-doc's own themed
// render output (no theme logic, no mermaid re-import here), so the restored
// diagram is pixel-identical to the original. Setting `data-processed` back on
// restore makes zudo-doc's trailing `initMermaid()` skip the node, so the
// restore survives.
//
// REMOVE THIS once zudo-doc ships the fix and `@takazudo/zudo-doc` is bumped.

import type { JSX } from "preact";

// `data-mermaid` is emitted by zfb's MermaidPlugin; `zfb:after-swap` is
// zudo-doc's AFTER_NAVIGATE_EVENT, dispatched by zfb-runtime's client router
// after every soft navigation.
const MERMAID_NAV_FIX_SCRIPT = `(function () {
  if (typeof document === "undefined" || typeof MutationObserver === "undefined") return;
  var GOOD = new WeakMap();
  var SEEN = new WeakSet();
  function hasSvg(el) { return !!el.querySelector("svg"); }
  function guard(el) {
    if (SEEN.has(el)) return;
    SEEN.add(el);
    if (hasSvg(el)) GOOD.set(el, el.innerHTML);
    new MutationObserver(function () {
      if (hasSvg(el)) {
        // Snapshot the good, themed SVG that zudo-doc just rendered.
        GOOD.set(el, el.innerHTML);
      } else if (GOOD.has(el)) {
        // The destructive reinit blanked it — restore the snapshot. Re-set
        // data-processed so zudo-doc's trailing initMermaid() skips the node
        // (otherwise it would re-run mermaid on an empty element).
        el.innerHTML = GOOD.get(el);
        el.setAttribute("data-processed", "true");
        el.setAttribute("data-mermaid-rendered", "");
      }
    }).observe(el, { childList: true });
  }
  function scan() {
    var els = document.querySelectorAll("[data-mermaid]");
    for (var i = 0; i < els.length; i++) guard(els[i]);
  }
  scan();
  // After every soft navigation, attach guards to the freshly swapped-in
  // diagrams. The delayed re-scans are belt-and-braces for late-mounted nodes;
  // once a guard observer is attached it handles all later render/strip churn.
  document.addEventListener("zfb:after-swap", function () {
    scan();
    setTimeout(scan, 150);
    setTimeout(scan, 500);
  });
})();`;

/**
 * Body-end script that keeps mermaid diagrams visible across zfb SPA
 * navigations, working around an upstream zudo-doc reinit bug. Idempotent and
 * cost-free on pages with no `[data-mermaid]` containers.
 */
export function MermaidNavFix(): JSX.Element {
  return <script dangerouslySetInnerHTML={{ __html: MERMAID_NAV_FIX_SCRIPT }} />;
}
