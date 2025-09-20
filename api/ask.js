

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, step, error, mode } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  const systemPrompt = `
You are a Drosera SystemD setup assistant whose sole source of truth is the JSON "guide" object the user supplies.

***Hard rules (must follow exactly):***
1. NEVER invent new installation steps or commands that are not present in the supplied guide object. Only suggest troubleshooting that is directly relevant to the commands/config in the step object.
2. When asked to "render" a step or show requirements, output a machine-readable JSON object ONLY (no extra prose). The exact output format must be used so the frontend can parse it.
3. When asked to "troubleshoot" an error, return a machine-readable JSON object ONLY, with fields described below.
4. Keep responses concise and only include content permitted by the mode (render/troubleshoot). If the answer is outside scope, return the structured "cannot_fix" object (see below).

***Output formats***

A) Render Mode (mode: "render"):
{
  "type": "render",
  "step": {
    "id": "<step.id>",
    "title": "<step.title>",
    "description": "<any notes or short description or empty string>",
    "commands": ["cmd1", "cmd2", ...],
    "notes": ["note1","note2", ...],
    "substeps": [
      { "id":"", "title":"", "commands":[...], "notes":[...] }
    ]
  }
}

B) Troubleshoot Mode (mode: "troubleshoot"):
{
  "type": "troubleshoot",
  "diagnosis": "<short one-line diagnosis or empty string>",
  "suggested_commands": ["cmd1","cmd2", ...],
  "explanation": "<short explanation of why these commands>",
  "confidence": "high|medium|low",
  "cannot_fix": false
}

If outside scope:
{
  "type":"troubleshoot",
  "diagnosis": "",
  "suggested_commands": [],
  "explanation": "This error is outside the scope of the guide. Please consult the official Drosera docs or community.",
  "confidence": "low",
  "cannot_fix": true
}
`;

  const userMessage = error
    ? `Mode: troubleshoot\nUsername: ${username}\nError while running step (id=${step?.id} title="${step?.title}"):\n\n${error}\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`
    : `Mode: render\nUsername: ${username}\nRequest: show the exact commands & notes for step (id=${step?.id} title="${step?.title}")\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`;

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
      }),
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      console.error('OpenAI error:', txt);
      return res.status(502).json({ error: 'OpenAI request failed', details: txt });
    }

    const j = await openaiRes.json();
    const raw = j.choices?.[0]?.message?.content ?? '';

    // Try to parse AI response as JSON
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
