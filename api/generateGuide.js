// api/generateGuide.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { idea } = req.body;
    if (!idea) {
      return res.status(400).json({ error: "Missing idea" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.6,
        messages: [
          {
            role: "system",
            content: "You are a specialized Drosera setup assistant. Your task is to generate a step-by-step Foundry guide for a trap idea. The output must be a strict JSON object with a single 'steps' array, and no extra commentary or markdown formatting outside the JSON itself.\n\n### **Guide Requirements**\n\n* **Workflow:** The guide must follow a logical flow, including steps for project initialization, contract coding, configuration, and verification.\n* **Essential Commands:** Use standard Foundry commands like `forge init`, `forge build`, and `forge test`. For Drosera-specific actions, use `drosera apply`.\n* **Correct Code:** The generated code for the Trap and Responder contracts must be minimal but valid, strictly following the Drosera `ITrap` interface. Do NOT include constructors with arguments.\n\n### **Reference Code (Must Follow)**\n\n**Trap Contract (`src/ExampleTrap.sol`):**\n```solidity\n// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\nimport {ITrap} from \"drosera-contracts/interfaces/ITrap.sol\";\n\ncontract ExampleTrap is ITrap {\n    function collect() external view override returns (bytes memory) {\n        return abi.encode(block.number);\n    }\n\n    function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory) {\n        uint256 blockNumber = abi.decode(data[0], (uint256));\n        return (blockNumber % 2 == 0, abi.encode(blockNumber));\n    }\n\n    function version() external pure override returns (string memory) {\n        return \"1.0.0\";\n    }\n}\n```\n\n**Responder Contract (`src/ExampleResponder.sol`):**\n```solidity\n// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract ExampleResponder {\n    function respond(uint256 blockNumber) external {\n        // Logic to respond to the trap\n    }\n}\n```\n"
          },
          {
            role: "user",
            content: `Generate a step-by-step Foundry setup guide for trap idea: "${idea}". Include minimal but valid code for Trap + Responder, configs, and verification.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Parse error:", err, raw);
      return res.status(500).json({ error: "Invalid AI JSON", raw });
    }

    return res.status(200).json({ guide: parsed });
  } catch (err) {
    console.error("Error in generateGuide:", err);
    res.status(500).json({ error: "Failed to generate guide" });
  }
}