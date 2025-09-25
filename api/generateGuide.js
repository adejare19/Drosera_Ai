export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: "Missing OPENAI_API_KEY" });

  try {
    const { idea } = req.body || {};
    if (!idea) return res.status(400).json({ error: "Missing idea" });

    const messages = [
      {
        role: "system",
        content: `You output ONLY a strict JSON object: {"steps":[{ "title": string, "description": string, "code"?: string }...]}
No markdown, no commentary.

Goal: a concise Foundry setup guide for a single Drosera Trap (Trap-only).

Trap HARD RULES:
- One file (e.g. src/MyTrap.sol), pragma solidity ^0.8.20;
- Implements exactly: collect() external view returns (bytes memory); shouldRespond(bytes[] calldata) external pure returns (bool, bytes memory);
- Constructor: NO args; hardcode constants/thresholds.
- Define struct CollectOutput; collect() returns abi.encode(CollectOutput(...)).
- shouldRespond(): decode data[0] latest, data[data.length-1] oldest; deterministic threshold check.
- No external libs; only import "./ITrap.sol"; and inline IERC20 if needed.
- No responders.

Guide must:
1) Init Foundry project (forge init)
2) Create src/MyTrap.sol (include full code in "code")
3) (Optional) edit foundry.toml if needed
4) Build/test commands
5) Mention ITrap.sol placement.`
      },
      {
        role: "user",
        content: `Create the step-by-step guide for the trap idea: "${idea}".`
      }
    ];

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json" },
        temperature: 0.6,
        max_tokens: 2600,
        messages
      })
    });

    const data = await r.json();
    let raw = data.choices?.[0]?.message?.content || "{}";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let guide;
    try {
      guide = JSON.parse(raw);
      if (!guide?.steps || !Array.isArray(guide.steps)) throw new Error("Missing steps[]");
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
