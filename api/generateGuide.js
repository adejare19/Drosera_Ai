export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }
  // Assume NEXT_PUBLIC_API_URL is set in your environment (e.g., http://localhost:3000)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || req.headers.host;
  const testApiUrl = `${req.headers['x-forwarded-proto'] || 'http'}://${baseUrl}/api/generateTest`;

  try {
    const { idea, title, summary, solidity_file } = req.body || {};
    const ideaText = typeof idea === "string" && idea.trim()
      ? idea.trim()
      : (title || "Unnamed Trap Idea");

    if (!ideaText) return res.status(400).json({ error: "Missing idea" });

    // Use the trap code from the request, or generate a placeholder for the guide prompt to fill in later
    const trapSolidityCode = solidity_file ||
      `// The trap contract code will be inserted here if not provided in the request.
            // For guide generation, the AI should assume the logic follows HARD RULES.`;

    // ====================================================================
    // 1. CALL THE TEST AGENT FIRST (to get the test code to include in the guide)
    // ====================================================================
    let testSolidityCode = '';
    try {
      const testR = await fetch(testApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solidityCode: trapSolidityCode })
      });
      const testData = await testR.json();
      if (testData.testSolidityCode) {
        testSolidityCode = testData.testSolidityCode;
      } else {
        console.error("Test agent failed to return code:", testData.error);
        // Fallback: Use a message instead of failing the whole request
        testSolidityCode = "// ERROR: Could not generate test file. Check /api/generateTest endpoint.";
      }
    } catch (e) {
      console.error("Failed to call gen  erateTest API:", e);
      testSolidityCode = "// ERROR: Failed to communicate with test generation service.";
    }

    // ====================================================================
    // 2. DEFINE THE UPDATED SYSTEM PROMPT FOR GUIDE GENERATION
    // ====================================================================

const systemPrompt = `
**STRICT OUTPUT RULE:** You MUST output ONLY a strict JSON object: {"steps":[{ "title": string, "description": string, "code"?: string }...]}. DO NOT INCLUDE ANY MARKDOWN FENCES (e.g., \`\`\`json), COMMENTARY, OR TEXT OUTSIDE THE JSON OBJECT.

Goal: A complete, 10-step, deployment-ready guide for a single Drosera Trap.

Trap HARD RULES:
- Trap contract name: MUST be derived from the idea, e.g., 'LiquidityPoolMonitoringTrap'.
- Trap implements: collect() and shouldRespond().
- Responder contract: MUST be named SimpleResponder and use respondCallback(uint256).

Guide must contain these exact 10 steps in the following order:

1) Initialize the Project Directory and Foundry Workspace (Use mkdir/cd/forge init commands).
2) Create src/SimpleResponder.sol (Provide the Responder code block).
3) Build the contracts (forge build).
4) Deploy the Responder Contract (Description MUST explain how to run 'forge create' and CAPTURE the address).
5) Create src/ITrap.sol (Provide the ITrap interface code block).
6) Create src/{{TrapName}}.sol (Provide the FULL Trap code block).
7) **Create the drosera.toml configuration file.** (The description MUST instruct the user to paste the address captured in Step 4 into the 'response_contract' field).
8) Edit foundry.toml if needed.
9) Build and Test Commands (Include 'forge test' and the final 'drosera apply').
10) Create the test/{{TrapName}}.t.sol file (Provide the pre-generated test code block: ${testSolidityCode}).

---

// The following blocks must be used for the code properties:

// Step 1 Code Block (MUST use the name derived from the idea, e.g., LiquidityPoolTrap):
\`\`\`bash
mkdir {{DerivedProjectName}}
cd {{DerivedProjectName}}
forge init
\`\`\`

// Step 2 Code Block (SimpleResponder):
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleResponder {
    function respondCallback(uint256 amount) public {
        // PoC: The Trap triggered, the Responder was called.
    }
}
\`\`\`

// Step 5 Code Block (ITrap.sol):
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITrap {
    function collect() external view returns (bytes memory);
    function shouldRespond(bytes[] calldata data) external pure returns (bool, bytes memory);
}
\`\`\`

// Step 7 Code Block (drosera.toml):
// The AI MUST substitute the [traps.key] and the path field using the name it generated for the trap.
// Example: If the trap name is LiquidityPoolMonitoringTrap, the path is "out/LiquidityPoolMonitoringTrap.sol/LiquidityPoolMonitoringTrap.json"
// The response_contract field MUST be set to "[PASTE_DEPLOYED_RESPONDER_ADDRESS_HERE]".

ethereum_rpc = "https://ethereum-hoodi-rpc.publicnode.com"
drosera_rpc = "https://relay.hoodi.drosera.io"
eth_chain_id = 560048
drosera_address = "0x91cB447BaFc6e0EA0F4Fe056F5a9b1F14bb06e5D"

[traps]

[traps.{{derived_trap_key}}]
path = "out/{{TrapName}}.sol/{{TrapName}}.json"
response_contract = "[PASTE_DEPLOYED_RESPONDER_ADDRESS_HERE]" 
response_function = "respondCallback(uint256)" 
cooldown_period_blocks = 33
min_number_of_operators = 1
max_number_of_operators = 2
block_sample_size = 10
private_trap = true
whitelist = []

// The code block for Step 6 must contain the full Trap contract code generated based on the idea.
// The code block for Step 10 must contain the pre-generated test code provided in the prompt.
`;

    const userContent = solidity_file
      ? `Create the step-by-step guide for the trap idea: "${ideaText}". The guide's Solidity contract must be this exact code:
\`\`\`solidity
${trapSolidityCode}
\`\`\``
      : `Create the step-by-step guide for the trap idea: "${ideaText}".`;

    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent }
    ];

    // 3. Call the OpenAI API to generate the GUIDE
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.5,
        max_tokens: 2600,
        messages
      })
    });

    const data = await r.json();
    let raw = data.choices?.[0]?.message?.content || "{}";

    // 🛡️ Robust JSON parsing and sanitation (as before)
    raw = raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let guide;
    try {
      guide = JSON.parse(raw);
    } catch (err) {
      console.error("Attempting to fix malformed JSON:", raw);
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch && jsonMatch[0]) {
        try {
          guide = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error("Failed to parse fallback JSON:", e);
          return res.status(500).json({ error: "Invalid AI JSON output", raw });
        }
      } else {
        console.error("No JSON object found in raw output.");
        return res.status(500).json({ error: "Invalid AI JSON output", raw });
      }
    }

    if (!guide?.steps || !Array.isArray(guide.steps)) {
      console.error("Parsed object is missing 'steps' array.", guide);
      return res.status(500).json({ error: "Invalid guide structure" });
    }

    return res.status(200).json({ guide });
  } catch (err) {
    console.error("Error in generateGuide:", err);
    return res.status(500).json({ error: "Failed to generate guide" });
  }
}