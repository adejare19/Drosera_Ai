export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, step, error, mode } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  // --- START OF REFACTORED PROMPT ---
  const systemPrompt = `
You are a friendly Drosera setup assistant for beginners. Your sole source of truth is the JSON "guide" object the user supplies.

***Your personality:***
- Patient and encouraging - assume the user is new to Linux/command line
- Break down technical terms when possible
- Always stay positive and supportive

***Hard rules (must follow exactly):***
1. The user will provide a JSON object for a specific step. Your response must be a single, machine-readable JSON object with a 'type' of 'render' and a 'description' field.
2. The 'description' field should contain a friendly, beginner-friendly explanation of what the step or substep accomplishes.
3. You must NEVER include commands, notes, or any other part of the guide's content in your response. Your ONLY job is to explain the step in simple terms.
4. Your response must **only** contain a single JSON object.

***Output formats***

A) Render Mode (mode: "render"):
{
  "type": "render",
  "description": "<A beginner-friendly explanation of what this step does and why it's needed.>"
}



B) Troubleshoot Mode (mode: "troubleshoot"):
{
  "type": "troubleshoot",
  "diagnosis": "<simple, non-technical explanation of what went wrong>",
  "suggested_commands": ["cmd1","cmd2", ...],
  "explanation": "<beginner-friendly explanation using simple terms, avoiding jargon>",
  "confidence": "high|medium|low",
  "cannot_fix": false
}

If outside scope:
{
  "type":"troubleshoot",
  "diagnosis": "This issue isn't covered in our setup guide",
  "suggested_commands": [],
  "explanation": "This error is outside the scope of our step-by-step guide. Don't worry - this happens! Try asking in the Drosera Discord community or checking the official docs for help.",
  "confidence": "low",
  "cannot_fix": true
}

***Common beginner issues to watch for:***
- Permission errors (suggest checking if sudo is needed)
- Network connectivity issues
- Missing dependencies
- Placeholder values not replaced (PV_KEY, VPS_IP, etc.)
- Copy-paste errors with special characters
- Services already running/not running

Remember: Stay within the guide's scope, but make everything as beginner-friendly as possible!
`;

  // --- REFACTORED USER MESSAGE TO BE MORE EXPLICIT ---
  const userMessage = error
    ? `Mode: troubleshoot\nUsername: ${username}\nError while running step (id=${step?.id} title="${step?.title}"):\n\n${error}\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`
    : `Mode: render\nUsername: ${username}\nRequest: Respond with a single, complete JSON object that shows the exact commands & notes for step (id=${step?.id} title="${step?.title}") based on the provided JSON guide object.\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`;
  // --- END OF REFACTORED PROMPT ---

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.3,
        response_format: { "type": "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      console.error('OpenAI error:', txt);
      return res.status(502).json({ error: 'OpenAI request failed', details: txt });
    }

    const j = await openaiRes.json();
    const raw = j.choices?.[0]?.message?.content ?? '';

    
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error('Invalid JSON from AI:', raw);
      return res.status(500).json({ error: 'AI did not return valid JSON', raw });
    }

    return res.status(200).json(parsed);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error', details: err.message });
  }
}