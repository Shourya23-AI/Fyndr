// Tiny script that must run before first paint. It lives in a file (not inline in index.html) so the page's
// Content-Security-Policy can refuse ALL inline script: script-src has no 'unsafe-inline'.
// 1) Keep the browser's install prompt so the sidebar "Get the app" button can use it later.
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__installPrompt = e;
});

// 2) Apply the saved (or system) theme before first paint to avoid a flash.
document.documentElement.dataset.theme =
  localStorage.theme ||
  (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");

// 3) Web fonts load without blocking the first paint: the <link data-async-css media="print"> is switched to "all" once it has loaded.
//    (This used to be onload="this.media='all'" in the HTML, which an inline-script-free policy would block.)
for (const link of document.querySelectorAll("link[data-async-css]")) {
  const on = () => {
    link.media = "all";
  };
  if (link.sheet) {
    on();
  } else {
    link.addEventListener("load", on, { once: true });
  }
}
