// Career guide data: what each dream job usually asks for. No logic in here, so it is safe to edit.
//
// must  = core skills a fresher is expected to show (listed in the order worth learning them: foundations first).
// nice  = skills that make an application stronger but are rarely required.
// Every entry is a skill key from suggestions/taxonomy.js (the test checks this), or any(label, key, key, ...):
// "any one of these is enough" (for example one programming language, or Power BI or Tableau).
// minQual: the usual minimum qualification, on the same scale as the profile (1 = 12th grade, 2 = Diploma, 3 = Bachelor's, 4 = Master's, 5 = PhD).
// aka: other ways people write the job. Add a row to teach the guide a new job.
export const any = (label, ...keys) => ({ any: keys, label });

const LANG = any('One main programming language (Python, Java, C++ or similar)', 'python', 'java', 'cpp', 'csharp', 'javascript', 'go');
const WEB_LANG = any('One back-end language or framework (Node.js, Python, Java or similar)', 'node.js', 'python', 'java', 'csharp', 'php', 'go', 'django', 'spring boot');
const FRONT = any('One front-end framework (React, Angular or Vue)', 'react', 'angular', 'vue', 'next.js');
const CLOUD = any('One cloud platform (AWS, Azure or Google Cloud)', 'aws', 'azure', 'gcp');
const BI = any('One BI tool (Power BI or Tableau)', 'power bi', 'tableau', 'data visualization');
const MOBILE = any('One mobile platform (Android, iOS or Flutter)', 'android', 'ios', 'flutter', 'react native');
const DB = any('A database (SQL or MongoDB)', 'sql', 'mongodb', 'mysql', 'postgresql');

