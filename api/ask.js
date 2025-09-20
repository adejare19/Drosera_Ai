// api/ask.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { username, step, error } = req.body || {};
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });

  // Safety: keep temperature low and require model to follow the guide strictly
  const systemPrompt = `You are a Drosera setup assistant.

- You have access to the full JSON guide (steps with commands and explanations).
- Your job is to guide the user step by step through this guide.
- Always show commands and instructions ONLY from the JSON guide.
- If the user pastes an error:
   • Check which step they were on.  
   • Suggest fixes ONLY with Linux troubleshooting related to the commands/config in that step.  
   • You may suggest things like: reinstalling dependencies (apt, yum, brew), re-running commands, checking paths, permissions, systemctl restarts, missing packages, environment variables.  
   • Do NOT invent unrelated steps.  
- After the error is solved, ask: "✅ Ready to retry this step?"  
- Once the user confirms success, move them to the NEXT step in the JSON.
- If the error is not solvable with the guide + basic Linux troubleshooting, respond:
   "This error is outside the scope of this guide. Please check the official Drosera or system documentation."
`;

  const userMessage = error
    ? `Username: ${username}\nError while running step (id=${step?.id} title="${step?.title}"):\n\n${error}\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`
    : `Username: ${username}\nRequest: show the exact commands & notes for step (id=${step?.id} title="${step?.title}")\n\nGuide step JSON:\n${JSON.stringify(step, null, 2)}`;

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4.0-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 1000,
        temperature: 0.0
      }),
    });

    if (!openaiRes.ok) {
      const txt = await openaiRes.text();
      console.error('OpenAI error:', txt);
      return res.status(502).json({ error: 'OpenAI request failed', details: txt });
    }

    const j = await openaiRes.json();
    const answer = j.choices?.[0]?.message?.content ?? '';
    return res.status(200).json({ answer });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
}
