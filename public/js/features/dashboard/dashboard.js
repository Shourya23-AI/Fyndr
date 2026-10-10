import { S } from '../../core/state.js';
import { $ } from '../../core/dom.js';
import { userDashboard } from './user-dashboard.js';
import { orgDashboard } from './org-dashboard.js';
import { adminDashboard } from './admin-dashboard.js';
// #/dashboard picks the view that matches the signed-in role.
export async function dashboard() {
    if (!S.me) {
        return location.hash = '#/login';
    }
    const a = $('#app');
    if (S.me.role === 'user') {
        await userDashboard(a);
    }
    if (S.me.role === 'org') {
        await orgDashboard(a);
    }
    if (S.me.role === 'admin') {
        await adminDashboard(a);
    }
}
