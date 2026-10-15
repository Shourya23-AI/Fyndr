// Data used by the suggestions engine (engine.js). No logic in here, so it is safe to edit.
//
// SKILLS: [key, label shown to people, category, other ways the skill is written].
// The key itself is always recognised too. Add a row to teach Fyndr a new skill; the tests check for clashes.
// Aliases are matched as whole words/phrases (so "java" never matches "javascript"), after lower-casing.
export const SKILLS = [
    // programming languages
    ['javascript', 'JavaScript', 'tech', ['js', 'ecmascript', 'es6']],
    ['typescript', 'TypeScript', 'tech', ['ts']],
    ['python', 'Python', 'tech', ['python3', 'py']],
    ['java', 'Java', 'tech', ['core java', 'java se', 'java ee', 'j2ee']],
    ['c', 'C', 'tech', ['c programming', 'c language', 'embedded c', 'c c++']],
    ['cpp', 'C++', 'tech', ['c++', 'cplusplus']],
    ['csharp', 'C#', 'tech', ['c#']],
    ['go', 'Go', 'tech', ['golang']],
    ['rust', 'Rust', 'tech', []],
    ['php', 'PHP', 'tech', ['laravel', 'codeigniter']],
    ['ruby', 'Ruby', 'tech', ['ruby on rails']],
    ['kotlin', 'Kotlin', 'tech', []],
    ['swift', 'Swift', 'tech', ['swiftui']],
    ['dart', 'Dart', 'tech', []],
    ['scala', 'Scala', 'tech', []],
    ['r', 'R', 'data', ['r programming', 'r language', 'rstudio']],
    ['bash', 'Shell scripting', 'tech', ['shell scripting', 'shell script', 'bash scripting']],
    // web and apps
    ['html', 'HTML', 'tech', ['html5']],
    ['css', 'CSS', 'tech', ['css3', 'scss', 'sass', 'tailwind', 'tailwind css', 'bootstrap']],
    ['react', 'React', 'tech', ['reactjs', 'react.js', 'react js']],
    ['react native', 'React Native', 'tech', ['reactnative']],
    ['angular', 'Angular', 'tech', ['angularjs']],
    ['vue', 'Vue', 'tech', ['vuejs', 'vue.js', 'vue js']],
    ['next.js', 'Next.js', 'tech', ['nextjs', 'next js']],
    ['node.js', 'Node.js', 'tech', ['node', 'nodejs', 'node js']],
    ['express.js', 'Express.js', 'tech', ['expressjs', 'express js']],
    ['django', 'Django', 'tech', []],
    ['flask', 'Flask', 'tech', []],
    ['fastapi', 'FastAPI', 'tech', ['fast api']],
    ['spring boot', 'Spring Boot', 'tech', ['springboot', 'spring framework']],
    ['dotnet', '.NET', 'tech', ['asp dotnet', 'asp net', 'net core', 'dotnet core']],
    ['rest api', 'REST APIs', 'tech', ['restful', 'rest api', 'restful api', 'web api', 'api development', 'api']],
    ['graphql', 'GraphQL', 'tech', []],
    ['android', 'Android', 'tech', ['android development', 'android studio']],
    ['ios', 'iOS', 'tech', ['ios development']],
    ['flutter', 'Flutter', 'tech', []],
    // data stores, cloud, tooling
    ['sql', 'SQL', 'data', ['t sql', 'pl sql', 'plsql', 'tsql', 'structured query language']],
    ['mysql', 'MySQL', 'data', []],
    ['postgresql', 'PostgreSQL', 'data', ['postgres', 'psql']],
    ['mongodb', 'MongoDB', 'data', ['mongo']],
    ['redis', 'Redis', 'tech', []],
    ['nosql', 'NoSQL', 'data', []],
    ['firebase', 'Firebase', 'tech', ['firestore']],
    ['git', 'Git', 'tech', ['github', 'gitlab', 'version control']],
    ['docker', 'Docker', 'tech', ['containerization', 'containerisation']],
    ['kubernetes', 'Kubernetes', 'tech', ['k8s']],
    ['aws', 'AWS', 'tech', ['amazon web services', 'ec2']],
    ['azure', 'Azure', 'tech', ['microsoft azure']],
    ['gcp', 'Google Cloud', 'tech', ['google cloud', 'google cloud platform']],
    ['linux', 'Linux', 'tech', ['unix', 'ubuntu']],
    ['ci/cd', 'CI/CD', 'tech', ['ci cd', 'cicd', 'jenkins', 'github actions', 'continuous integration']],
    ['terraform', 'Terraform', 'tech', ['infrastructure as code']],
    ['devops', 'DevOps', 'tech', []],
    ['software testing', 'Software testing', 'tech', ['qa', 'quality assurance', 'manual testing', 'test automation', 'automation testing', 'selenium', 'unit testing', 'jest', 'cypress']],
    ['dsa', 'Data structures & algorithms', 'tech', ['algorithms', 'data structures', 'data structures and algorithms']],
    ['oop', 'Object-oriented programming', 'tech', ['object oriented programming', 'object oriented', 'oops']],
    ['cybersecurity', 'Cybersecurity', 'tech', ['cyber security', 'information security', 'infosec', 'penetration testing', 'network security', 'ethical hacking']],
    ['networking', 'Networking', 'tech', ['computer networks', 'computer networking', 'ccna', 'tcp ip']],
    ['embedded', 'Embedded systems', 'engineering', ['embedded systems', 'arduino', 'raspberry pi', 'microcontrollers', 'microcontroller', 'iot', 'internet of things']],
    // data and AI
    ['machine learning', 'Machine learning', 'data', ['ml', 'scikit learn', 'sklearn', 'supervised learning']],
    ['deep learning', 'Deep learning', 'data', ['neural networks', 'neural network', 'tensorflow', 'pytorch', 'keras']],
    ['nlp', 'NLP', 'data', ['natural language processing', 'llm', 'large language models', 'generative ai']],
    ['computer vision', 'Computer vision', 'data', ['opencv', 'image processing']],
    ['data analysis', 'Data analysis', 'data', ['data analytics', 'data analyst', 'analytics', 'exploratory data analysis', 'eda', 'statistical analysis']],
    ['pandas', 'Pandas / NumPy', 'data', ['numpy', 'data wrangling']],
    ['statistics', 'Statistics', 'data', ['statistical modeling', 'statistical modelling', 'hypothesis testing', 'probability']],
    ['excel', 'Excel', 'data', ['ms excel', 'microsoft excel', 'advanced excel', 'spreadsheet', 'google sheets', 'vlookup', 'pivot table']],
    ['power bi', 'Power BI', 'data', ['powerbi', 'microsoft power bi']],
    ['tableau', 'Tableau', 'data', []],
    ['data visualization', 'Data visualization', 'data', ['data visualisation', 'looker', 'looker studio', 'data studio', 'visualization']],
    ['etl', 'Data pipelines', 'data', ['data pipeline', 'data engineering', 'airflow', 'dbt']],
    ['big data', 'Big data', 'data', ['hadoop', 'spark', 'pyspark', 'apache spark']],
    ['sas', 'SAS / SPSS', 'data', ['spss']],
    // design and media
    ['figma', 'Figma', 'design', []],
    ['ui/ux', 'UI/UX design', 'design', ['ui ux', 'ui ux design', 'ui design', 'ux design', 'ux', 'user experience', 'user interface', 'wireframing', 'wireframe', 'prototyping', 'user research']],
    ['photoshop', 'Photoshop', 'design', ['adobe photoshop']],
    ['illustrator', 'Illustrator', 'design', ['adobe illustrator']],
    ['graphic design', 'Graphic design', 'design', ['graphics design', 'visual design', 'logo design', 'canva', 'coreldraw', 'indesign', 'adobe indesign']],
    ['video editing', 'Video editing', 'design', ['premiere pro', 'adobe premiere', 'after effects', 'final cut', 'davinci resolve', 'video production', 'motion graphics']],
    ['photography', 'Photography', 'design', ['photo editing', 'lightroom']],
    ['3d', '3D modelling', 'design', ['3d modeling', '3d modelling', '3d design', 'blender', '3ds max', 'autodesk maya', '3d animation']],
    ['animation', 'Animation', 'design', ['2d animation']],
    // marketing and writing
    ['seo', 'SEO', 'marketing', ['search engine optimization', 'search engine optimisation', 'on page seo', 'off page seo', 'keyword research']],
    ['digital marketing', 'Digital marketing', 'marketing', ['online marketing', 'performance marketing', 'digital media marketing']],
    ['paid ads', 'Paid advertising', 'marketing', ['ppc', 'google ads', 'facebook ads', 'meta ads', 'paid media', 'adwords']],
    ['social media', 'Social media', 'marketing', ['smm', 'social media marketing', 'social media management', 'community management']],
    ['content marketing', 'Content marketing', 'marketing', ['content strategy', 'content creation']],
    ['email marketing', 'Email marketing', 'marketing', ['mailchimp', 'email campaign', 'newsletter']],
    ['google analytics', 'Google Analytics', 'marketing', ['ga4', 'web analytics', 'google tag manager', 'gtm']],
    ['market research', 'Market research', 'marketing', ['competitor analysis', 'market analysis', 'survey design']],
    ['public relations', 'Public relations', 'marketing', ['press release', 'media relations']],
    ['copywriting', 'Copywriting', 'writing', ['copy writing', 'copywriter', 'ad copy']],
    ['content writing', 'Content writing', 'writing', ['content writer', 'article writing', 'blog writing', 'blogging', 'creative writing']],
    ['technical writing', 'Technical writing', 'writing', ['tech writing', 'technical documentation']],
    ['editing', 'Editing', 'writing', ['proofreading', 'copy editing', 'copyediting']],
    ['translation', 'Translation', 'writing', ['translator', 'localization', 'localisation']],
    ['journalism', 'Journalism', 'writing', ['news writing', 'journalist']],
    // business, sales, people
    ['sales', 'Sales', 'business', ['b2b sales', 'inside sales', 'lead generation', 'cold calling', 'business development', 'telesales', 'bde']],
    ['crm', 'CRM', 'business', ['salesforce', 'hubspot', 'zoho', 'zoho crm', 'customer relationship management']],
    ['customer support', 'Customer support', 'business', ['customer service', 'customer success', 'helpdesk', 'help desk', 'client support', 'call center', 'call centre', 'bpo', 'voice process', 'non voice', 'chat support']],
    ['operations', 'Operations', 'business', ['operations management', 'supply chain', 'logistics', 'inventory management', 'procurement', 'vendor management']],
    ['project management', 'Project management', 'business', ['project manager', 'pmp', 'project planning']],
    ['product management', 'Product management', 'business', ['product manager', 'product roadmap', 'product strategy']],
    ['human resources', 'HR & recruitment', 'business', ['hr', 'recruitment', 'recruiting', 'talent acquisition', 'payroll', 'hrms']],
    ['business analysis', 'Business analysis', 'business', ['business analyst', 'requirements gathering', 'stakeholder management', 'process improvement']],
    ['powerpoint', 'PowerPoint', 'business', ['ms powerpoint', 'microsoft powerpoint']],
    ['ms office', 'MS Office', 'business', ['microsoft office', 'ms word', 'office 365', 'google workspace']],
    ['negotiation', 'Negotiation', 'business', []],
    // finance
    ['accounting', 'Accounting', 'finance', ['bookkeeping', 'book keeping', 'accounts payable', 'accounts receivable', 'general ledger', 'financial accounting']],
    ['tally', 'Tally', 'finance', ['tally erp', 'tally prime', 'tallyprime']],
    ['quickbooks', 'QuickBooks', 'finance', ['zoho books']],
    ['gst', 'GST & taxation', 'finance', ['taxation', 'income tax', 'tds', 'gst return', 'gst filing', 'tax filing', 'itr']],
    ['financial analysis', 'Financial analysis', 'finance', ['financial modeling', 'financial modelling', 'valuation', 'dcf', 'financial reporting', 'fp&a', 'fpa', 'budgeting', 'forecasting', 'equity research']],
    ['auditing', 'Auditing & compliance', 'finance', ['audit', 'internal audit', 'statutory audit', 'compliance', 'risk management']],
    ['banking', 'Banking & insurance', 'finance', ['banking operations', 'credit analysis', 'kyc', 'investment banking', 'wealth management']],
    ['sap', 'SAP', 'finance', ['sap fico', 'sap erp', 'sap hana']],
    // engineering
    ['cad', 'CAD / mechanical design', 'engineering', ['autocad', 'auto cad', 'cad drafting', 'drafting', 'solidworks', 'solid works', 'catia', 'creo', 'fusion 360', 'ansys', 'mechanical design']],
    ['civil design', 'Civil / structural design', 'engineering', ['revit', 'bim', 'staad pro', 'staad', 'etabs', 'civil 3d', 'structural design', 'construction management']],
    ['matlab', 'MATLAB', 'engineering', ['simulink']],
    ['plc', 'PLC & automation', 'engineering', ['scada', 'industrial automation', 'plc programming', 'siemens plc', 'hmi']],
    ['circuit design', 'Circuit design', 'engineering', ['pcb design', 'vlsi', 'verilog', 'vhdl', 'analog circuits', 'digital electronics', 'altium']],
    ['manufacturing', 'Manufacturing', 'engineering', ['production planning', 'cnc', 'machining', 'lean manufacturing', 'six sigma', 'iso 9001', 'quality control']],
    // teaching
    ['teaching', 'Teaching', 'education', ['tutoring', 'curriculum design', 'lesson planning', 'classroom management', 'instructional design', 'e learning']],
    // soft skills count for much less and are never shown as "skills to add"
    ['communication', 'Communication', 'soft', ['communication skills', 'verbal communication', 'written communication', 'presentation skills']],
    ['teamwork', 'Teamwork', 'soft', ['team player', 'team work', 'collaboration']],
    ['leadership', 'Leadership', 'soft', ['team leadership', 'team management']],
    ['problem solving', 'Problem solving', 'soft', ['analytical skills', 'analytical thinking', 'critical thinking']],
    ['time management', 'Time management', 'soft', []],
    ['english', 'English', 'soft', ['english proficiency', 'fluent english', 'spoken english', 'business english']]
];

