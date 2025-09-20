// api/ping.js
export default async function handler(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: 'Missing OPENAI_API_KEY' });
  }

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4.0-mini",
        messages: [{ role: "user", content: "Say hello" }],
      }),
    });

    const j = await r.json();
    return res.status(200).json(j);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
}
