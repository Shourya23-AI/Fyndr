import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { skeleton } from '../../core/skeleton.js';
import { userDashboard } from './user-dashboard.js';
import { orgDashboard } from './org-dashboard.js';
import { adminDashboard } from './admin-dashboard.js';
// #/dashboard picks the view that matches the signed-in role.
export async function dashboard() {
    if (!S.me) {
        return location.hash = '#/login';
    }
    const a = $('#app');
    // Placeholder while the data loads (skipped when switching tabs inside a dashboard: the old view stays until the new one is ready).
    if (!a.querySelector('.dash-layout')) {
        a.innerHTML = skeleton('dash');
    }
    if (S.me.role === 'user') {
        await userDashboard(a);
    }
    if (S.me.role === 'org') {
        await orgDashboard(a);
    }
    if (S.me.role === 'admin' || S.me.role === 'moderator') {
        await adminDashboard(a);
    }
}
