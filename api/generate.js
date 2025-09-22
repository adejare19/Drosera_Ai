export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { idea } = req.body;

  const prompt = `
The user has chosen this PoC idea: "${idea}".
Generate a Drosera PoC trap with:
1. Repo layout tree
2. Trap.sol code
3. TrapResponse.sol code
4. drosera.toml example
5. Step-by-step setup guide
Format as JSON: { layout, trap, response, toml, steps }
`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const content = data.choices[0].message.content;

    res.status(200).json({ result: content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PoC" });
  }
}
