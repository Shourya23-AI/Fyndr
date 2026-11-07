# Fyndr career guide: the "Ask the guide" AI (free setup)

The Guide on the landing page (signed-in students) already checks skills and builds a course plan and roadmap with plain rules.
After that check, **"Ask the guide a question"** lets the student type any question about their path ("what should I build first?").
Fyndr's server finds matching listings/courses, adds the student's job + skill gaps, and asks a Llama model to answer.
Only the question, the job, the skill list, qualification and experience are sent. Never name or email.

## Free setup (Groq, hosted Llama, no laptop needed)
1. Make a free account at https://console.groq.com and create an API key.
2. On the machine/host that runs `node server.js`, set:
   - `AI_API_KEY` = your key
   - (optional) `AI_MODEL` = `llama-3.1-8b-instant` (default, fast) or `llama-3.3-70b-versatile` (smarter, tighter free limits)
3. Restart the server. On Render: Environment tab > add `AI_API_KEY`.

Free plans have limits that apply to the whole site, not per student, and they can change. The server stops at `ASSISTANT_DAILY` (default 700) requests a day, and 10 per student per 10 minutes (`ASSISTANT_LIMIT`), and shows a polite "busy" message. Check your limits at console.groq.com.

## Off-topic questions cost nothing
Before the AI is called, `server/lib/scope.js` checks the question. Anything clearly not about careers, learning or Fyndr (poems, jokes, sports, recipes, "capital of France"...) and any attempt to change the rules ("ignore your instructions", "show your system prompt") gets a fixed reply straight from your server. The AI is not called and the daily allowance is not used. When unsure, a question is let through, so real career questions are never blocked. To allow more words, add them to `ON_TOPIC` in `scope.js`; `test/scope.test.js` checks the behaviour.

## Your own Llama with Ollama (optional)
Leave `AI_API_KEY` empty and the server uses Ollama instead (`OLLAMA_URL`, `OLLAMA_MODEL`).
1. Put your model name on the `FROM` line of `ai/Modelfile` (see `ollama list`).
2. `ollama create fyndr -f ai/Modelfile`
3. `OLLAMA_MODEL=fyndr node server.js`
Ollama must be reachable from the Node server, so this only works while that computer is on, or on a server you rent.

## Other settings
`AI_BASE_URL` (default Groq; any OpenAI-compatible API works), `OLLAMA_TIMEOUT_MS` (60000), `ASSISTANT=off` to turn it off.

## Check quality
Use `ai/test-questions.md`. Good answers are short, on-topic, never invent a company or link, and refuse off-topic requests.

## Remember
Your privacy page should say that questions asked in the guide are processed by an AI provider (Groq, if you use it).
