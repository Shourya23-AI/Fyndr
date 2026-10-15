// Places for the jobs filters (no DOM, no network): which Indian city a listing is in, how far two cities are, and the three place filters.
//   Anywhere  every listing
//   Near me   listings in the person's city or a city within NEAR_KM of it, nearest first
//   Remote    work-from-home / online listings
// The person's own position is turned into the nearest city IN THE BROWSER and then forgotten: coordinates are never sent or stored anywhere.
export const NEAR_KM = 60;
// [name, lat, lng, other spellings]
export const CITIES = [
    ['Bengaluru', 12.9716, 77.5946, ['bangalore']], ['Mumbai', 19.076, 72.8777, ['bombay']], ['Navi Mumbai', 19.033, 73.0297, []], ['Thane', 19.2183, 72.9781, []],
    ['Pune', 18.5204, 73.8567, ['poona']], ['Delhi', 28.6139, 77.209, ['new delhi', 'ncr', 'delhi ncr']], ['Gurugram', 28.4595, 77.0266, ['gurgaon']], ['Noida', 28.5355, 77.391, ['greater noida']],
    ['Ghaziabad', 28.6692, 77.4538, []], ['Faridabad', 28.4089, 77.3178, []], ['Chennai', 13.0827, 80.2707, ['madras']], ['Hyderabad', 17.385, 78.4867, ['secunderabad']],
    ['Kolkata', 22.5726, 88.3639, ['calcutta']], ['Bhubaneswar', 20.2961, 85.8245, []], ['Jaipur', 26.9124, 75.7873, []], ['Kochi', 9.9312, 76.2673, ['cochin', 'ernakulam']],
    ['Thiruvananthapuram', 8.5241, 76.9366, ['trivandrum']], ['Coimbatore', 11.0168, 76.9558, ['kovai']], ['Madurai', 9.9252, 78.1198, []], ['Ahmedabad', 23.0225, 72.5714, []],
    ['Vadodara', 22.3072, 73.1812, ['baroda']], ['Surat', 21.1702, 72.8311, []], ['Chandigarh', 30.7333, 76.7794, []], ['Mohali', 30.7046, 76.7179, []], ['Indore', 22.7196, 75.8577, []],
    ['Bhopal', 23.2599, 77.4126, []], ['Nagpur', 21.1458, 79.0882, []], ['Nashik', 19.9975, 73.7898, []], ['Lucknow', 26.8467, 80.9462, []], ['Kanpur', 26.4499, 80.3319, []],
    ['Patna', 25.5941, 85.1376, []], ['Ranchi', 23.3441, 85.3096, []], ['Raipur', 21.2514, 81.6296, []], ['Guwahati', 26.1445, 91.7362, []], ['Dehradun', 30.3165, 78.0322, []],
    ['Visakhapatnam', 17.6868, 83.2185, ['vizag']], ['Vijayawada', 16.5062, 80.648, []], ['Mysuru', 12.2958, 76.6394, ['mysore']], ['Mangaluru', 12.9141, 74.856, ['mangalore']],
    ['Hubballi', 15.3647, 75.124, ['hubli']], ['Goa', 15.4909, 73.8278, ['panaji', 'panjim']]
];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// every spelling -> city, longest spelling first so "navi mumbai" wins over "mumbai"
const NAMES = CITIES.flatMap(c => [[c[0].toLowerCase(), c], ...c[3].map(a => [a, c])]).sort((a, b) => b[0].length - a[0].length);
const RE = NAMES.map(([n, c]) => [new RegExp('(^|[^a-z])' + esc(n) + '($|[^a-z])'), c]);
// the city named in a piece of text (a listing's location, a profile's cities, what the person typed), or null
export function cityIn(text) {
    const t = String(text ?? '').toLowerCase();
    for (const [re, c] of RE) {
        if (re.test(t)) {
            return c;
        }
    }
    return null;
}
export const cityByName = name => CITIES.find(c => c[0] === name) || null;
export function km(a, b) {
    const r = x => x * Math.PI / 180;
    const dLat = r(b[1] - a[1]), dLng = r(b[2] - a[2]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a[1])) * Math.cos(r(b[1])) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
}
// The nearest listed city to a position, when one is within `max` km (a person in a village 400 km from any listed city gets null).
export function nearestCity(lat, lng, max = 120) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    let best = null;
    for (const c of CITIES) {
        const d = km([0, lat, lng], c);
        if (!best || d < best.d) {
            best = { c, d };
        }
    }
    return best && best.d <= max ? best.c : null;
}
export const isRemote = l => /\b(remote|work from home|wfh|anywhere|online)\b/i.test(String(l && l.location || ''));
// "India · many cities and remote": a board search across many places, not one city
const spread = l => /many cities/i.test(String(l && l.location || ''));
// Rows in or near `origin` (a city from CITIES), nearest first; rows in the same distance keep their order.
export function nearRows(rows, origin, maxKm = NEAR_KM) {
    if (!origin) {
        return [];
    }
    const out = [];
    rows.forEach((l, i) => {
        if (l.type === 'Course' || isRemote(l) || spread(l)) {
            return;
        }
        const c = cityIn(l.location);
        const d = c ? km(origin, c) : Infinity;
        if (d <= maxKm) {
            out.push({ l, i, d });
        }
    });
    return out.sort((a, b) => a.d - b.d || a.i - b.i).map(x => x.l);
}
export const remoteRows = rows => rows.filter(l => l.type !== 'Course' && isRemote(l));
// Where the person is, best source first: a city they typed in the Location box, a city found from their device, the first city on their profile.
// -> { city, how: 'typed'|'device'|'profile' } or null
export function originFrom({ typed = '', device = null, profileLocations = '' } = {}) {
    const t = cityIn(typed);
    if (t) {
        return { city: t, how: 'typed' };
    }
    if (device) {
        return { city: device, how: 'device' };
    }
    for (const part of String(profileLocations ?? '').split(/[,;/|·\n]+|\band\b/i)) {
        const c = cityIn(part);
        if (c) {
            return { city: c, how: 'profile' };
        }
    }
    return null;
}
// Asks the browser for the position (once, 8 s at most) -> a city, or null when the person said no / the position is far from every listed city.
// Resolves { city, denied, far }.
export function locate() {
    return new Promise(done => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return done({ city: null, denied: true });
        }
        navigator.geolocation.getCurrentPosition(
            p => {
                const city = nearestCity(p.coords.latitude, p.coords.longitude);
                done({ city, far: !city });
            },
            () => done({ city: null, denied: true }),
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 10 * 60e3 }
        );
    });
}
