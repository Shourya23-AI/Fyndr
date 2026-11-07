import { toast } from '../../core/dom.js';
import { installApp, isStandalone, hideInstallButtons, registerServiceWorker } from './install.service.js';

export const bind = () => {
    registerServiceWorker();
    if (isStandalone()) {
        hideInstallButtons(); // already running as an installed app
    }
    addEventListener('appinstalled', () => {
        window.__installPrompt = null;
        hideInstallButtons();
        toast('Fyndr installed ✓');
    });
};

export const actions = {
    'install-app': () => installApp()
};
