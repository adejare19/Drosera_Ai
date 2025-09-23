// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { idea } = req.body;

    const basePrompt = `
You are an assistant that generates **small, unique, testable Drosera PoC traps**. 
Each output must be a self-contained PoC repository (Foundry-friendly).

⚡ Hard rules:
- Return JSON only (no prose, no markdown).
- JSON array must contain exactly 3 objects.
- Each object must be a unique trap PoC project.
- Each project must include:
  - \`title\` (short string)
  - \`network\` (string, e.g. Ethereum, Polygon, Arbitrum)
  - \`protocol\` (string, e.g. Uniswap, Aave, OpenSea)
  - \`category\` (one of: Protocol-specific, Behavioral/transaction-pattern, Environment/infra, Access-control, Cross-domain/interoperability)
  - \`summary\` (2–3 sentences describing attack scenario + trigger + response)
  - \`files\` (object: filename -> full file content string)
    * Must include at least: \`src/<TrapName>.sol\` and \`src/<ResponseName>.sol\`.
    * Solidity contracts must use pragma ^0.8.20, import Drosera ITrap, and have no constructor args.
  - \`drosera_toml\` (full valid toml string with correct response_function signature)
  - \`foundry_toml\` (minimal valid toml string)
  - \`verify\` (string: 2–4 steps to test locally with Foundry)

Constraints:
- All 3 projects must use **different categories**.
- No constructor arguments; use setter functions if config is needed.
- Filenames must match contract names.
- drosera.toml must include:
  * correct \`path\` (e.g. "out/<File>.sol/<Contract>.json")
  * \`response_contract\` placeholder
  * \`response_function\` string that exactly matches Response contract’s function.
- Code should be small, PoC-level, and compile.

If the user supplied an idea ("${idea || ""}"), use it to inspire one of the traps.
    `;

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
            content:
              "You are an AI that generates Drosera Foundry-ready trap PoC repos in JSON only.",
          },
          { role: "user", content: basePrompt },
        ],
        temperature: 0.5,
        max_tokens: 2500,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API error");
    }

    let projects = [];
    const raw = data.choices?.[0]?.message?.content?.trim() || "";

    try {
      projects = JSON.parse(raw);
    } catch (e) {
      console.error("Parse error, raw output:", raw);
      throw new Error("Model did not return valid JSON");
    }

    res.status(200).json({ projects });
  } catch (err) {
    console.error("Error generating PoC traps:", err);
    res.status(500).json({ error: "Failed to generate PoC traps" });
  }
}