export const ROLES = [
    // ---------- software and IT ----------
    {
        id: 'software-developer', title: 'Software Developer', domain: 'tech', minQual: 3,
        aka: ['software engineer', 'sde', 'swe', 'programmer', 'coder', 'application developer', 'software development engineer', 'software engineering'],
        summary: 'You design, write and test the programs behind apps and websites. Most fresher roles test data structures, one language and problem solving.',
        qualNote: 'Most openings ask for a Bachelor\u2019s in CS, IT or a similar branch, though a strong project portfolio is accepted at many startups.',
        must: [LANG, 'dsa', 'oop', 'git', 'sql'], nice: ['rest api', 'linux', 'software testing', 'docker']
    },
    {
        id: 'frontend-developer', title: 'Front-end Developer', domain: 'tech', minQual: 2,
        aka: ['frontend developer', 'front end developer', 'front-end engineer', 'react developer', 'ui developer', 'javascript developer', 'web designer'],
        summary: 'You build everything people see and click in a website or web app, and make it work well on phones and laptops.',
        qualNote: 'Portfolios matter more than degrees here. A diploma or Bachelor\u2019s helps, but live projects open the door.',
        must: ['html', 'css', 'javascript', 'git', FRONT], nice: ['typescript', 'rest api', 'figma', 'ui/ux', 'software testing']
    },
    {
        id: 'backend-developer', title: 'Back-end Developer', domain: 'tech', minQual: 3,
        aka: ['backend developer', 'back end developer', 'backend engineer', 'server side developer', 'api developer', 'java developer', 'python developer', 'node developer'],
        summary: 'You build the servers, databases and APIs that sit behind apps: login, payments, data and everything users never see.',
        qualNote: 'Most openings ask for a Bachelor\u2019s in CS, IT or a similar branch.',
        must: [WEB_LANG, 'sql', 'rest api', 'git', 'dsa'], nice: ['docker', 'redis', 'aws', 'linux', 'ci/cd', 'mongodb']
    },
    {
        id: 'fullstack-developer', title: 'Full-stack Developer', domain: 'tech', minQual: 3,
        aka: ['full stack developer', 'fullstack developer', 'full stack engineer', 'web developer', 'mern developer', 'mean developer', 'web development'],
        summary: 'You work on both sides of a web product: the screens people use and the server and database behind them.',
        qualNote: 'A Bachelor\u2019s is common, but working projects count heavily.',
        must: ['html', 'css', 'javascript', FRONT, WEB_LANG, DB, 'git', 'rest api'], nice: ['typescript', 'docker', 'aws', 'software testing']
    },
    {
        id: 'mobile-developer', title: 'Mobile App Developer', domain: 'tech', minQual: 2,
        aka: ['android developer', 'ios developer', 'flutter developer', 'app developer', 'mobile developer', 'react native developer', 'mobile app development'],
        summary: 'You build apps for phones and tablets, and publish them to the Play Store or App Store.',
        qualNote: 'A diploma or Bachelor\u2019s helps; published apps count for a lot.',
        must: [MOBILE, 'oop', 'git', 'rest api'], nice: ['kotlin', 'swift', 'dart', 'firebase', 'ui/ux', 'software testing']
    },
    {
        id: 'devops-engineer', title: 'DevOps / Cloud Engineer', domain: 'tech', minQual: 3,
        aka: ['devops', 'cloud engineer', 'site reliability engineer', 'sre', 'cloud architect', 'platform engineer', 'aws engineer', 'system administrator', 'sysadmin'],
        summary: 'You keep software running: you automate releases, manage servers in the cloud and fix things before users notice.',
        qualNote: 'Most openings ask for a Bachelor\u2019s in CS, IT or similar, often with a cloud certificate.',
        must: ['linux', 'git', 'bash', 'docker', 'ci/cd', CLOUD], nice: ['kubernetes', 'terraform', 'networking', 'python']
    },
    {
        id: 'qa-engineer', title: 'QA / Software Tester', domain: 'tech', minQual: 2,
        aka: ['tester', 'qa engineer', 'quality assurance', 'software tester', 'test engineer', 'automation tester', 'sdet', 'manual tester', 'testing'],
        summary: 'You find bugs before users do, by testing software by hand and by writing scripts that test it automatically.',
        qualNote: 'A diploma or Bachelor\u2019s is usual; testing certificates (such as ISTQB) are a plus.',
        must: ['software testing', 'sql', 'rest api', 'git'], nice: ['python', 'java', 'javascript', 'ci/cd', 'linux']
    },
    {
        id: 'cybersecurity-analyst', title: 'Cybersecurity Analyst', domain: 'tech', minQual: 3,
        aka: ['cyber security', 'security analyst', 'ethical hacker', 'penetration tester', 'information security', 'infosec', 'soc analyst', 'security engineer'],
        summary: 'You protect systems and data: you watch for attacks, test for weak spots and help fix them.',
        qualNote: 'A Bachelor\u2019s in CS or IT is usual; certificates such as CEH or Security+ are valued.',
        must: ['networking', 'linux', 'cybersecurity', 'bash'], nice: ['python', 'aws', 'sql', 'docker']
    },
    {
        id: 'embedded-engineer', title: 'Embedded Systems Engineer', domain: 'engineering', minQual: 3,
        aka: ['embedded engineer', 'embedded developer', 'iot engineer', 'firmware engineer', 'firmware developer', 'embedded systems', 'robotics engineer', 'iot developer'],
        summary: 'You write the software that runs inside devices such as sensors, vehicles, wearables and appliances.',
        qualNote: 'Usually a Bachelor\u2019s in electronics, electrical or computer engineering.',
        must: ['c', 'circuit design', 'embedded', 'cpp'], nice: ['python', 'matlab', 'linux', 'plc']
    },
    // ---------- data and AI ----------
    {
        id: 'data-analyst', title: 'Data Analyst', domain: 'data', minQual: 3,
        aka: ['business intelligence analyst', 'bi analyst', 'bi developer', 'data analytics', 'analytics', 'reporting analyst', 'data analysis', 'power bi developer', 'insights analyst'],
        summary: 'You turn raw data into answers: you clean it, find patterns and present them in dashboards and reports that teams act on.',
        qualNote: 'A Bachelor\u2019s in any numbers-friendly field (CS, maths, stats, commerce, engineering) is the usual minimum.',
        must: ['excel', 'sql', 'data analysis', 'statistics', BI], nice: ['python', 'pandas', 'powerpoint', 'google analytics', 'etl']
    },
    {
        id: 'data-scientist', title: 'Data Scientist', domain: 'data', minQual: 3,
        aka: ['data science', 'ai specialist', 'applied scientist', 'research scientist', 'ds'],
        summary: 'You use statistics and machine learning to predict things and answer hard questions from data.',
        qualNote: 'A Bachelor\u2019s can get you in, but a Master\u2019s in a quantitative field is common and helps a lot for this role.',
        must: ['python', 'statistics', 'sql', 'pandas', 'data visualization', 'machine learning'], nice: ['deep learning', 'nlp', 'big data', 'git', 'r']
    },
    {
        id: 'ml-engineer', title: 'Machine Learning Engineer', domain: 'data', minQual: 3,
        aka: ['ml engineer', 'ai engineer', 'artificial intelligence engineer', 'machine learning', 'deep learning engineer', 'computer vision engineer', 'ai developer'],
        summary: 'You build and ship machine learning models into real products, so they work reliably at scale.',
        qualNote: 'Usually a Bachelor\u2019s or Master\u2019s in CS, AI or a related field.',
        must: ['python', 'dsa', 'pandas', 'machine learning', 'deep learning', 'git'], nice: ['nlp', 'computer vision', 'sql', 'docker', 'aws', 'ci/cd']
    },
    {
        id: 'nlp-engineer', title: 'NLP Engineer', domain: 'data', minQual: 3,
        aka: ['nlp engineer', 'nlp', 'natural language processing', 'natural language processing engineer', 'nlp developer', 'nlp scientist', 'nlp researcher', 'language model engineer', 'llm engineer', 'generative ai engineer', 'conversational ai engineer', 'chatbot developer', 'text mining engineer', 'computational linguist'],
        summary: 'You build systems that understand and write human language: chatbots, search, summarisers and large language model apps.',
        qualNote: 'Usually a Bachelor\u2019s or Master\u2019s in CS, AI or linguistics-related fields; strong projects count a lot.',
        must: ['python', 'machine learning', 'nlp', 'deep learning', 'pandas', 'git'], nice: ['statistics', 'sql', 'docker', 'aws', 'rest api']
    },
    {
        id: 'data-engineer', title: 'Data Engineer', domain: 'data', minQual: 3,
        aka: ['big data engineer', 'etl developer', 'data pipeline engineer', 'data engineering', 'analytics engineer', 'spark developer'],
        summary: 'You build the pipelines that collect, clean and move data so analysts and models can use it.',
        qualNote: 'A Bachelor\u2019s in CS, IT or similar is usual.',
        must: ['sql', 'python', 'git', 'etl', 'big data'], nice: [CLOUD, 'docker', 'linux', 'nosql', 'ci/cd']
    },
    // ---------- design and media ----------
    {
        id: 'ux-designer', title: 'UI/UX Designer', domain: 'design', minQual: 2,
        aka: ['ui ux designer', 'ux designer', 'ui designer', 'product designer', 'user experience designer', 'interaction designer', 'ux researcher', 'web ui designer', 'ux design'],
        summary: 'You design how apps and websites look and feel, from research and sketches to clickable prototypes developers can build.',
        qualNote: 'Portfolios matter far more than degrees. Case studies of real or practice projects are what recruiters read.',
        must: ['graphic design', 'ui/ux', 'figma'], nice: ['photoshop', 'illustrator', 'html', 'css', 'animation', 'market research']
    },
    {
        id: 'graphic-designer', title: 'Graphic Designer', domain: 'design', minQual: 1,
        aka: ['graphic design', 'visual designer', 'creative designer', 'brand designer', 'logo designer', 'poster designer', 'illustrator artist', 'designer'],
        summary: 'You create visuals such as logos, posters, social posts and brand material that communicate an idea at a glance.',
        qualNote: 'A strong portfolio matters most; a design diploma or degree helps but is not always required.',
        must: ['graphic design', 'photoshop', 'illustrator'], nice: ['figma', 'video editing', 'animation', 'photography']
    },
    {
        id: 'video-editor', title: 'Video Editor', domain: 'design', minQual: 1,
        aka: ['video editing', 'video producer', 'motion graphics designer', 'motion designer', 'youtube editor', 'film editor', 'reels editor', 'animator', '3d artist'],
        summary: 'You cut raw footage into finished videos with sound, titles, effects and a clear story.',
        qualNote: 'A showreel of your edits matters more than any degree.',
        must: ['video editing', any('Motion or animation skills', 'animation', '3d')], nice: ['photoshop', 'photography', 'graphic design']
    },
    // ---------- marketing and writing ----------
    {
        id: 'digital-marketer', title: 'Digital Marketer', domain: 'marketing', minQual: 3,
        aka: ['digital marketing', 'marketing executive', 'performance marketer', 'online marketing', 'growth marketer', 'marketing', 'marketing associate', 'ppc specialist'],
        summary: 'You get a brand found and chosen online through search, social media, ads, email and content, and you measure what works.',
        qualNote: 'A Bachelor\u2019s (often BBA, BCom or any stream) is usual, and Google or Meta certificates help.',
        must: ['digital marketing', 'seo', 'social media', 'content marketing', 'google analytics'], nice: ['paid ads', 'email marketing', 'copywriting', 'market research']
    },
    {
        id: 'seo-specialist', title: 'SEO Specialist', domain: 'marketing', minQual: 2,
        aka: ['seo executive', 'seo analyst', 'search engine optimization', 'seo', 'seo manager'],
        summary: 'You help websites rank higher on Google by fixing technical issues, improving content and earning links.',
        qualNote: 'Skills and results matter more than the degree.',
        must: ['seo', 'google analytics', 'content marketing'], nice: ['digital marketing', 'html', 'copywriting', 'market research']
    },
    {
        id: 'social-media-manager', title: 'Social Media Manager', domain: 'marketing', minQual: 2,
        aka: ['social media executive', 'social media marketer', 'community manager', 'social media', 'instagram manager', 'content creator'],
        summary: 'You plan and post content for a brand, grow its community and report what is working.',
        qualNote: 'A diploma or any Bachelor\u2019s is fine; a live page you have grown is the best proof.',
        must: ['social media', 'content marketing', 'copywriting'], nice: ['graphic design', 'video editing', 'paid ads', 'google analytics']
    },
    {
        id: 'content-writer', title: 'Content Writer', domain: 'writing', minQual: 2,
        aka: ['content writing', 'blog writer', 'copywriter', 'article writer', 'content creator writer', 'copy writer', 'writer', 'freelance writer', 'journalist'],
        summary: 'You write articles, web pages, scripts and ads that inform or persuade, in the voice a brand needs.',
        qualNote: 'Samples matter most. Any degree works, and English, journalism or mass communication helps.',
        must: ['content writing', 'editing', 'seo'], nice: ['copywriting', 'social media', 'journalism', 'technical writing']
    },
    {
        id: 'technical-writer', title: 'Technical Writer', domain: 'writing', minQual: 3,
        aka: ['technical writing', 'documentation writer', 'documentation engineer', 'api documentation writer', 'tech writer'],
        summary: 'You explain complex products clearly: manuals, help articles and developer documentation.',
        qualNote: 'A Bachelor\u2019s is usual; a technical background helps for software documentation.',
        must: ['technical writing', 'editing', 'git'], nice: ['html', 'rest api', 'ui/ux', 'software testing']
    },
    // ---------- business and sales ----------
    {
        id: 'sales-executive', title: 'Sales / Business Development Executive', domain: 'business', minQual: 2,
        aka: ['sales executive', 'business development executive', 'bde', 'sales associate', 'inside sales', 'sales representative', 'sales', 'business development', 'telesales'],
        summary: 'You find customers, understand what they need and close deals, usually with targets you track in a CRM.',
        qualNote: 'Many companies hire 12th pass and graduates alike; attitude and communication matter most.',
        must: ['sales', 'crm', 'negotiation'], nice: ['market research', 'ms office', 'excel', 'customer support']
    },
    {
        id: 'hr-recruiter', title: 'HR / Recruiter', domain: 'business', minQual: 3,
        aka: ['hr executive', 'hr associate', 'recruiter', 'talent acquisition', 'human resources', 'hr', 'hr generalist', 'recruitment executive', 'hr manager'],
        summary: 'You find and hire people, then look after onboarding, payroll and a good place to work.',
        qualNote: 'A Bachelor\u2019s is usual, often followed by an MBA or PG diploma in HR.',
        must: ['human resources', 'ms office', 'excel'], nice: ['negotiation', 'market research', 'powerpoint']
    },
    {
        id: 'project-manager', title: 'Project Manager', domain: 'business', minQual: 3,
        aka: ['project coordinator', 'project management', 'program manager', 'scrum master', 'delivery manager', 'project lead', 'pmo analyst'],
        summary: 'You plan the work, keep the team and timelines on track and tell stakeholders where things stand.',
        qualNote: 'A Bachelor\u2019s is usual; PMP or Scrum certificates help once you have some experience.',
        must: ['project management', 'business analysis', 'powerpoint', 'excel'], nice: ['operations', 'product management', 'sql']
    },
    {
        id: 'product-manager', title: 'Product Manager', domain: 'business', minQual: 3,
        aka: ['product management', 'associate product manager', 'apm', 'product owner', 'product analyst'],
        summary: 'You decide what a product should do next, based on users, data and business goals, and guide the team that builds it.',
        qualNote: 'A Bachelor\u2019s is usual, and many freshers enter through an APM program or an MBA.',
        must: ['product management', 'market research', 'data analysis', 'business analysis'], nice: ['sql', 'ui/ux', 'project management', 'powerpoint', 'google analytics']
    },
    {
        id: 'business-analyst', title: 'Business Analyst', domain: 'business', minQual: 3,
        aka: ['business analysis', 'ba', 'functional analyst', 'process analyst', 'management trainee', 'systems analyst'],
        summary: 'You study how a business works, find where it can improve and turn that into clear requirements and recommendations.',
        qualNote: 'A Bachelor\u2019s is usual, with an MBA common for senior roles.',
        must: ['business analysis', 'excel', 'sql', 'powerpoint'], nice: ['power bi', 'tableau', 'data analysis', 'project management']
    },
    {
        id: 'operations-executive', title: 'Operations Executive', domain: 'business', minQual: 3,
        aka: ['operations', 'operations associate', 'operations manager', 'supply chain executive', 'logistics executive', 'supply chain', 'logistics', 'procurement executive'],
        summary: 'You keep the day-to-day running: orders, vendors, stock, deliveries and the numbers behind them.',
        qualNote: 'A Bachelor\u2019s is usual; supply chain or logistics diplomas help.',
        must: ['operations', 'excel', 'ms office'], nice: ['sap', 'project management', 'data analysis', 'customer support']
    },
    {
        id: 'customer-support', title: 'Customer Support Executive', domain: 'business', minQual: 1,
        aka: ['customer service', 'customer care executive', 'customer success', 'support executive', 'bpo executive', 'call center executive', 'voice process', 'chat support', 'helpdesk'],
        summary: 'You help customers over calls, chat and email, solve their problems and keep them happy.',
        qualNote: 'Many openings accept 12th pass, and graduates move up faster.',
        must: ['customer support', 'crm', 'ms office'], nice: ['sales', 'excel']
    },
    // ---------- finance ----------
    {
        id: 'accountant', title: 'Accountant', domain: 'finance', minQual: 3,
        aka: ['accounting', 'accounts executive', 'accounts assistant', 'bookkeeper', 'accounts manager', 'tally operator', 'ca', 'chartered accountant', 'accounts'],
        summary: 'You record and check a company\u2019s money: bills, payments, ledgers, tax filings and monthly books.',
        qualNote: 'A BCom or similar is the usual start; CA, CMA or CS lead to senior roles.',
        must: ['accounting', 'tally', 'gst', 'excel'], nice: ['quickbooks', 'sap', 'financial analysis', 'auditing']
    },
    {
        id: 'financial-analyst', title: 'Financial Analyst', domain: 'finance', minQual: 3,
        aka: ['finance analyst', 'equity research analyst', 'investment analyst', 'fp&a analyst', 'finance executive', 'financial analysis', 'finance', 'credit analyst', 'investment banker'],
        summary: 'You study numbers to guide money decisions: budgets, forecasts, valuations and investment cases.',
        qualNote: 'A Bachelor\u2019s in finance, commerce, economics or engineering, often with an MBA, CFA or CA.',
        must: ['accounting', 'excel', 'financial analysis', 'powerpoint'], nice: ['sql', 'power bi', 'python', 'statistics', 'banking']
    },
    {
        id: 'auditor', title: 'Auditor', domain: 'finance', minQual: 3,
        aka: ['audit associate', 'internal auditor', 'audit executive', 'auditing', 'statutory auditor', 'compliance analyst', 'risk analyst'],
        summary: 'You check that a company\u2019s accounts and processes are accurate and follow the rules.',
        qualNote: 'A BCom or similar is usual; CA, CMA or an audit certificate lead to senior roles.',
        must: ['accounting', 'auditing', 'excel', 'gst'], nice: ['tally', 'sap', 'financial analysis']
    },
    {
        id: 'banking-officer', title: 'Banking Officer', domain: 'finance', minQual: 3,
        aka: ['bank clerk', 'bank po', 'probationary officer', 'banking', 'relationship manager', 'bank officer', 'bank job', 'insurance advisor', 'wealth manager'],
        summary: 'You look after customers\u2019 accounts, loans and services in a bank, and help them choose the right products.',
        qualNote: 'Any Bachelor\u2019s plus a bank exam such as IBPS or SBI PO for public sector roles.',
        must: ['banking', 'accounting', 'ms office'], nice: ['financial analysis', 'sales', 'customer support', 'excel']
    },
    // ---------- core engineering ----------
    {
        id: 'mechanical-engineer', title: 'Mechanical Design Engineer', domain: 'engineering', minQual: 3,
        aka: ['mechanical engineer', 'design engineer', 'cad engineer', 'production engineer', 'manufacturing engineer', 'automobile engineer', 'mechanical design', 'quality engineer'],
        summary: 'You design and improve machines and parts, from 3D models to drawings and manufacturing.',
        qualNote: 'A diploma or BE/BTech in mechanical or related branches.',
        must: ['cad', 'manufacturing'], nice: ['matlab', 'project management', 'plc', 'excel']
    },
    {
        id: 'civil-engineer', title: 'Civil / Site Engineer', domain: 'engineering', minQual: 3,
        aka: ['civil engineer', 'site engineer', 'structural engineer', 'construction engineer', 'quantity surveyor', 'civil design', 'construction manager'],
        summary: 'You plan, design and oversee buildings, roads and structures, on paper and on site.',
        qualNote: 'A diploma or BE/BTech in civil engineering.',
        must: ['civil design', 'cad', 'project management'], nice: ['excel', 'ms office', 'matlab']
    },
    {
        id: 'electronics-engineer', title: 'Electronics / VLSI Engineer', domain: 'engineering', minQual: 3,
        aka: ['vlsi engineer', 'electronics engineer', 'electrical engineer', 'pcb designer', 'hardware engineer', 'circuit designer', 'vlsi design', 'chip design', 'hardware design engineer'],
        summary: 'You design the circuits and chips inside electronic products.',
        qualNote: 'Usually a BE/BTech in electronics or electrical, and often an M.Tech for chip design.',
        must: ['circuit design', 'matlab', 'c'], nice: ['embedded', 'python', 'linux', 'plc']
    },
    {
        id: 'automation-engineer', title: 'Automation / PLC Engineer', domain: 'engineering', minQual: 2,
        aka: ['plc engineer', 'plc programmer', 'scada engineer', 'industrial automation', 'automation engineer', 'instrumentation engineer', 'control engineer'],
        summary: 'You program and maintain the control systems that run factories and plants.',
        qualNote: 'A diploma or BE/BTech in electrical, electronics or instrumentation.',
        must: ['plc', 'circuit design'], nice: ['matlab', 'cad', 'python', 'manufacturing']
    },
    // ---------- teaching ----------
    {
        id: 'teacher', title: 'Teacher / Trainer', domain: 'education', minQual: 3,
        aka: ['teaching', 'school teacher', 'lecturer', 'tutor', 'trainer', 'professor', 'instructor', 'faculty', 'online tutor', 'educator'],
        summary: 'You help people learn: you plan lessons, explain ideas clearly and track how students are doing.',
        qualNote: 'School teaching also needs a B.Ed and often TET or CTET; college teaching needs a Master\u2019s plus NET or a PhD.',
        must: ['teaching', 'powerpoint', 'ms office'], nice: ['editing', 'content writing', 'video editing']
    }
];

// The areas shown when someone is not sure: [domain key, label].
export const AREAS = [
    ['tech', 'Software & IT'], ['data', 'Data & AI'], ['design', 'Design & media'], ['marketing', 'Marketing'], ['writing', 'Writing'],
    ['business', 'Business & sales'], ['finance', 'Finance'], ['engineering', 'Core engineering'], ['education', 'Teaching']
];

// Dream jobs shown as one-tap examples.
export const EXAMPLES = ['Software developer', 'Data analyst', 'UI/UX designer', 'Digital marketer', 'Accountant'];

export const roleById = id => ROLES.find(r => r.id === id) || null;
export const rolesIn = domain => ROLES.filter(r => r.domain === domain);
// An item is either a skill key or any(): -> { keys: [...], label? }
export const itemKeys = x => (typeof x === 'string' ? [x] : x.any);
