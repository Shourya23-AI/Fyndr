// Old links to app.html go to index.html, keeping the #/page part. (A file, not inline, so no page needs inline script.)
location.replace("index.html" + location.hash);