// Too short or too common to be spotted inside a listing's text ("go to market", "R&D"). They still match when a person types them as a skill.
export const AMBIGUOUS = new Set(['c', 'r', 'go', 'embedded']);

// Having the first skill also covers part of the second: [has, covers, how much (0 to 1)].
export const IMPLIES = [
    ['react', 'javascript', .7], ['react', 'html', .4], ['next.js', 'react', .9], ['next.js', 'javascript', .7], ['react native', 'react', .8], ['react native', 'javascript', .6],
    ['angular', 'typescript', .6], ['angular', 'javascript', .7], ['vue', 'javascript', .7], ['typescript', 'javascript', .9], ['node.js', 'javascript', .7], ['express.js', 'node.js', .8],
    ['pandas', 'python', .6], ['pandas', 'data analysis', .6], ['django', 'python', .7], ['flask', 'python', .7], ['fastapi', 'python', .7],
    ['deep learning', 'machine learning', .8], ['nlp', 'machine learning', .7], ['computer vision', 'machine learning', .6],
    ['mysql', 'sql', .8], ['postgresql', 'sql', .8], ['power bi', 'data visualization', .7], ['tableau', 'data visualization', .7], ['excel', 'data analysis', .5],
    ['photoshop', 'graphic design', .6], ['illustrator', 'graphic design', .6], ['figma', 'ui/ux', .5],
    ['java', 'oop', .6], ['csharp', 'oop', .6], ['cpp', 'oop', .6], ['spring boot', 'java', .8], ['dotnet', 'csharp', .6], ['kubernetes', 'docker', .6],
    ['seo', 'digital marketing', .6], ['paid ads', 'digital marketing', .7], ['social media', 'digital marketing', .6], ['content marketing', 'digital marketing', .5], ['google analytics', 'digital marketing', .4],
    ['copywriting', 'content writing', .8], ['content writing', 'copywriting', .6], ['technical writing', 'content writing', .6],
    ['tally', 'accounting', .8], ['quickbooks', 'accounting', .8], ['gst', 'accounting', .5]
];

