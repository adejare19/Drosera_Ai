// api/generateGuide.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { idea } = req.body;

    if (!idea) {
      return res.status(400).json({ error: "Missing idea" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an assistant that generates **small, unique, testable Drosera PoC guides**. 
Return only JSON matching the schema.`,
          },
          {
            role: "user",
            content: `
Create a step-by-step PoC guide for the following idea: "${idea}"

Requirements:
1. Include clear sequential steps (setup, contracts, configs, build/test, deploy).
2. Provide full code for Trap.sol, TrapResponse.sol, drosera.toml, and foundry.toml.
3. No constructors in contracts.
4. drosera.toml must use correct response_function signature.
5. Output strictly in JSON with this schema:

{
  "steps": [
    { "title": "Step 1 title", "commands": "terminal commands", "files": { "filename": "full code" } }
  ]
}
          `,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "{}";

    let guide;
    try {
      guide = JSON.parse(text);
    } catch (err) {
      return res.status(500).json({ error: "Failed to parse AI response", raw: text });
    }

    res.status(200).json({ guide });
  } catch (err) {
    console.error("Error generating guide:", err);
    res.status(500).json({ error: "Failed to generate guide" });
  }
}
