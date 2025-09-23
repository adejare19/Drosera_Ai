// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { idea, mode = "foundry" } = req.body;

    const basePrompt =
`You are an assistant that generates **Drosera PoC traps**. 
Always output valid JSON only — no prose, no markdown.

For mode = "foundry":
- Return a JSON array of exactly 3 objects.
- Each object must include:
  - "title" (string)
  - "network" (string)
  - "protocol" (string)
  - "category" (string: one of Protocol-specific, Behavioral/transaction-pattern, Environment/infra, Access-control, Cross-domain/interoperability)
  - "summary" (string, 2–3 sentences)
  - "files" (object: filename -> full file content string, must include Trap.sol + Response.sol)
  - "drosera_toml" (string, full toml)
  - "foundry_toml" (string, minimal toml)
  - "verify" (string with 2–4 steps)
- All contracts must use pragma solidity ^0.8.20, import Drosera ITrap, no constructor args.
- Each project must be a unique category (no duplicates).
- drosera.toml.response_function must exactly match the Response contract signature.

If idea is supplied ("${idea || ""}"), use it to inspire one of the traps.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You must return valid JSON only. Never wrap it in markdown." },
          { role: "user", content: basePrompt },
        ],
        temperature: 0.5,
        max_tokens: 2800,
        stop: ["```"], // prevent markdown wrapping
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API error");
    }

    const raw = data.choices?.[0]?.message?.content?.trim();
    console.log("RAW MODEL OUTPUT:", raw); // 👈 log to inspect

    let projects = [];
    try {
      projects = JSON.parse(raw);
    } catch (err) {
      console.error("JSON parse failed:", err);
      return res.status(500).json({
        error: "Model did not return valid JSON",
        rawOutput: raw, // return raw so you can debug client-side
      });
    }

    res.status(200).json({ projects });
  } catch (err) {
    console.error("Error generating PoC traps:", err);
    res.status(500).json({ error: "Failed to generate PoC traps" });
  }
}
