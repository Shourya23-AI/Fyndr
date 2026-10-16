// One backup per UTC day, newest 7 kept: <file>.daily-YYYYMMDD. (The rolling <file>.bak in store.js covers "the last few minutes";
// these cover "something went wrong days ago and nobody noticed".) Returns true when a new backup was written.
const fs = require('fs');
const path = require('path');
const day = t => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
module.exports = function dailyBackup(file, now = Date.now(), keep = 7) {
    const target = `${file}.daily-${day(now)}`;
    if (fs.existsSync(target)) {
        return false;
    }
    fs.copyFileSync(file, target);
    const prefix = path.basename(file) + '.daily-';
    const all = fs.readdirSync(path.dirname(file)).filter(f => f.startsWith(prefix)).sort(); // the date in the name sorts oldest first
    all.slice(0, Math.max(0, all.length - keep)).forEach(f => fs.unlinkSync(path.join(path.dirname(file), f)));
    return true;
};
