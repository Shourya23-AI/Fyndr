import { ferr } from '../../core/errors.js';

// Server / phone.email problems -> a sentence a normal person can act on. Anything else falls back to the shared error text.
const MSG = {
    PHONE_FAILED: 'phone.email could not confirm your number. The code may have expired. Press "Try again" and enter a fresh code.',
    PHONE_UNREACHABLE: 'We could not reach phone.email. Check your internet connection and try again.',
    PHONE_RATE: 'Too many attempts. Please wait a while and try again.',
    NOT_CONFIGURED: 'Phone verification is not set up on this site yet. Please contact the site owner.'
};
export const phoneMsg = x => MSG[x?.code] || ferr(x || {}) || 'Something went wrong. Please try again.';
