import {S} from '../../core/state.js';
import {browse} from '../browse/browse.js';
import {landing} from './landing.js';
// "/" shows the browse page when signed in, the landing page otherwise.
export const home=()=>S.me?browse():landing();