// Skills that sit close together: knowing one earns a little credit for the others (FAMILY_CREDIT in engine.js).
export const FAMILIES = [
    ['javascript', 'typescript', 'react', 'angular', 'vue', 'next.js', 'node.js', 'html', 'css'],
    ['python', 'django', 'flask', 'fastapi', 'pandas'],
    ['java', 'csharp', 'cpp', 'go', 'rust', 'php', 'ruby', 'kotlin', 'scala', 'c'],
    ['aws', 'azure', 'gcp', 'docker', 'kubernetes', 'ci/cd', 'terraform', 'devops', 'linux'],
    ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'nosql', 'firebase'],
    ['android', 'ios', 'flutter', 'react native', 'kotlin', 'swift', 'dart'],
    ['machine learning', 'deep learning', 'nlp', 'computer vision', 'statistics', 'data analysis', 'pandas', 'big data', 'etl', 'python', 'r'],
    ['power bi', 'tableau', 'data visualization', 'excel', 'google analytics'],
    ['figma', 'ui/ux', 'photoshop', 'illustrator', 'graphic design', 'video editing', 'animation', '3d', 'photography'],
    ['seo', 'digital marketing', 'social media', 'content marketing', 'email marketing', 'paid ads', 'google analytics', 'market research', 'public relations'],
    ['copywriting', 'content writing', 'technical writing', 'editing', 'journalism', 'translation'],
    ['accounting', 'tally', 'quickbooks', 'gst', 'financial analysis', 'auditing', 'banking', 'sap'],
    ['sales', 'crm', 'customer support', 'negotiation'],
    ['project management', 'product management', 'business analysis', 'operations'],
    ['cad', 'civil design', 'matlab', 'plc', 'circuit design', 'manufacturing', 'embedded']
];

