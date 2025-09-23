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
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content: `
You are a Drosera setup assistant.
Return ONLY valid JSON (no prose, no markdown fences).

Format:
{
  "steps": [
    {
      "title": "Step name",
      "commands": "terminal commands",
      "files": {
        "src/FooTrap.sol": "source code",
        "src/FooResponder.sol": "source code"
      }
    }
  ]
}
            `,
          },
          {
            role: "user",
            content: `Generate a step-by-step Foundry setup guide for trap idea: "${idea}". 
Include minimal but valid code for Trap + Responder, configs, and verification.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Parse error:", err, raw);
      return res.status(500).json({ error: "Invalid AI JSON", raw });
    }

    return res.status(200).json({ guide: parsed });
  } catch (err) {
    console.error("Error in generateGuide:", err);
    res.status(500).json({ error: "Failed to generate guide" });
  }
}
