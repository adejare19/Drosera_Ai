// api/generateIdeas.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    // Example with OpenAI (make sure OPENAI_API_KEY is in your .env.local)
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are an AI that generates unique Drosera trap PoC ideas." },
          { role: "user", content: prompt },
        ],
        max_tokens: 300,
      }),
    });

    const data = await response.json();

    // Extract AI text
    const text = data.choices?.[0]?.message?.content || "";
    const ideas = text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line);

    res.status(200).json({ ideas });
  } catch (err) {
    console.error("Error generating ideas:", err);
    res.status(500).json({ error: "Failed to generate ideas" });
  }
}
