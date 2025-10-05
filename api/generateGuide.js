export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }
let baseUrl;

if (process.env.NEXT_PUBLIC_API_URL) {
  // Assume it's a full URL like "https://myapp.com"
  baseUrl = process.env.NEXT_PUBLIC_API_URL;
} else {
  const protocol = req?.headers?.['x-forwarded-proto'] || 'http';
  const host = req?.headers?.host || 'localhost:3000';
  baseUrl = `${protocol}://${host}`;
}

const testApiUrl = `${baseUrl}/api/generateTest`;

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
**STRICT OUTPUT RULE:** You MUST output ONLY a strict JSON object: {"steps":[{ "title": string, "description": string, "sub_steps": [ { "block_title": string, "code": string, "description"?: string } ] }]}. DO NOT INCLUDE ANY MARKDOWN FENCES, COMMENTARY, OR TEXT OUTSIDE THE JSON OBJECT.

Goal: A complete, self-contained, 5-phase guide for a user on a fresh VPS to deploy a full Drosera Trap project.

Trap HARD RULES:
- Trap contract name: MUST be derived from the idea, e.g., 'LiquidityTrap'.
- Trap code MUST use the correct import: import {ITrap} from "contracts/interfaces/ITrap.sol";
- Responder contract: MUST be named SimpleResponder and use respondCallback(uint256).
- All Solidity code MUST use pragma solidity ^0.8.20.
- CRITICAL LOGIC RULE: If the trap monitors a token or external contract (e.g., price, balance, liquidity), the generated 'address public constant TOKEN' (or equivalent) MUST use the **Dexter Token** address: 0xFba1bc0E3d54D71Ba55da7C03c7f63D4641921B1.
- CRITICAL JSON RULE: ALL string values, especially those containing code, must have internal double quotes ESCAPED as \\" and must NOT contain any unescaped backslashes or newlines.

// The Guide must contain these exact 5 phases in order, with the required blocks:

1) **Phase 1: Environment & Project Setup**
    - Description MUST cover prerequisites and initialization.
    - MUST include 3 sub_steps: 'Install Required Tools', 'Initialize Project Directory', and 'Install Dependencies'.
2) **Phase 2: Responder Contract Deployment**
    - Description MUST explain the Responder's role and the need to capture its address.
    - MUST include 2 sub_steps: 'Create SimpleResponder.sol' and 'Build & Deploy Responder (Capture Address)'.
3) **Phase 3: Trap Contract & Configuration**
    - Description MUST focus on creating the unique Trap file and its configuration.
    - MUST include 3 sub_steps: 'Create src/{{TrapName}}.sol', 'Create drosera.toml Configuration', and 'Edit foundry.toml (Remappings/RPC)'.
4) **Phase 4: Final Deployment & Operator Setup**
    - Description MUST cover the final deployment, registration, and activation steps.
    - MUST include 3 sub_steps: 'Build & Deploy Trap (drosera apply)', 'Operator Registration (Separate Wallet)', and 'Operator Opt-In (Activate Monitoring)'.
5) **Phase 5: Documentation & Finalization**
    - Description MUST cover the final step to activate monitoring and view the README.
    - MUST include 2 sub_steps: 'Finalize Operator Service (Reload)' and 'Create README.md Documentation'.


---

// The following blocks MUST be used to populate the 'code' properties within the sub_steps:

// Code Block for: 'Install Required Tools'
cd ~
# Drosera CLI
curl -L https://app.drosera.io/install | bash
source ~/.bashrc
droseraup

# Foundry CLI
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# Bun (JavaScript runtime)
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc


// Code Block for: 'Initialize Project Directory' (MUST use the name derived from the idea)
mkdir {{DerivedProjectName}}
cd {{DerivedProjectName}}
forge init


// Code Block for: 'Install Dependencies'
forge install https://github.com/drosera-network/contracts


// Code Block for: 'Create SimpleResponder.sol'
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


// Code Block for: 'Build & Deploy Responder (Capture Address)'
forge build
# CRITICAL FIX: Single-line command with --broadcast and corrected RPC. CAPTURE THIS ADDRESS.
forge create src/SimpleResponder.sol:SimpleResponder --rpc-url https://rpc.hoodi.ethpandaops.io --private-key YOUR_FUNDED_PRIVATE_KEY --broadcast


// Code Block for: 'Create src/{{TrapName}}.sol'
cd src
nano {{TrapName}}.sol
# Paste the Solidity code below into the nano editor, then save (Ctrl+X, Y, Enter).

// The AI MUST inject the full Solidity code here using the code provided in the user's request, ensuring it starts with pragma solidity ^0.8.20; and import {ITrap} from "contracts/interfaces/ITrap.sol";

cd ..


