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

    // 🔹 Refined system+user prompt
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
The output must be returned as JSON only (no commentary outside JSON).
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
- title: short trap name
- network: e.g. Ethereum, Polygon, Arbitrum
- protocol: e.g. Uniswap, Aave, OpenSea
- summary: 2–3 sentences on what the trap detects and how it triggers
- files: full source code for src/Trap.sol and src/TrapResponse.sol (no partial snippets)
- drosera_toml: valid drosera.toml for this trap
- foundry_toml: minimal but correct foundry.toml
- verify: 2–4 steps on how to test & validate the trap

JSON schema (strict):
[
  {
    "title": "string",
    "network": "string",
    "protocol": "string",
    "summary": "string",
    "files": { "src/Trap.sol": "string", "src/TrapResponse.sol": "string" },
    "drosera_toml": "string",
    "foundry_toml": "string",
    "verify": "string"
  }
]

Generate exactly 3 projects. Each must be clearly different (different category, detection logic, protocol or network).
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
        temperature: 0.7, // 🔹 balanced randomness
      }),
    });

    const data = await response.json();

    let ideasJson;
    try {
      ideasJson = JSON.parse(data.choices?.[0]?.message?.content || "[]");
    } catch (e) {
      console.error("❌ Failed to parse AI JSON:", e);
      return res.status(500).json({ error: "Invalid AI JSON output" });
    }

    res.status(200).json({ ideas: ideasJson });
  } catch (err) {
    console.error("Error generating ideas:", err);
    res.status(500).json({ error: "Failed to generate ideas" });
  }
}
