// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userIdea } = req.body;

    if (!userIdea) {
      return res.status(400).json({ error: "Missing userIdea" });
    }

    const messages = [
      {
        role: "system",
        content: `
You are an assistant that generates small, unique, testable Drosera PoC traps. 
Each output must be a self-contained PoC repository (Foundry-friendly) with:
- One main Trap contract (implements ITrap, pragma ^0.8.20)
- One Response contract (with correct response_function signature, deployable on Remix)
- A drosera.toml (no constructor args, response_function matches)
- Short foundry.toml
- Step-by-step setup + test instructions.

All contracts MUST avoid constructor arguments. Use setter functions instead. 
The output must be returned as JSON only (no commentary, no code fences).
        `,
      },
      {
        role: "user",
        content: `
Create 3 distinct PoC trap projects based on this idea: "${userIdea}". 
⚠️ Each trap must come from a different category (choose 3 unique ones from this list):

1. Protocol-specific traps
2. Behavioral / transaction pattern traps
3. Environment / infra traps
4. Access-control traps
5. Timing traps
6. Economic traps
7. Cross-domain / interoperability traps

Requirements for each item:
- title
- network
- protocol
- summary
- files: { "src/Trap.sol": "...", "src/TrapResponse.sol": "..." }
- drosera_toml
- foundry_toml
- verify

Return JSON array only. Do not include markdown fences or commentary.
        `,
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        max_tokens: 1800,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "[]";

    // 🔹 Strip ```json fences if present
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let ideasJson;
    try {
      ideasJson = JSON.parse(raw);
    } catch (e) {
      console.error("❌ Failed to parse AI JSON:", e, raw);
      return res.status(500).json({ error: "Invalid AI JSON output", raw });
    }

    res.status(200).json({ ideas: ideasJson });
  } catch (err) {
    console.error("Error generating ideas:", err);
    res.status(500).json({ error: "Failed to generate ideas" });
  }
}
