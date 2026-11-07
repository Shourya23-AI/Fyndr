// Part 3 of the career guide: books for each skill in the plan.
// HONEST NOTE: Fyndr's Library does not hold a book list, it searches open catalogs live. So these picks are a hand-made list of well-known books
// (title, author, and a link only where the author publishes a free online edition). Fyndr has not checked that a copy is available:
// each book gets a Library search plus other places to find it. A skill with no pick here falls back to a Library search for the skill.
// Add a row to teach the guide a new book: [title, author, optional official free link].
import { FIND, titleSim, readUrl } from '../library/books.js';

export const BOOKS = {
    python: [['Automate the Boring Stuff with Python', 'Al Sweigart', 'https://automatetheboringstuff.com/'], ['Python Crash Course', 'Eric Matthes']],
    java: [['Head First Java', 'Kathy Sierra and Bert Bates'], ['Effective Java', 'Joshua Bloch']],
    cpp: [['A Tour of C++', 'Bjarne Stroustrup'], ['Programming: Principles and Practice Using C++', 'Bjarne Stroustrup']],
    c: [['The C Programming Language', 'Brian Kernighan and Dennis Ritchie'], ['Let Us C', 'Yashavant Kanetkar']],
    csharp: [['C# in Depth', 'Jon Skeet']],
    javascript: [['Eloquent JavaScript', 'Marijn Haverbeke', 'https://eloquentjavascript.net/'], ['You Don\u2019t Know JS Yet', 'Kyle Simpson', 'https://github.com/getify/You-Dont-Know-JS']],
    go: [['The Go Programming Language', 'Alan Donovan and Brian Kernighan']],
    dsa: [['Grokking Algorithms', 'Aditya Bhargava'], ['Introduction to Algorithms', 'Thomas Cormen and others'], ['Cracking the Coding Interview', 'Gayle Laakmann McDowell']],
    oop: [['Clean Code', 'Robert C. Martin'], ['The Pragmatic Programmer', 'David Thomas and Andrew Hunt']],
    git: [['Pro Git', 'Scott Chacon and Ben Straub', 'https://git-scm.com/book']],
    sql: [['Learning SQL', 'Alan Beaulieu'], ['Sams Teach Yourself SQL in 10 Minutes', 'Ben Forta']],
    'rest api': [['RESTful Web APIs', 'Leonard Richardson and Mike Amundsen'], ['Designing Web APIs', 'Brenda Jin and others']],
    linux: [['The Linux Command Line', 'William Shotts', 'https://linuxcommand.org/tlcl.php'], ['How Linux Works', 'Brian Ward']],
    bash: [['The Linux Command Line', 'William Shotts', 'https://linuxcommand.org/tlcl.php']],
    'software testing': [['Lessons Learned in Software Testing', 'Cem Kaner, James Bach and Bret Pettichord'], ['The Art of Software Testing', 'Glenford Myers']],
    docker: [['Docker Deep Dive', 'Nigel Poulton']],
    kubernetes: [['Kubernetes: Up and Running', 'Brendan Burns and others']],
    terraform: [['Terraform: Up & Running', 'Yevgeniy Brikman']],
    aws: [['Amazon Web Services in Action', 'Michael Wittig and Andreas Wittig']],
    'ci/cd': [['Continuous Delivery', 'Jez Humble and David Farley']],
    html: [['HTML and CSS: Design and Build Websites', 'Jon Duckett']],
    css: [['HTML and CSS: Design and Build Websites', 'Jon Duckett'], ['CSS: The Definitive Guide', 'Eric Meyer and Estelle Weyl']],
    react: [['Learning React', 'Alex Banks and Eve Porcello']],
    vue: [['Vue.js: Up and Running', 'Callum Macrae']],
    typescript: [['Programming TypeScript', 'Boris Cherny'], ['Effective TypeScript', 'Dan Vanderkam']],
    'ui/ux': [['Don\u2019t Make Me Think', 'Steve Krug'], ['The Design of Everyday Things', 'Don Norman']],
    'node.js': [['Node.js Design Patterns', 'Mario Casciaro and Luciano Mammino']],
    php: [['PHP & MySQL: Server-side Web Development', 'Jon Duckett']],
    django: [['Django for Beginners', 'William S. Vincent']],
    'spring boot': [['Spring in Action', 'Craig Walls']],
    redis: [['Redis in Action', 'Josiah Carlson']],
    mongodb: [['MongoDB: The Definitive Guide', 'Shannon Bradshaw and others']],
    mysql: [['High Performance MySQL', 'Baron Schwartz and others']],
    postgresql: [['PostgreSQL: Up and Running', 'Regina Obe and Leo Hsu']],
    nosql: [['NoSQL Distilled', 'Pramod Sadalage and Martin Fowler']],
    android: [['Head First Android Development', 'Dawn Griffiths and David Griffiths']],
    kotlin: [['Kotlin in Action', 'Dmitry Jemerov and Svetlana Isakova']],
    swift: [['Swift Programming: The Big Nerd Ranch Guide', 'Big Nerd Ranch']],
    ios: [['iOS Programming: The Big Nerd Ranch Guide', 'Big Nerd Ranch']],
    flutter: [['Flutter in Action', 'Eric Windmill']],
    'react native': [['React Native in Action', 'Nader Dabit']],
    networking: [['Computer Networking: A Top-Down Approach', 'James Kurose and Keith Ross'], ['Computer Networks', 'Andrew Tanenbaum']],
    cybersecurity: [['Security Engineering', 'Ross Anderson', 'https://www.cl.cam.ac.uk/~rja14/book.html']],
    'circuit design': [['The Art of Electronics', 'Paul Horowitz and Winfield Hill']],
    embedded: [['Making Embedded Systems', 'Elecia White']],
    matlab: [['MATLAB: A Practical Introduction to Programming and Problem Solving', 'Stormy Attaway']],
    plc: [['Programmable Logic Controllers', 'Frank Petruzella']],
    cad: [['Mastering AutoCAD', 'George Omura']],
    manufacturing: [['Manufacturing Engineering and Technology', 'Serope Kalpakjian and Steven Schmid']],
    excel: [['Microsoft Excel Data Analysis and Business Modeling', 'Wayne Winston']],
    'data analysis': [['Python for Data Analysis', 'Wes McKinney'], ['Storytelling with Data', 'Cole Nussbaumer Knaflic']],
    statistics: [['Think Stats', 'Allen Downey', 'https://greenteapress.com/wp/think-stats-2e/'], ['Naked Statistics', 'Charles Wheelan']],
    pandas: [['Python for Data Analysis', 'Wes McKinney'], ['Python Data Science Handbook', 'Jake VanderPlas', 'https://jakevdp.github.io/PythonDataScienceHandbook/']],
    'power bi': [['The Definitive Guide to DAX', 'Marco Russo and Alberto Ferrari']],
    tableau: [['Tableau Your Data!', 'Daniel Murray']],
    'data visualization': [['Storytelling with Data', 'Cole Nussbaumer Knaflic'], ['The Visual Display of Quantitative Information', 'Edward Tufte']],
    etl: [['The Data Warehouse Toolkit', 'Ralph Kimball and Margy Ross']],
    'big data': [['Designing Data-Intensive Applications', 'Martin Kleppmann']],
    'machine learning': [['An Introduction to Statistical Learning', 'Gareth James and others', 'https://www.statlearning.com/'], ['Hands-On Machine Learning with Scikit-Learn, Keras and TensorFlow', 'Aur\u00e9lien G\u00e9ron']],
    'deep learning': [['Deep Learning', 'Ian Goodfellow, Yoshua Bengio and Aaron Courville', 'https://www.deeplearningbook.org/'], ['Dive into Deep Learning', 'Aston Zhang and others', 'https://d2l.ai/']],
    nlp: [['Speech and Language Processing', 'Dan Jurafsky and James Martin', 'https://web.stanford.edu/~jurafsky/slp3/']],
    'computer vision': [['Computer Vision: Algorithms and Applications', 'Richard Szeliski', 'https://szeliski.org/Book/']],
    r: [['R for Data Science', 'Hadley Wickham and Garrett Grolemund', 'https://r4ds.hadley.nz/']],
    'graphic design': [['Thinking with Type', 'Ellen Lupton'], ['Graphic Design: The New Basics', 'Ellen Lupton and Jennifer Cole Phillips']],
    photoshop: [['Adobe Photoshop Classroom in a Book', 'Conrad Chavez']],
    illustrator: [['Adobe Illustrator Classroom in a Book', 'Brian Wood']],
    animation: [['The Animator\u2019s Survival Kit', 'Richard Williams']],
    'video editing': [['In the Blink of an Eye', 'Walter Murch']],
    photography: [['Understanding Exposure', 'Bryan Peterson']],
    'market research': [['Marketing Research: An Applied Orientation', 'Naresh Malhotra']],
    'digital marketing': [['Digital Marketing: Strategy, Implementation and Practice', 'Dave Chaffey and Fiona Ellis-Chadwick']],
    seo: [['The Art of SEO', 'Eric Enge and others']],
    'social media': [['Jab, Jab, Jab, Right Hook', 'Gary Vaynerchuk']],
    'content marketing': [['Epic Content Marketing', 'Joe Pulizzi']],
    copywriting: [['Ogilvy on Advertising', 'David Ogilvy'], ['The Adweek Copywriting Handbook', 'Joseph Sugarman']],
    'google analytics': [['Web Analytics 2.0', 'Avinash Kaushik']],
    'content writing': [['On Writing Well', 'William Zinsser'], ['The Elements of Style', 'William Strunk Jr. and E. B. White']],
    editing: [['The Copyeditor\u2019s Handbook', 'Amy Einsohn']],
    journalism: [['The Elements of Journalism', 'Bill Kovach and Tom Rosenstiel']],
    'technical writing': [['Docs for Developers', 'Jared Bhatti and others']],
    sales: [['SPIN Selling', 'Neil Rackham']],
    negotiation: [['Getting to Yes', 'Roger Fisher and William Ury']],
    powerpoint: [['Presentation Zen', 'Garr Reynolds']],
    'customer support': [['The Effortless Experience', 'Matthew Dixon and others']],
    'human resources': [['Human Resource Management', 'Gary Dessler']],
    'project management': [['A Guide to the Project Management Body of Knowledge (PMBOK Guide)', 'Project Management Institute']],
    'business analysis': [['Business Analysis Techniques', 'James Cadle and others'], ['A Guide to the Business Analysis Body of Knowledge (BABOK Guide)', 'IIBA']],
    operations: [['The Goal', 'Eliyahu Goldratt'], ['Operations Management', 'Jay Heizer and Barry Render']],
    'product management': [['Inspired', 'Marty Cagan']],
    accounting: [['Accounting Made Simple', 'Mike Piper'], ['Double Entry Book Keeping', 'T. S. Grewal']],
    'financial analysis': [['Financial Statement Analysis', 'K. R. Subramanyam'], ['The Intelligent Investor', 'Benjamin Graham']],
    auditing: [['Auditing and Assurance Services', 'Alvin Arens and others']],
    banking: [['Indian Financial System', 'Bharati Pathak']],
    'civil design': [['Design of Reinforced Concrete', 'Jack McCormac and Russell Brown']],
    teaching: [['Teach Like a Champion', 'Doug Lemov']]
};

