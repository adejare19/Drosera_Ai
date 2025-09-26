export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }
    if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
    }

    try {
        const { solidityCode } = req.body || {};

        if (!solidityCode || typeof solidityCode !== 'string') {
            return res.status(400).json({ error: "Missing or invalid 'solidityCode' in request body." });
        }

        // 1. Define the System Prompt Template
        const testSystemPromptTemplate = `
You are an expert Solidity testing agent for the Drosera Network. Your ONLY output must be a single, complete, valid Solidity file for a Foundry test named MyTrap.t.sol. Do not include any commentary, explanations, or markdown fences (like \`\`\`solidity).

Goal: Write a functional Foundry test contract that verifies the provided Drosera Trap's logic.

Trap Code Provided:
[TRAP_SOL_CODE_HERE]

Test Contract HARD RULES:
1.  Contract name MUST be 'MyTrapTest'.
2.  It MUST inherit 'Test' from 'forge-std/Test.sol'.
3.  Include a setup() function that instantiates the MyTrap contract.
4.  The test MUST decode the CollectOutput struct from the provided Trap code to correctly simulate data.
5.  All tests MUST run using VMM_CHEATCODE_ADDRESS for call simulation.

Required Test Scenarios:

Scenario 1: testShouldNotRespond (No Incident)
-   Simulate calling collect() multiple times (at least 3 samples) where the collected values **DO NOT** trigger the trap's internal comparison logic (e.g., values are stable).
-   Call shouldRespond() with the collected data array.
-   Assertion MUST be: assertEq(success, false).

Scenario 2: testShouldRespond (Incident Detected)
-   Simulate calling collect() multiple times (at least 3 samples).
-   The last collected value MUST be a significantly different value (a change large enough) to **TRIGGER** the trap's internal comparison logic (the threshold).
-   Call shouldRespond() with the collected data array.
-   Assertion MUST be: assertEq(success, true).

You MUST infer the required data types and threshold logic directly from the [TRAP_SOL_CODE_HERE] to make the simulated values correct.
        `;

        // 2. Substitute the Trap Code into the Prompt
        const finalSystemPrompt = testSystemPromptTemplate.replace('[TRAP_SOL_CODE_HERE]', solidityCode);

        const messages = [
            {
                role: "system",
                content: finalSystemPrompt
            },
            // Note: The user message is often left empty or generic for a system-driven prompt like this
            {
                role: "user",
                content: "Generate the MyTrap.t.sol file now based on the system prompt and provided code."
            }
        ];

        // 3. Call the OpenAI API
        const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-4o-mini",
                // Note: We DO NOT use response_format: { type: "json_object" } here, 
                // because the output must be a raw Solidity file (plain text).
                temperature: 0.2, // Keep temperature low for deterministic code generation
                max_tokens: 2600,
                messages
            })
        });

        const data = await r.json();

        // 4. Extract and Sanitize the Raw Solidity Output
        let rawCode = data.choices?.[0]?.message?.content || "";

        // Remove common markdown formatting fences from the raw output
        rawCode = rawCode
            .replace(/```solidity/g, "")
            .replace(/```/g, "")
            .trim();

        if (!rawCode) {
            return res.status(500).json({ error: "AI failed to generate test code.", raw: data });
        }
        
        // 5. Return the clean Solidity code
        return res.status(200).json({ testSolidityCode: rawCode });

    } catch (err) {
        console.error("Error in generateTest:", err);
        return res.status(500).json({ error: "Failed to generate test code", details: err.message });
    }
}