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
You output ONLY a strict JSON object: {"steps":[{ "title": string, "description": string, "code"?: string }...]}
No markdown, no commentary, no code fences.

Goal: A complete, step-by-step Foundry setup guide for a single Drosera Trap (Trap-only) that is 100% resilient and functional.

Trap HARD RULES:
- One file (e.g. src/MyTrap.sol), pragma solidity ^0.8.20;
- Implements exactly: function collect() external view returns (bytes memory); function shouldRespond(bytes[] calldata data) external pure returns (bool, bytes memory);
- Constructor: NO args; hardcode constants/thresholds.
- Define struct CollectOutput; collect() returns abi.encode(CollectOutput(...)).
- shouldRespond(): decode data[0] latest, data[data.length-1] oldest; deterministic threshold check.
- No external libs; only import "./ITrap.sol"; inline IERC20 if needed.
- No responders.

Guide must contain these exact steps in order, using the actual code we discussed:

1) Init Foundry project (forge init)

2) Create src/ITrap.sol. The code block for this step **must** contain this exact interface content:

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITrap {
    function collect() external view returns (bytes memory);
    function shouldRespond(bytes[] calldata data) external pure returns (bool, bytes memory);
}

3) Create src/MyTrap.sol (include the FULL contract in "code")

4) **Create the drosera.toml configuration file.** The code block for this step **must** contain the following exact TOML structure, substituting 'my_trap' with a concise, derived name:

ethereum_rpc = "https://ethereum-hoodi-rpc.publicnode.com"
drosera_rpc = "https://relay.hoodi.drosera.io"
eth_chain_id = 560048
drosera_address = "0x91cB447BaFc6e0EA0F4Fe056F5a9b1F14bb06e5D"

[traps]

[traps.my_trap]
# The path to your compiled contract's JSON file
path = "out/MyTrap.sol/MyTrap.json"
# Replace with the address of your response contract
response_contract = "0xRESPONSE_CONTRACT_ADDRESS_GOES_HERE"
# Replace with the function signature of your response contract
response_function = "responseCallback(uint256)" 
cooldown_period_blocks = 33
min_number_of_operators = 1
max_number_of_operators = 2
block_sample_size = 10
private_trap = true
whitelist = []

5) Edit foundry.toml if needed (e.g., adding a specific Solidity version).

6) **Build and Test Commands** (include 'forge build' and 'forge test').

7) **(CRITICAL FINAL STEP)** Create the **test/MyTrap.t.sol** file. The code block for this step **must** contain the pre-generated test code below:
${testSolidityCode}

8) **Troubleshooting Deployment Failure** (Essential). This step should provide advice for when 'drosera apply' fails, including:
    - Checking that the **private key is exported** (or in the TOML) and is correct.
    - Confirming the deployment wallet has **Hoodi ETH** (gas/faucet).
    - Double-checking the **trap path** in drosera.toml matches the compiled JSON (e.g., out/MyTrap.sol/MyTrap.json).
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