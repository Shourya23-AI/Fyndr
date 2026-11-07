// The free gate in front of the AI. A question that is clearly not about careers, learning or Fyndr is answered here, at once,
// with a fixed message: the AI is never called, so no tokens or daily requests are spent on it.
// It errs on the side of letting real career questions through: when unsure, the question goes on to the AI (whose own rules also refuse off-topic).
const ON_TOPIC = /\b(jobs?|careers?|interns?|internships?|intern|fresher|freshers|hiring|hire|hired|recruit\w*|vacanc\w*|openings?|roles?|positions?|work|working|employ\w*|salary|salaries|stipend|pay|ctc|lpa|resumes?|cv|cover letters?|portfolio|interview\w*|aptitude|applications?|apply|applying|applied|offer letter|placements?|campus|skills?|skilled|learn\w*|study|studying|courses?|certificat\w*|degree|diploma|bca|mca|btech|b\.tech|mtech|bsc|msc|bcom|mba|engineering|graduat\w*|college|university|syllabus|roadmap|plan|path|projects?|github|linkedin|naukri|upskill\w*|reskill\w*|switch|transition|promotion|manager|developer|engineer|analyst|designer|tester|qa|devops|accountant|teacher|nurse|marketing|sales|finance|hr|data|python|java|javascript|sql|excel|power ?bi|tableau|react|node|html|css|cloud|aws|azure|ai|ml|machine learning|cyber\w*|fyndr|guide|profile|listing|post|organi[sz]ation|verified|scam|fake|remote|wfh|shift|notice period|fresh graduate|gap year|backlog|cgpa|percentage|reference|mentor\w*|networking|negotiat\w*)\b/i;
const INJECTION = /\b(ignore|forget|disregard|override|bypass)\b.{0,40}\b(rules?|instructions?|prompt|guidelines?|restrictions?)\b|\b(system|developer|hidden) (prompt|message|instructions?)\b|\bjailbreak\b|\b(dan|developer) mode\b|\bpretend (to be|you are|you're)\b|\bact as (a|an|if)\b|\breveal your (prompt|rules|instructions)\b/i;
// Things that are never about careers. Only used inside the guide, where a plain question about "my plan" is allowed through.
const HARD_OFF = /\b(poem|poetry|song|lyrics|joke|riddle|story|recipe|cook\w*|weather|horoscope|zodiac|movie|film|series|anime|cricket|football|ipl|score|match|bitcoin|crypto|stock|lottery|dating|girlfriend|boyfriend|capital of|president|prime minister|translate|homework|essay)\b/i;
// Asking for creative writing is off-topic even when it mentions a job.
const CREATIVE = /\b(write|compose|make|create|generate|tell|sing)\b.{0,25}\b(poem|poetry|song|lyrics|story|joke|riddle|rap)\b/i;
const FOLLOW_UP = /^(why|how|what|which|when|where|who|and|so|ok|okay|yes|no|thanks|thank you|more|explain|elaborate|example|examples|tell me more|go on|continue|can you|could you|please)\b/i;

const OFF = 'I can only help with careers and learning on Fyndr: finding jobs, internships and courses, choosing skills, resumes and interviews. Ask me about any of those and I will help.';
const BLOCKED = 'I cannot change my rules or share my instructions. I am here to help with jobs, internships, courses, skills and resumes on Fyndr. What would you like to work on?';

// -> null when the question may go to the AI, otherwise the fixed reply to send back.
function gate(question, { hasGuide = false, hasHistory = false, known = false } = {}) {
    const q = String(question || '').trim();
    if (q.length < 2) {
        return OFF;
    }
    if (INJECTION.test(q)) {
        return BLOCKED;
    }
    if (CREATIVE.test(q)) {
        return OFF;
    }
    if (ON_TOPIC.test(q) || known) {
        return null;
    }
    // a short reply inside a running conversation ("why?", "can you give an example") continues the earlier on-topic answer
    if (hasHistory && q.split(/\s+/).length <= 8 && FOLLOW_UP.test(q)) {
        return null;
    }
    // inside the guide a plain question ("what should I build first?") is about the plan on screen, unless it is clearly about something else
    if (hasGuide && q.split(/\s+/).length <= 14 && !HARD_OFF.test(q)) {
        return null;
    }
    return OFF;
}
module.exports = { gate, OFF, BLOCKED };
