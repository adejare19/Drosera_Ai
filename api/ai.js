// api/ai.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { input } = req.body;
  if (!input) {
    return res.status(400).json({ error: "No input provided" });
  }
//get it done
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        input: `You are Drosera PoC AI assistant. Help diagnose this issue:\n\n${input}`,
      }),
    });

    const data = await response.json();
    res.status(200).json({ output: data.output_text || data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
