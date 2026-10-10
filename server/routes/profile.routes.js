const { R, bad, need } = require('../lib/router');
const { db, save } = require('../db/store');
const fs = require('fs');
const path = require('path');
const { QUAL, EXP, JT, completion, cleanExtras } = require('../lib/helpers');
const { UP_DIR: UP } = require('../config');
// Candidate profile + resume.
R('GET', '/api/profile', ['user'], ({ user }) => ({
    profile: user.profile || {}, resume: user.resume || null, completion: completion(user), phone: user.phone || null, name: user.name, email: user.email, photo: user.photo || null, joined: user.created
}));
R('PUT', '/api/profile', ['user'], ({ user, body: b }) => {
    need(b, 'qualification', 'field', 'institution', 'experience');
    const yr = +b.gradYear;
    if (!(yr >= 1970 && yr <= new Date().getFullYear() + 8)) {
        bad(400, 'Enter a valid graduation year');
    }
    if (!QUAL.includes(b.qualification) || !EXP.includes(b.experience)) {
        bad(400, 'Invalid selection');
    }
    const skills = [...new Set((Array.isArray(b.skills) ? b.skills : []).map(s => String(s).trim().slice(0, 30)).filter(Boolean))].slice(0, 30);
    if (!skills.length) {
        bad(400, 'Add at least one skill');
    }
    user.profile = {
        qualification: b.qualification, field: b.field.trim().slice(0, 80), institution: b.institution.trim().slice(0, 100), gradYear: yr, skills, experience: b.experience,
        jobTypes: (Array.isArray(b.jobTypes) ? b.jobTypes : []).filter(t => JT.includes(t)), locations: String(b.locations || '').trim().slice(0, 150), headline: String(b.headline || '').trim().slice(0, 100), summary: String(b.summary || '').trim().slice(0, 500), projects: String(b.projects || '').trim().slice(0, 800), link: String(b.link || '').trim().slice(0, 200), ...cleanExtras(b, skills), done: true
    };
    save();
    return { completion: completion(user) };
});
R('POST', '/api/resume', ['user'], ({ user, body: b }) => {
    const buf = Buffer.from(String(b.data || ''), 'base64');
    if (!buf.length || buf.length > 2 * 1024 * 1024) {
        bad(413, 'Resume must be a PDF under 2 MB');
    }
    if (buf.subarray(0, 5).toString() !== '%PDF-') {
        bad(400, 'Only PDF files are allowed');
    }
    fs.mkdirSync(UP, { recursive: true });
    fs.writeFileSync(path.join(UP, user.id + '.pdf'), buf);
    user.resume = {
        name: String(b.name || 'resume.pdf').replace(/[^\w.\- ]/g, '').slice(0, 80), size: buf.length, at: new Date().toISOString()
    };
    save();
    return user.resume;
});
R('DELETE', '/api/resume', ['user'], ({ user }) => {
    try {
        fs.unlinkSync(path.join(UP, user.id + '.pdf'));
    } catch { }
    delete user.resume;
    save();
    return { ok: 1 };
});
R('GET', '/api/resume/file', ['user'], ({ user }) => {
    if (!user.resume) {
        bad(404, 'No resume uploaded');
    }
    return { mime: 'application/pdf', data: fs.readFileSync(path.join(UP, user.id + '.pdf')).toString('base64') };
});
// Profile photo: the browser shrinks it to ~256px; stored as a small data URL.
R('POST', '/api/photo', ['user'], ({ user, body: b }) => {
    const d = String(b.data || '');
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d) || d.length > 400000) {
        bad(400, 'Upload a JPG, PNG or WebP photo');
    }
    user.photo = d;
    save();
    return { photo: d };
});
R('DELETE', '/api/photo', ['user'], ({ user }) => {
    delete user.photo;
    save();
    return { ok: 1 };
});
