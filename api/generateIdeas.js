const messages = [
  {
    role: "system",
    content: `
You generate EXACTLY 3 distinct Drosera Trap ideas as a strict JSON array (no markdown).
Each idea object MUST have:
- "title"
- "category" from ["Protocol-specific","Behavioral","Environment","Access-control","Timing","Economic","Cross-domain"]
- "summary" (1–2 sentences)
- "solidity_file_name" e.g. "src/MyTrap.sol"
- "solidity_file": the COMPLETE Solidity file as a plain string (no fences).

REFERENCE CONTRACT (copy this shape, only adapt logic/constants):

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./ITrap.sol";

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

contract MyTrap is ITrap {
    address public constant TOKEN = 0x0000000000000000000000000000000000000000;
    address public constant POOL  = 0x0000000000000000000000000000000000000000;

    struct CollectOutput {
        uint256 tokenBalance;
    }

    constructor() {}

    function collect() external view override returns (bytes memory) {
        uint256 bal = IERC20(TOKEN).balanceOf(POOL);
        return abi.encode(CollectOutput({tokenBalance: bal}));
    }

    function shouldRespond(bytes[] calldata data) external pure override returns (bool, bytes memory) {
        CollectOutput memory current = abi.decode(data[0], (CollectOutput));
        CollectOutput memory past = abi.decode(data[data.length-1], (CollectOutput));
        if (past.tokenBalance == 0) return (false, bytes(""));
        uint256 drop = ((past.tokenBalance - current.tokenBalance) * 1e18) / past.tokenBalance;
        if (drop > 1e17) return (true, bytes(""));
        return (false, bytes(""));
    }
}

HARD RULES:
- pragma solidity ^0.8.20
- Constructor with NO args; hardcode constants/thresholds
- No extra libraries, responders, or markdown.
`
  },
  { role: "user", content: `Base idea/context: "${userIdea}". Return 3 DIFFERENT categories.` }
];
