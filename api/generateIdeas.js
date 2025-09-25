// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    // ✅ make sure this is before we build the prompt
    const { userIdea } = req.body || {};
    if (typeof userIdea !== "string" || !userIdea.trim()) {
      return res.status(400).json({ error: "Missing userIdea" });
    }

    const messages = [
      {
        role: "system",
        content: `
You generate EXACTLY 3 distinct Drosera Trap ideas as a strict JSON array (no markdown, no commentary).
Each idea object MUST have:
- "title": short name
- "category": one of ["Protocol-specific","Behavioral","Environment","Access-control","Timing","Economic","Cross-domain"]
- "summary": 1–2 sentences
- "solidity_file_name": e.g. "src/MyTrap.sol"
- "solidity_file": the COMPLETE Solidity source file as a plain string (no markdown fences, no explanations).

REFERENCE CONTRACT (copy this structure exactly; only change constants and logic to match the idea):

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ITrap.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract MyTrap is ITrap {
    address public constant TOKEN = 0x0000000000000000000000000000000000000000;
    address public constant POOL  = 0x0000000000000000000000000000000000000000;

    struct CollectOutput {
        uint256 tokenBalance;
    }

    constructor() {}

    function collect() external view override returns (bytes memory) {
        uint256 bal = IERC20(TOKEN).balanceOf(POOL);
        return abi.encode(CollectOutput({tokenBalance: bal}));
    }

    function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory) {
        CollectOutput memory current = abi.decode(data[0], (CollectOutput));
        CollectOutput memory past = abi.decode(data[data.length - 1], (CollectOutput));
        if (past.tokenBalance == 0) return (false, bytes(""));
        uint256 drop = ((past.tokenBalance - current.tokenBalance) * 1e18) / past.tokenBalance;
        if (drop > 1e17) return (true, bytes(""));
        return (false, bytes(""));
    }
}

HARD RULES:
- pragma solidity ^0.8.20
- Must implement exactly: collect() external view returns (bytes memory); shouldRespond(bytes[] calldata) external pure returns (bool, bytes memory);
- Constructor must exist but take NO arguments (hardcode constants/thresholds).
- Always define and encode/decode a single struct CollectOutput.
- shouldRespond(): data[0] = latest, data[data.length-1] = oldest.
- No external libraries other than optional inline IERC20.
- No responder functions or extra files.
`
      },
      {
        role: "user",
        content: `Base idea/context: "${userIdea}". Return 3 DIFFERENT categories. Keep Solidity minimal and Foundry-friendly.`
      }
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 2400,
        messages
      })
    });

    const data = await response.json();
    let raw = data.choices?.[0]?.message?.content || "[]";

    // 🛡️ strip accidental code fences
    raw = raw.replace(/```json/g, "").replace(/```/g, "").trim();

    let ideas;
    try {
      ideas = JSON.parse(raw);
      if (!Array.isArray(ideas) || ideas.length !== 3) {
        throw new Error("Expected a JSON array with exactly 3 ideas");
      }
      for (const it of ideas) {
        if (!it.title || !it.solidity_file_name || !it.solidity_file) {
          throw new Error("Idea missing required fields");
        }
      }
    } catch (err) {
      console.error("Invalid AI JSON (ideas):", err, raw);
      return res.status(500).json({ error: "Invalid AI JSON output", raw });
    }

    return res.status(200).json({ ideas });
  } catch (err) {
    console.error("Error generating ideas:", err);
    return res.status(500).json({ error: "Failed to generate ideas" });
  }
}
