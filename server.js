// npm i express body-parser node-fetch
import express from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

app.post('/api/generate', async (req,res) => {
  const { model, prompt } = req.body;
  if (!prompt) return res.status(400).json({error:'missing prompt'});

  // Call your OpenAI / model API here. Pseudocode:
  try {
    const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role:'user', content: prompt }],
        temperature: 0.1
      })
    });
    const data = await openaiResp.json();
    const text = data.choices?.[0]?.message?.content || '';

    // **Simple parser**: expect the model to return files as blocks like:
    // /// FILE: src/Trap.sol
    // <file content>
    // We'll split by that marker.
    const files = [];
    const parts = text.split(/\/\/\/\s*FILE:\s*/g);
    for (const p of parts) {
      if (!p.trim()) continue;
      const firstLineEnd = p.indexOf('\n');
      const path = p.slice(0, firstLineEnd).trim();
      const content = p.slice(firstLineEnd+1);
      files.push({ path, content });
    }
    return res.json({ files, raw: text });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(3000, ()=> console.log('listening on 3000'));
