// api/generateGuide.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { idea } = req.body || {};
    if (!idea) return res.status(400).json({ error: "Missing idea" });

    const messages = [
      {
        role: "system",
        content:
`You output ONLY a JSON object: {"steps":[{ "title": string, "description": string, "code"?: string }...]}
No markdown fences. Keep it concise, deterministic.
The guide MUST:
1) Init Foundry project (forge init).
2) Add a minimal ITrap + IERC20 inline or explain they already exist—BUT include final file content for the Trap in a single file (e.g., src/MyTrap.sol).
3) Write the Trap file content (complete, compilable).
4) Configure foundry.toml minimally if needed.
5) Build and (optionally) show a minimal test that decodes the bytes and asserts structure.
Rules for the Trap:
- pragma solidity ^0.8.20;
- interface ITrap { collect() external view returns (bytes memory); shouldRespond(bytes[] calldata) external pure returns (bool, bytes memory); }
- constructor() NO args, initialize constants/thresholds.
- collect(): view, return abi.encode(CollectOutput{...});
- shouldRespond(): pure, decode data[0] and data[data.length-1], do a simple threshold comparison, return (true/false, bytes("")).
- No responder functions. No external libraries.
- Keep addresses/thresholds hardcoded constants.`
      },
      {
        role: "user",
        content:
`Create a step-by-step Foundry setup guide for trap idea: "${idea}". Output ONLY the JSON object with steps.`
      }
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 1600,
        messages
      }),
    });

    const data = await r.json();
    let raw = data.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let guide;
    try {
      guide = JSON.parse(raw);
      if (!guide.steps || !Array.isArray(guide.steps)) throw new Error("Missing steps[]");
    } catch (err) {
      console.error("Invalid AI JSON (guide):", err, raw);
      return res.status(500).json({ error: "Invalid AI JSON", raw });
    }

    return res.status(200).json({ guide });
  } catch (err) {
    console.error("Error in generateGuide:", err);
    return res.status(500).json({ error: "Failed to generate guide" });
  }
}
