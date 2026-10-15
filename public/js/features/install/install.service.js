import { toast } from '../../core/dom.js';

// Chromium browsers (Chrome, Edge, Brave, Samsung Internet...) offer a real one-click install through
// `beforeinstallprompt`. The early listener in index.html stores the event on window.__installPrompt.
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

// Browsers without a one-click install: tell people exactly what to do in theirs.
function manualSteps() {
    const ua = navigator.userAgent;
    const isIos = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const isFirefox = /Firefox|FxiOS/.test(ua); // Zen and other Firefox-based browsers identify as Firefox
    const isAndroid = /Android/.test(ua);
    const isMac = /Macintosh/.test(ua) && !isIos;
    if (isIos) {
        return 'Tap the <b>Share</b> button in your browser, then choose <b>Add to Home Screen</b>.';
    }
    if (isFirefox && isAndroid) {
        return 'Open the browser menu (<b>⋮</b>) and tap <b>Install</b> (or <b>Add to Home screen</b>).';
    }
    if (isFirefox) {
        return 'Firefox and Zen on desktop cannot install websites as apps. Open Fyndr in <b>Chrome</b> or <b>Edge</b> and use <b>Install Fyndr</b> in the address bar, or pin this tab (right-click the tab, then <b>Pin Tab</b>) for quick access.';
    }
    if (isMac && /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua)) {
        return 'In Safari choose <b>File</b>, then <b>Add to Dock</b>.';
    }
    return 'Open your browser menu and choose <b>Install Fyndr</b> (or <b>Add to Home screen</b>).';
}

function showHelp() {
    let dialog = document.getElementById('install-help');
    if (!dialog) {
        dialog = document.createElement('dialog');
        dialog.id = 'install-help';
        dialog.className = 'install-help';
        document.body.append(dialog);
        dialog.addEventListener('click', e => {
            if (e.target === dialog) {
                dialog.close(); // click on the backdrop
            }
        });
    }
    dialog.innerHTML = `
        <h3>Get the Fyndr app</h3>
        <p>${manualSteps()}</p>
        <form method="dialog"><button class="button button-dark">Got it</button></form>`;
    dialog.showModal();
}

// "Get the app" button.
export async function installApp() {
    const prompt = window.__installPrompt;
    if (!prompt) {
        return showHelp();
    }
    window.__installPrompt = null; // a prompt event can only be used once
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') {
        toast('Installing Fyndr…');
    }
}

export function hideInstallButtons() {
    document.querySelectorAll('[data-act="install-app"]').forEach(btn => {
        btn.hidden = true;
    });
}

export function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
        return;
    }
    // A new version of the site was installed: reload once so the open page uses the new files (not a mix of old and new).
    const hadWorker = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('message', e => {
        if (e.data?.type === 'fyndr-updated' && hadWorker && !sessionStorage.getItem('fyndr-reloaded') && !location.hash.startsWith('#/phone')) {
            sessionStorage.setItem('fyndr-reloaded', '1');
            location.reload();
        }
    });
    const register = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    document.readyState === 'complete' ? register() : addEventListener('load', register);
}
