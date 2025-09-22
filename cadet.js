const canvas = document.getElementById('bgCanvas'), ctx = canvas.getContext('2d');
  function resetCanvas() { canvas.width = innerWidth; canvas.height = innerHeight; }
  window.addEventListener('resize', () => { resetCanvas(); initParticles(); });
  resetCanvas();

  let particles = [];
  class Particle {
    constructor(x, y, s, sx, sy) { Object.assign(this, { x, y, size: s, sx, sy }); }
    update() { this.x += this.sx; this.y += this.sy; if (this.x < 0 || this.x > canvas.width) this.sx *= -1; if (this.y < 0 || this.y > canvas.height) this.sy *= -1; }
    draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,102,0,0.7)'; ctx.fill(); }
  }
  function initParticles() { 
    particles = []; 
    for (let i = 0; i < 50; i++) { 
      particles.push(new Particle(
        Math.random() * canvas.width,
        Math.random() * canvas.height,
        Math.random() * 3 + 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      )); 
    } 
  }
  function animate() { 
    ctx.clearRect(0, 0, canvas.width, canvas.height); 
    particles.forEach(p => { p.update(); p.draw(); }); 
    for (let a = 0; a < particles.length; a++) { 
      for (let b = a; b < particles.length; b++) { 
        const dx = particles[a].x - particles[b].x, 
              dy = particles[a].y - particles[b].y, 
              d = Math.sqrt(dx * dx + dy * dy); 
        if (d < 120) { 
          ctx.beginPath(); 
          ctx.strokeStyle = 'rgba(255,102,0,0.12)'; 
          ctx.moveTo(particles[a].x, particles[a].y); 
          ctx.lineTo(particles[b].x, particles[b].y); 
          ctx.stroke(); 
        } 
      } 
    } 
    requestAnimationFrame(animate); 
  }
  initParticles(); animate();

  document.getElementById("btnBack").addEventListener("click", () => {
    if (stepIdx > 0) {
      stepIdx--;
      localStorage.setItem("drosera_step", String(stepIdx));
      renderStep(stepIdx);
    }
  });

  
  let guide = null;
  let stepIdx = parseInt(localStorage.getItem('drosera_step') || '0', 10);

  async function loadGuide() {
    try {
      guide = await fetch('/data/drosera_guide.json').then(r => r.json());
      renderStep(stepIdx);
    } catch (err) {
      console.error(err);
      document.getElementById('stepTitle').innerText = 'Failed to load guide';
      document.getElementById('stepDesc').innerText = 'Make sure /public/data/drosera_guide.json is present.';
    }
  }

  function renderStep(i) {
    const s = guide.steps[i];
    if (!s) {
      document.getElementById('stepTitle').innerText = 'All done';
      document.getElementById('commandsArea').innerHTML = '<p>Completed all steps.</p>';
      document.getElementById('stepCounter').innerText = '';
      return;
    }
    document.getElementById('stepTitle').innerText = `Step ${i + 1}: ${s.title}`;
    document.getElementById('stepDesc').innerText = (s.notes || []).join(' • ') || '';
    document.getElementById('stepCounter').innerText = `${i + 1}/${guide.steps.length}`;

    const area = document.getElementById('commandsArea'); 
    area.innerHTML = '';
    const commands = s.commands || (s.substeps ? s.substeps.flatMap(ss => ss.commands || []) : []);
    if (commands.length) {
      const codeId = 'codeBlock';
      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.innerHTML = `<pre id="${codeId}">${commands.join('\n')}</pre>`;
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '📋 Copy';
      btn.onclick = () => copyCode(codeId);
      wrapper.appendChild(btn);
      area.appendChild(wrapper);
    } else if (s.substeps && s.substeps.length) {
      s.substeps.forEach((ss, idx) => {
        const sub = document.createElement('div');
        sub.innerHTML = `<strong>${ss.title}</strong><pre id="code_${idx}">${(ss.commands || []).join('\n')}</pre>`;
        const btn = document.createElement('button');
        btn.className = 'copy-btn'; btn.textContent = '📋 Copy';
        btn.onclick = () => copyCode(`code_${idx}`);
        sub.style.position = 'relative';
        sub.appendChild(btn);
        area.appendChild(sub);
      });
    } else {
      area.innerHTML = '<p class="small-muted">No commands in this step.</p>';
    }
  }

  async function copyCode(id) {
    const text = document.getElementById(id).innerText;
    try { 
      await navigator.clipboard.writeText(text); 
      flashTemporary('Copied to clipboard'); 
    } catch (e) { 
      alert('Copy failed'); 
    }
  }

  function flashTemporary(msg) {
    const el = document.createElement('div');
    el.style.position = 'fixed'; el.style.right = '20px'; el.style.top = '20px'; 
    el.style.background = '#222'; el.style.color = '#fff'; 
    el.style.padding = '8px 12px'; el.style.borderRadius = '8px'; 
    el.style.zIndex = 9999;
    el.innerText = msg; document.body.appendChild(el);
    setTimeout(() => el.remove(), 1500);
  }

  // call API for either "proceed" (render) or "submit error" (troubleshoot)
  async function askAI({ step, username, error, mode }) {
    const aiEl = mode === "render"
      ? document.getElementById("stepExplanation")
      : document.getElementById("aiAnswer");

    aiEl.style.display = "block";
    aiEl.innerText = "Kermit is thinking…";

    try {
      const r = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, username, step, error })
      });

      const txt = await r.text();
      if (!r.ok) {
        console.error(txt);
        aiEl.innerText = 'Server error: ' + txt;
        return;
      }

      let j;
      try { j = JSON.parse(txt); }
      catch (e) {
        console.error('Invalid JSON from API:', txt);
        aiEl.innerText = 'Invalid response from AI';
        return;
      }

      if (j.type === "render") {
        aiEl.innerText = `🔹 ${j.step.title}\n\n${j.step.description || ''}`;
        j.step.substeps?.forEach(ss => {
          aiEl.innerText += `\n\n👉 ${ss.title}\n${(ss.commands || []).join('\n')}`;
        });
      }
      else if (j.type === "troubleshoot") {
        aiEl.innerText =
          `⚠️ Diagnosis: ${j.diagnosis}\n\n` +
          `Explanation: ${j.explanation}\n\n` +
          `Suggested commands:\n${(j.suggested_commands || []).join('\n')}\n\n` +
          `Confidence: ${j.confidence}` +
          (j.cannot_fix ? "\n\n❌ This is outside the guide’s scope." : "\n\n✅ Ready to retry this step?");
      }
      else {
        aiEl.innerText = 'Unexpected response: ' + JSON.stringify(j);
      }

    } catch (e) {
      aiEl.innerText = 'Request failed: ' + e.message;
    }
  }

  // proceed button
  document.getElementById('btnProceed').addEventListener('click', async () => {
    const username = localStorage.getItem('discordUsername') || 'anonymous';
    const step = guide.steps[stepIdx];
    await askAI({ mode: "render", step, username });
    stepIdx = Math.min(stepIdx + 1, guide.steps.length);
    localStorage.setItem('drosera_step', String(stepIdx));
    setTimeout(() => renderStep(stepIdx), 700);
  });

  // submit error
  document.getElementById('btnSubmitError').addEventListener('click', async () => {
    const err = document.getElementById('errorBox').value.trim();
    if (!err) return alert('Please paste the error output first.');
    const username = localStorage.getItem('discordUsername') || 'anonymous';
    const step = guide.steps[stepIdx];
    await askAI({ mode: "troubleshoot", step, username, error: err });
    document.getElementById("errorBox").value = "";
  });

  // prompt username if missing
  if (!localStorage.getItem('discordUsername')) {
    const u = prompt('Enter your Discord username (used for progress):');
    if (u) localStorage.setItem('discordUsername', u);
    else localStorage.setItem('discordUsername', 'anonymous');
  }

  // initial load
  loadGuide();