// Field of study (and headline) -> the kinds of work it points to. [pattern, [[category, weight], ...]]
export const FIELD_DOMAINS = [
    [/comput|\bcse\b|\bit\b|software|informatics|information tech|\bbca\b|\bmca\b|artificial|\bai\b|cyber|web dev/, [['tech', 2], ['data', .8]]],
    [/data|statistic|mathemat|analytics|\bml\b|machine learn/, [['data', 2], ['tech', .8], ['finance', .3]]],
    [/electronic|electrical|\bece\b|\beee\b|instrumentation|telecom|mechatron|robotic/, [['engineering', 2], ['tech', .8]]],
    [/mechanic|civil|automobile|production|industrial|chemical|aerospace|manufactur|structural|architecture|construction/, [['engineering', 2]]],
    [/business|\bbba\b|\bmba\b|management|commerce|\bbcom\b|b\.com|economics|marketing|entrepreneur|hospitality|retail/, [['business', 2], ['marketing', 1], ['finance', 1]]],
    [/financ|accountan|accounting|banking|\bca\b|actuar|taxation|insurance/, [['finance', 2], ['business', .8]]],
    [/design|fine art|animation|multimedia|visual|film|photograph|fashion/, [['design', 2], ['marketing', .5]]],
    [/journalism|mass comm|communication|english|literature|media|linguistic|creative writing|content/, [['writing', 2], ['marketing', 1.2]]],
    [/educat|teaching|pedagog|\bb\.?ed\b|psycholog|sociolog|social work/, [['education', 2], ['business', .5]]],
    [/biolog|pharma|nursing|medic|clinical|biotech|health|chemistry|physics|science/, [['health', 2], ['data', .4]]]
];

