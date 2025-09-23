// api/generateIdeas.js
module.exports = async function handler(req, res) {
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

⚠️ Hard rules (must always follow):
- Each output must be JSON only (strict, no commentary).
- Each trap must be a Foundry-friendly repo with:
  • One main Trap contract (implements ITrap, pragma ^0.8.20)
  • One Responder contract (with correct response_function signature, deployable on Remix)
  • A drosera.toml (valid config, no constructor args, response_function matches Responder)
  • A short foundry.toml
  • A short verification guide (2–4 steps)

Contract rules:
- Always import ITrap:  
  \`import {ITrap} from "drosera-contracts/interfaces/ITrap.sol";\`
- Trap contracts must implement:  
  \`function collect() external view override returns (bytes memory);\`  
  \`function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory);\`
- Use \`eventLogFilters()\`, \`setEventLogs()\`, and \`getEventLogs()\` if log-based trap.
- Include \`function version() external pure override returns (string memory)\` returning e.g. "1.0.0".
- No constructors or constructor args. Use setter functions instead.
- Contract names and file names must match the trap idea:  
  Example: "EigenStakeTrap.sol" / "EigenResponder.sol".
- drosera.toml path must match the out artifact:  
  Example: "out/EigenStakeTrap.sol/EigenStakeTrap.json".

Output format (strict JSON array of 3 objects):
[
  {
    "title": "string",
    "network": "string",
    "protocol": "string",
    "summary": "string",
    "files": { "src/<Name>Trap.sol": "string", "src/<Name>Responder.sol": "string" },
    "drosera_toml": "string",
    "foundry_toml": "string",
    "verify": "string"
  }
]
    `,
      },
      {
        role: "user",
        content: `
Create 3 distinct PoC trap projects based on this idea: "{{USER_IDEA}}".

⚠️ Each trap must belong to a different category (pick 3 unique ones):
1. Protocol-specific traps
2. Behavioral / transaction pattern traps
3. Environment / infra traps
4. Access-control traps
5. Timing traps
6. Economic traps
7. Cross-domain / interoperability traps

For each project:
- "title": short trap name
- "network": e.g. Ethereum, Polygon, Arbitrum
- "protocol": e.g. Uniswap, Aave, OpenSea
- "summary": 2–3 sentences explaining what the trap detects and how it triggers
- "files": full Solidity source for trap + responder (no placeholders, no partial snippets)
- "drosera_toml": correct config with response_function matching the Responder
- "foundry_toml": minimal valid foundry.toml
- "verify": 2–4 steps on how to build, test, and validate the trap

Generate exactly 3 unique projects. Do not output Markdown code fences.
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
};
