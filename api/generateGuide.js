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
**STRICT OUTPUT RULE:** You MUST output ONLY a strict JSON object: {"steps":[{ "title": string, "description": string, "code"?: string }...]}. DO NOT INCLUDE ANY MARKDOWN FENCES, COMMENTARY, OR TEXT OUTSIDE THE JSON OBJECT.

Goal: A complete, self-contained, 12-step guide for a user on a fresh VPS to deploy a full Drosera Trap project (Trap + Responder + Documentation).

Trap HARD RULES:
- Trap contract name: MUST be derived from the idea, e.g., 'PriceSpikeTrap'.
- Trap code MUST use the official import: import {ITrap} from "drosera-contracts/interfaces/ITrap.sol";
- Responder contract: MUST be named SimpleResponder and use respondCallback(uint256).
- All Solidity code MUST use pragma solidity ^0.8.20.

Guide must contain these exact 12 steps in the following order:

1) **Install All Prerequisites (Drosera CLI, Foundry CLI, Bun).** (This is a single step containing all installation commands).
2) Initialize the Project Directory and Foundry Workspace (Use mkdir/cd/forge init commands).
3) **Install Drosera Dependency.** (Use the forge install command for 'drosera-contracts').
4) Create src/SimpleResponder.sol (Provide the Responder code block).
5) Build the contracts (forge build).
6) **Deploy the Responder Contract.** (Description MUST explain how to run 'forge create' and CAPTURE the address).
7) Create src/{{TrapName}}.sol (Provide the FULL Trap code block, including the official import).
8) **Create the drosera.toml configuration file.** (The description MUST instruct the user to paste the address captured in Step 6 into the 'response_contract' field).
9) Edit foundry.toml (for solc version and lib paths if necessary).
10) Build and Test Commands (Include 'forge test' and the final 'drosera apply').
11) Create the test/{{TrapName}}.t.sol file (Provide the pre-generated test code block: \\\${testSolidityCode}).
12) **Create the README.md file.** (Provide the full ReadMe content for this specific trap).

---

// The following blocks MUST be used for the 'code' properties:

// Step 1 Code Block (Installation):
cd ~
# Drosera CLI
curl -L https://app.drosera.io/install | bash
source ~/.bashrc
droseraup

# Foundry CLI (Solidity development)
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# Bun (JavaScript runtime - required for some Drosera tools)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

// Step 2 Code Block (MUST use the name derived from the idea, e.g., LiquidityPoolTrap):
mkdir {{DerivedProjectName}}
cd {{DerivedProjectName}}
forge init

// Step 3 Code Block (Drosera Install):
forge install https://github.com/drosera-network/drosera-contracts

// The description for Step 3 MUST contain the following content:
/* Now that you've initialized your project, install the official drosera-contracts library. This package contains the necessary ITrap.sol interface your contract will inherit, ensuring full official compliance. 
⚠️ Authentication Warning (READ THIS): When you run this command, Git may prompt you for a Username and Password for https://github.com. You MUST use a **Personal Access Token (PAT)** as the password, not your regular GitHub login password. 
Where to find the PAT: If you don't have one, you must generate one in your GitHub Settings → Developer settings → Personal access tokens. Ensure the token has the \`repo\` scope enabled. Copy the token immediately and paste it into the terminal when prompted for the password. */


// Step 4 Code Block (SimpleResponder):
cd src
nano SimpleResponder.sol
# Paste the Solidity code below into the nano editor, then save (Ctrl+X, Y, Enter).

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleResponder {
    function respondCallback(uint256 amount) public {
        // PoC: The Trap triggered, the Responder was called.
    }
}

cd ..


// Step 6 Code Block (Deploy Responder)
# CRITICAL FIX: Single-line command with --broadcast and corrected RPC
forge create src/SimpleResponder.sol:SimpleResponder --rpc-url https://rpc.ankr.com/eth_hoodi/efcdb71bacc948ca157b2f646789f6e765d94fe715147b1c2f132edf928b4333 --private-key YOUR_FUNDED_PRIVATE_KEY --broadcast


// Step 7 Code Block (The FULL Trap contract with the official import)
cd src
nano {{TrapName}}.sol
# Paste the Solidity code below into the nano editor, then save (Ctrl+X, Y, Enter).

// The AI MUST inject the full Solidity code here using the code provided in the user's request, ensuring it starts with pragma solidity ^0.8.20; and import {ITrap} from "drosera-contracts/interfaces/ITrap.sol";

cd ..


// Step 8 Code Block (drosera.toml):
nano drosera.toml
# Paste the TOML configuration below into the nano editor, then save (Ctrl+X, Y, Enter).

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


// Step 9 Code Block (foundry.toml):
nano foundry.toml
# Change the 'solc' version and ensure remappings are correctly set
# Paste the content below into the nano editor, then save (Ctrl+X, Y, Enter).

[profile.default]
out = 'out'
src = 'src'
libs = ['lib']

# Set the compiler version to match the contracts' requirements
solc = '0.8.20'

# CRITICAL FIX: The remappings are essential for the original import path to resolve
remapping = [
    'drosera-contracts/=lib/drosera-contracts/contracts/',
    'forge-std/=lib/forge-std/src/'
]

[rpc_endpoints]
hoodi = "https://ethereum-hoodi-rpc.publicnode.com"


// Step 10 Code Block (Build and Deploy):
# 1. Build the final Trap contract
forge build

# 2. Deploy the Trap using Drosera CLI (Replace YOUR_FUNDED_PRIVATE_KEY)
# NOTE: If you get TrapCreationLimitReached, the network is busy. Wait and retry.
DROSERA_PRIVATE_KEY=YOUR_FUNDED_PRIVATE_KEY drosera apply


// Step 11 Code Block (Test Code):
cd test
nano {{TrapName}}.t.sol
# Paste the Test code below into the nano editor, then save (Ctrl+X, Y, Enter).

\\\${testSolidityCode}

cd ..


// Step 12 Code Block (README.md):
nano README.md
# Paste the Markdown content below into the nano editor, then save (Ctrl+X, Y, Enter).

#  {{TrapName}} (Drosera PoC)

This project contains a Proof-of-Concept (PoC) Drosera Trap built using Foundry, designed to monitor a specific on-chain condition related to {{DerivedProjectName}}. This trap adheres to all recommended standards for deterministic execution and low-cost data collection.

## Trap Logic and Best Practices

1.  **Cheap Execution (\`collect()\`):** Focuses on reading only the single, crucial data point required for the check (e.g., DEX reserves).
2.  **Deterministic Logic (\`shouldRespond()\`):** Uses the \`pure\` modifier and relies only on historical input data and internal constants, guaranteeing reliability across the Drosera Network.
3.  **Deployment Flow:** Requires a separate Responder contract (\`SimpleResponder.sol\`) to be deployed first, which acts as the recipient of the trigger.

## 🛠️ Requirements & Setup

This guide provides the full solution, including prerequisite installation. Follow the steps exactly. This project requires **Foundry CLI**, **Drosera CLI**, and **Bun** to run successfully.
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