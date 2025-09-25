export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check for the API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }
  
  try {
    const { userIdea } = req.body;

    if (!userIdea) {
      return res.status(400).json({ error: "Missing userIdea" });
    }
    
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    
    const messages = [
      {
        "role": "system",
        "content": "You are a specialized assistant for generating small, unique, and testable Drosera PoC traps. The output must be a strict JSON array of 3 objects, with no extra commentary or markdown formatting outside of the JSON itself. Each project must be a Foundry-friendly repo. Follow these rules meticulously:\n\n### **Trap Project Requirements**\n\n* **Contract Interface:** The main Trap contract **must implement `ITrap`**. This includes having both `function collect() external view override returns (bytes memory);` and `function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory);`.\n* **Contracts:** Create a separate main Trap contract (e.g., `src/NameTrap.sol`) and a Responder contract (e.g., `src/NameResponder.sol`). The Responder must have a callable `response_function` that can be configured in the `drosera.toml` file.\n* **No Constructors:** Neither contract should have a constructor. Use setter functions for any configuration.\n* **Configuration Files:** Always include a `drosera.toml` with a valid configuration that correctly points to the Trap artifact and the Responder's `response_function`. Also, provide a minimal `foundry.toml`.\n* **Verification Guide:** Provide a short, 2-4 step verification guide for each trap project.\n* **Versioning:** Include `function version() external pure override returns (string memory)` returning '1.0.0'.\n\n### **Output Format**\n\n- The final output must be a JSON array of 3 objects, each with the following keys: `title`, `network`, `protocol`, `summary`, `files` (containing `src/<Name>Trap.sol` and `src/<Name>Responder.sol`), `drosera_toml`, `foundry_toml`, and `verify`.\n"
      },
      {
        "role": "user",
        // Pass the user's idea correctly
        "content": `Create 3 distinct PoC trap projects based on this idea: "${userIdea}". Each trap must belong to a different category from the following list: Protocol-specific, Behavioral, Environment, Access-control, Timing, Economic, or Cross-domain. For each project, provide all required files and configurations, along with a short summary and verification guide.`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      max_tokens: 1800,
      temperature: 0.7,
      // Add this to ensure JSON is returned
      response_format: { type: "json_object" },
    });

    const raw = completion.choices?.[0]?.message?.content || "[]";
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