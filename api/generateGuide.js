// api/generateGuide.js
import OpenAI from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Check for the API key
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  try {
    const { idea } = req.body;
    if (!idea) {
      return res.status(400).json({ error: "Missing idea" });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `
You are a highly specialized Drosera setup assistant. Your task is to take a trap idea and reliably generate a comprehensive, step-by-step Foundry guide. Your output must be a single, strict JSON object with a 'steps' array, and no extra commentary or markdown formatting outside the JSON itself.

### **Guide Requirements**

* **Workflow:** The guide must follow a logical flow: project initialization, contract coding, configuration, and verification.
* **Essential Commands:** Use standard Foundry commands like 'forge init', 'forge build', and 'forge test'. For Drosera-specific actions, use 'drosera apply'.
* **Correct Code:** The generated Solidity code must be minimal but valid, strictly following the provided 'ITrap' interface.

### **Reference Code (Must Be Followed Exactly)**

**ITrap Interface:**
\`\`\`solidity
function collect() external view returns (bytes memory);
function shouldRespond(bytes[] calldata data) external pure returns (bool, bytes memory);
\`\`\`

**Trap Contract Template (src/ExampleTrap.sol):**
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITrap} from "drosera-contracts/interfaces/ITrap.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// This is the core contract. It must be named '<YourTrapName>Trap.sol'
contract ExampleTrap is ITrap {
    // Add state variables and addresses here

    constructor() {
        // No arguments allowed. Initialize state with hardcoded values.
    }

    function collect() external view override returns (bytes memory) {
        // Your logic to collect on-chain data
        return abi.encode(...);
    }

    function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory) {
        // Your logic to evaluate the collected data
        return (false, bytes(""));
    }
}
\`\`\`

**Responder Contract Template (src/ExampleResponder.sol):**
\`\`\`solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ExampleResponder {
    function respond(uint256 blockNumber) external {
        // Logic to respond to the trap
    }
}
\`\`\`
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Generate a step-by-step Foundry setup guide for this trap idea: "${idea}". The guide must include a valid 'drosera.toml' configuration and the correct code for a Trap and Responder contract.`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1800,
    });

    const guideContent = completion.choices?.[0]?.message?.content || "{}";
    let parsed;

    try {
      parsed = JSON.parse(guideContent);
    } catch (err) {
      console.error("Parse error:", err, guideContent);
      return res.status(500).json({ error: "Invalid AI JSON", raw: guideContent });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    console.error("Error in generateGuide:", err);
    res.status(500).json({ error: "Failed to generate guide" });
  }
}