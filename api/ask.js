export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { username, step, error } = req.body || {};
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

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
`;

  const userMessage = `
Mode: troubleshoot
Username: ${username}
Error while running step (id=${step?.id} title="${step?.title}"):
${error}
Guide step JSON:
${JSON.stringify(step, null, 2)}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error("OpenAI error:", txt);
      return res.status(502).json({ error: "OpenAI request failed", details: txt });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "";

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      console.error("Invalid JSON from AI:", raw);
      return res.status(500).json({ error: "AI did not return valid JSON", raw });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error", details: err.message });
  }
}
