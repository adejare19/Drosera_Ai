import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, step, error } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // The system prompt is now strictly for troubleshooting
  const systemPrompt = `
You are a friendly Drosera setup assistant designed to help beginners with little Linux experience. Your sole source of truth is the JSON "guide" object the user supplies.

***Your personality:***
- Patient and encouraging - assume the user is new to Linux/command line
- Break down technical terms when possible
- Always stay positive and supportive

***Hard rules (must follow exactly):***
1. The user will provide a JSON object for a specific step along with a troubleshooting request.
2. Your response must be a single, machine-readable JSON object with fields as described in the 'Troubleshoot Mode' format below.
3. Keep responses concise and only include content permitted by the troubleshoot mode. If the answer is outside scope, return the structured "cannot_fix" object.
4. Do not reference or provide any information about previous or future steps in the guide.
5. Do not include commands, notes, or any guide content in your explanation.

***Output format***

{
  "type": "troubleshoot",
  "diagnosis": "<simple, non-technical explanation of what went wrong>",
  "suggested_commands": ["cmd1", "cmd2", "..."],
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
`;

  // The user message is now only for troubleshooting, regardless of the `mode`
  const userMessage = `
Mode: troubleshoot
Username: ${username}
Error while running step (id=${step?.id} title="${step?.title}"):
${error}
Guide step JSON:
${JSON.stringify(step, null, 2)}
`;

  try {
    const openaiRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { "type": "json_object" },
    });

    const raw = openaiRes.choices?.[0]?.message?.content ?? '';

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