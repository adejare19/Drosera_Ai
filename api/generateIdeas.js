// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userIdea } = req.body || {};
    if (!userIdea) return res.status(400).json({ error: "Missing userIdea" });

    const messages = [
      {
        role: "system",
        content:
`You generate EXACTLY 3 distinct Drosera Trap ideas as a strict JSON array (no markdown).
Each idea object MUST have:
- "title": short name
- "category": one of ["Protocol-specific","Behavioral","Environment","Access-control","Timing","Economic","Cross-domain"]
- "summary": 1–2 sentences
- "solidity_file_name": e.g. "src/MyTrap.sol"
- "solidity_file": COMPLETE Solidity source implementing ITrap with:
    pragma solidity ^0.8.20;
    interface IERC20 { function balanceOf(address) external view returns (uint256); }
    interface ITrap {
      function collect() external view returns (bytes memory);
      function shouldRespond(bytes[] calldata data) external pure returns (bool, bytes memory);
    }
    // OPTIONAL: version() if you want, but DO NOT add responder functions.
  RULES:
  - Include a constructor with NO arguments for initializing constants/thresholds.
  - collect(): view-only, ABI-encodes a single struct (e.g., CollectOutput) and returns it.
  - shouldRespond(): pure, decodes data[0] (current) and data[data.length-1] (past), compares with deterministic thresholds.
  - Use hardcoded addresses/thresholds as constants where needed.
  - Avoid dynamic heuristics, external libs, or responders.
  - DO NOT output anything outside the JSON array.`
      },
      {
        role: "user",
        content:
`Base idea context: "${userIdea}".
Return 3 DIFFERENT categories. Keep logic simple & testable (e.g., % balance drop, invariant drift, timing windows).`
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
        max_tokens: 1800,
        messages
      }),
    });

    const data = await r.json();
    let raw = data.choices?.[0]?.message?.content || "[]";
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let ideas;
    try {
      ideas = JSON.parse(raw);
      if (!Array.isArray(ideas) || ideas.length !== 3) throw new Error("Expected array of 3 ideas");
    } catch (err) {
      console.error("Invalid AI JSON:", err, raw);
      return res.status(500).json({ error: "Invalid AI JSON", raw });
    }

    return res.status(200).json({ ideas });
  } catch (err) {
    console.error("Error generating ideas:", err);
    return res.status(500).json({ error: "Failed to generate ideas" });
  }
}
