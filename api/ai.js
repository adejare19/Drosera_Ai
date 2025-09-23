// api/ai.js
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { input, idea, guide } = req.body;
    if (!input || !idea || !guide) {
      return res.status(400).json({ error: "Missing input, idea, or guide context" });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a Drosera setup assistant. Only troubleshoot errors based on the provided guide JSON. Don’t invent steps.`,
          },
          {
            role: "user",
            content: `Idea: ${idea}\n\nGuide JSON:\n${JSON.stringify(guide, null, 2)}\n\nUser Error:\n${input}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 800,
      }),
    });

    const data = await response.json();
    const output = data.choices?.[0]?.message?.content || "No response.";

    res.status(200).json({ output });
  } catch (err) {
    console.error("AI troubleshooting error:", err);
    res.status(500).json({ error: "Failed to troubleshoot" });
  }
}