// Words in a listing title (or a candidate's headline and past roles) -> the kind of work. Same shape as FIELD_DOMAINS.
export const ROLE_DOMAINS = [
    [/software|developer|programmer|front[- ]?end|back[- ]?end|full[- ]?stack|\bweb\b|mobile app|android|\bios\b|devops|cloud|\bsde\b|\bqa\b|tester|testing|cyber|sysadmin|it support|network engineer|app dev/, [['tech', 3]]],
    [/data|analytics|machine learning|\bml\b|\bai\b|scientist|\bbi\b|statistic/, [['data', 3]]],
    [/design|designer|\bui\b|\bux\b|graphic|animat|illustrat|creative|video|motion|photograph|editor/, [['design', 3]]],
    [/marketing|\bseo\b|social media|growth|brand|community|campaign|digital/, [['marketing', 3]]],
    [/writer|writing|copy|content|journalis|blog|editor|reporter/, [['writing', 3], ['marketing', .8]]],
    [/sales|business development|\bbde\b|account manager|operations|recruit|talent|\bhr\b|human resource|customer|support|admin|coordinator|project manager|product manager|consultant|executive/, [['business', 3]]],
    [/financ|account|audit|\btax\b|bookkeep|banking|investment|equity|\bgst\b|analyst/, [['finance', 3]]],
    [/mechanical|civil|electrical|electronics|embedded|manufactur|production|quality|\bcad\b|site engineer|structural|automobile|\bplc\b|maintenance|industrial/, [['engineering', 3]]],
    [/teach|tutor|trainer|instructor|faculty|curriculum|lecturer/, [['education', 3]]],
    [/nurse|clinical|pharma|medical|health|laborator|biolog|research assistant/, [['health', 3]]]
];

// Cities that go by more than one name. People can type either; a listing in any of them counts.
export const CITIES = [
    ['bengaluru', 'bangalore', 'bengaluru', 'blr'],
    ['mumbai', 'mumbai', 'bombay', 'navi mumbai', 'thane'],
    ['delhi', 'delhi', 'new delhi', 'ncr', 'delhi ncr', 'noida', 'gurgaon', 'gurugram', 'ghaziabad', 'faridabad'],
    ['hyderabad', 'hyderabad', 'secunderabad'],
    ['chennai', 'chennai', 'madras'],
    ['kolkata', 'kolkata', 'calcutta'],
    ['pune', 'pune', 'pimpri', 'chinchwad'],
    ['new york', 'new york', 'nyc', 'new york city', 'ny'],
    ['san francisco', 'san francisco', 'sf', 'bay area']
];