const book = ([t, a, free]) => ({ t, a, ...(free ? { free } : {}) });
// The books for one skill (an item from assess()). Tries the skill's own key first, then the other keys of an “any one of these” item.
export function pickBooks(item, n = 2) {
    for (const k of [item.key, ...(item.keys || []).filter(x => x !== item.key)]) {
        if (BOOKS[k]) {
            return BOOKS[k].slice(0, n).map(book);
        }
    }
    return [];
}

// Where to read or get a book: the Fyndr Library search first (in the app), then a few other places from the Library's own list.
const OUT = ['Open Library', 'Amazon India', 'WorldCat'];
export const libraryHref = q => '#/library?' + new URLSearchParams({ q: String(q).slice(0, 120), free: '1' });
export function bookLinks(b) {
    const q = b.t + ' ' + String(b.a || '').split(' and ')[0];
    return [
        { n: 'Find in Fyndr Library', u: libraryHref(b.t), app: true },
        ...FIND.filter(f => OUT.includes(f[0])).map(([n, kind, fn]) => ({ n, kind, u: fn(q) }))
    ];
}

// ---------- live copies ----------
// After the roadmap is drawn, the guide asks the Library's open catalogs (Open Library, Project Gutenberg, Google Books, Internet Archive) whether a
// copy of each first-choice book can be read, previewed or borrowed online, and links straight to it. This picks the best answer from that list.
const RANK = { free: 4, preview: 3, borrow: 2, info: 1 };
const WORD = { free: 'Read free on', preview: 'Preview on', borrow: 'Borrow on', info: 'Details on' };
const https = u => (typeof u === 'string' && u.length <= 600 && /^https:\/\/[^\s"<>`\\]+$/i.test(u) ? u : '');
export function bestCopy(title, books, min = .85) {
    const near = (books || []).filter(b => b && b.title && RANK[b.access] && titleSim(title, b.title) >= min);
    near.sort((a, b) => RANK[b.access] - RANK[a.access] || titleSim(title, b.title) - titleSim(title, a.title));
    for (const b of near) {
        const u = https((b.access === 'free' || b.access === 'preview') && b.read ? readUrl(b.read) : '') || https(b.info);
        if (u) {
            return { access: b.access, src: String(b.src || 'the catalog').slice(0, 40), u, label: WORD[b.access] + ' ' + String(b.src || 'the catalog').slice(0, 40) };
        }
    }
    return null;
}