// Code Block for: 'Create drosera.toml Configuration'
nano drosera.toml
# Paste the TOML configuration below into the nano editor, then save (Ctrl+X, Y, Enter).

ethereum_rpc = "https://rpc.hoodi.ethpandaops.io"
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


// Code Block for: 'Edit foundry.toml (Remappings/RPC)'
nano foundry.toml
# Paste the content below into the nano editor, then save (Ctrl+X, Y, Enter).

[profile.default]
out = 'out'
src = 'src'
libs = ['lib']

# Set the compiler version to match the contracts' requirements
solc = '0.8.20'

# CRITICAL FIX: The remappings are essential for the import path
remapping = [
    'contracts/=lib/contracts/contracts/',
    'forge-std/=lib/forge-std/src/'
]

[rpc_endpoints]
hoodi = "https://rpc.hoodi.ethpandaops.io"


// Code Block for: 'Build & Deploy Trap (drosera apply)'
# 1. Ensure the final Trap contract is built
forge build

# 2. Deploy the Trap using Drosera CLI (Replace YOUR_FUNDED_PRIVATE_KEY)
# NOTE: If you get TrapCreationLimitReached, the network is busy. Wait and retry.
DROSERA_PRIVATE_KEY=YOUR_FUNDED_PRIVATE_KEY drosera apply


// Code Block for: 'Operator Registration (Separate Wallet)'
# This is for a separate Operator wallet. Replace YOUR_OPERATOR_PRIVATE_KEY.
# This step can be skipped if your wallet is already registered.
drosera-operator register --eth-rpc-url https://rpc.hoodi.ethpandaops.io --eth-private-key YOUR_OPERATOR_PRIVATE_KEY --drosera-address 0x91cB447BaFc6e0EA0F4Fe056F5a9b1F14bb06e5D


// Code Block for: 'Operator Opt-In (Activate Monitoring)'
# Link your registered Operator wallet to the newly deployed Trap.
# Replace YOUR_OPERATOR_PRIVATE_KEY and YOUR_DEPLOYED_TRAP_ADDRESS.
drosera-operator optin --eth-rpc-url https://rpc.hoodi.ethpandaops.io --eth-private-key YOUR_OPERATOR_PRIVATE_KEY --trap-config-address 0x{{TrapAddress}}


// Code Block for: 'Finalize Operator Service (Reload)'
# The Operator service must be restarted/reloaded to recognize the new opt-in configuration.
# Use 'pm2 reload drosera-operator' or 'sudo systemctl restart drosera-operator' depending on your setup.
echo "Monitoring is now active. If you are running the operator service,"
echo "RESTART/RELOAD it now (e.g., pm2 reload drosera-operator) to begin watching this trap."


// Code Block for: 'Create README.md Documentation'
nano README.md
# Paste the Markdown content below into the nano editor, then save (Ctrl+X, Y, Enter).

# {{TrapName}} (Drosera Proof-of-Concept)

## Overview
// The AI MUST generate a 2-3 sentence, well-written description of what this specific trap monitors and why it's critical.
{{OverviewProse}} 

---

## What It Does
* {{SpecificBehavior1}} // e.g., "Monitors the Uniswap V3 price for DAI/WETH."
* {{SpecificBehavior2}} // e.g., "Triggers if the price deviates by more than 1% from the last confirmed reading."
* It demonstrates the essential Drosera trap pattern using deterministic logic.

---

## Key Files
* \`src/{{TrapName}}.sol\` - The core trap contract containing the monitoring logic.
* \`src/SimpleResponder.sol\` - The required external response contract.
* \`drosera.toml\` - The deployment and configuration file.

---

## Detection Logic

The trap's core monitoring logic is contained in the deterministic \`shouldRespond()\` function.

\`\`\`solidity
// The AI MUST insert the full, syntax-highlighted Solidity code of the \`shouldRespond()\` logic here.
{{ShouldRespondLogic}} 
\`\`\`

---

## 🧪 Implementation Details and Key Concepts
* **Monitoring Target:** // The AI MUST detail the exact addresses or data points being watched (e.g., "Watching the price feed at 0x... and the Dex token 0xFba1bc...").
* **Deterministic Logic:** Explains the use of the \`view\` or \`pure\` modifier. This logic is always executed off-chain by operators to achieve consensus before a transaction is proposed.
* **Calculation/Thresholds:** // The AI MUST clearly explain the specific calculation (e.g., "Uses a fixed 5% deviation threshold") that drives the \`shouldRespond()\` function.
* **Response Mechanism:** On trigger, the trap calls the external Responder contract, demonstrating the separation of monitoring and action.

---

## Test It
To verify the trap logic using Foundry, run the following command (assuming a test file has been created):

\`\`\`bash
forge test --match-contract {{TrapName}}
\`\`\`
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