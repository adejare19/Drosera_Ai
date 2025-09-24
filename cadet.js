// --- Start of cadet.js ---

// Global state
let guide = null;
let stepIdx = parseInt(localStorage.getItem('drosera_step') || '0', 10);
let username = localStorage.getItem('discordUsername') || 'anonymous';

// Prompt username if missing
if (username === 'anonymous') {
  const u = prompt('Enter your Discord username (used for progress):');
  if (u) {
    username = u;
    localStorage.setItem('discordUsername', u);
  }
}

// --- Copy helper ---
async function copyCode(id) {
  const text = document.getElementById(id).innerText;
  try {
    await navigator.clipboard.writeText(text);
    flashTemporary('📋 Copied to clipboard');
  } catch (e) {
    alert('Copy failed');
  }
}

function flashTemporary(msg) {
  const el = document.createElement('div');
  el.style.position = 'fixed';
  el.style.right = '20px';
  el.style.top = '20px';
  el.style.background = '#222';
  el.style.color = '#fff';
  el.style.padding = '8px 12px';
  el.style.borderRadius = '8px';
  el.style.zIndex = 9999;
  el.innerText = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// --- Step navigation ---
function proceed() {
  const aiAnswerEl = document.getElementById("aiAnswer");
  if (aiAnswerEl) aiAnswerEl.style.display = "none";
  stepIdx++;
  localStorage.setItem("drosera_step", String(stepIdx));
  renderStep(stepIdx);
}

// --- Troubleshooting ---
async function askAI() {
  const errorText = document.getElementById('errorBox').value.trim();
  if (!errorText) return alert("Please paste the error output first.");

  const aiEl = document.getElementById("aiAnswer");
  aiEl.style.display = "block";
  aiEl.innerHTML = "⏳ Kermit is thinking…";

  try {
    const r = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        step: guide.steps[stepIdx],
        error: errorText
      })
    });

    const txt = await r.text();
    if (!r.ok) {
      console.error(txt);
      aiEl.innerText = 'Server error: ' + txt;
      return;
    }

    let j;
    try {
      j = JSON.parse(txt);
    } catch (e) {
      console.error('Invalid JSON from AI:', txt);
      aiEl.innerText = 'Invalid response from AI';
      return;
    }

    if (j.type === "troubleshoot") {
      aiEl.innerHTML =
        `<p><strong>⚠️ Diagnosis:</strong> ${j.diagnosis}</p>` +
        `<p><strong>Explanation:</strong> ${j.explanation}</p>` +
        `<p><strong>Suggested commands:</strong></p><pre>${(j.suggested_commands || []).join('\n')}</pre>` +
        `<p><strong>Confidence:</strong> ${j.confidence}</p>` +
        (j.cannot_fix
          ? "<p><strong>❌ This is outside the guide’s scope.</strong></p>"
          : "<p><strong>✅ Ready to retry this step?</strong></p>");
    } else {
      aiEl.innerText = 'Unexpected response: ' + JSON.stringify(j);
    }

  } catch (e) {
    aiEl.innerText = 'Request failed: ' + e.message;
  }
}

// --- Step rendering ---
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

  if (s.substeps && s.substeps.length) {
    s.substeps.forEach((ss, idx) => {
      const sub = document.createElement('div');
      let content = ss.code || JSON.stringify(ss.config, null, 2) || (ss.commands?.join('\n') || '');
      sub.innerHTML = `<strong>${ss.title}</strong><pre id="code_${idx}">${content}</pre>`;

      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.textContent = '📋 Copy';
      btn.onclick = () => copyCode(`code_${idx}`);
      sub.style.position = 'relative';
      sub.appendChild(btn);
      area.appendChild(sub);
    });
  } else if (s.commands && s.commands.length) {
    const codeId = 'codeBlock';
    const wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    wrapper.innerHTML = `<pre id="${codeId}">${s.commands.join('\n')}</pre>`;
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = '📋 Copy';
    btn.onclick = () => copyCode(codeId);
    wrapper.appendChild(btn);
    area.appendChild(wrapper);
  } else {
    area.innerHTML = '<p class="small-muted">No commands in this step.</p>';
  }
}

// --- Load local guide ---
async function loadGuide() {
  try {
    const res = await fetch('./drosera_guide.json');
    guide = await res.json();
    renderStep(stepIdx);
  } catch (e) {
    document.getElementById('stepTitle').innerText = 'Error loading guide';
    console.error('Error loading JSON guide:', e);
  }
}

// --- Background animation ---
const canvas = document.getElementById('bgCanvas'),
  ctx = canvas.getContext('2d');
function resetCanvas() {
  canvas.width = innerWidth;
  canvas.height = innerHeight;
}
window.addEventListener('resize', () => {
  resetCanvas();
  initParticles();
});
resetCanvas();

let particles = [];
class Particle {
  constructor(x, y, s, sx, sy) {
    Object.assign(this, { x, y, size: s, sx, sy });
  }
  update() {
    this.x += this.sx;
    this.y += this.sy;
    if (this.x < 0 || this.x > canvas.width) this.sx *= -1;
    if (this.y < 0 || this.y > canvas.height) this.sy *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,102,0,0.7)';
    ctx.fill();
  }
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

// --- Init ---
initParticles();
animate();
loadGuide();

// Buttons
document.getElementById('btnProceed').addEventListener('click', proceed);
document.getElementById('btnSubmitError').addEventListener('click', askAI);
document.getElementById("btnBack").addEventListener("click", () => {
  if (stepIdx > 0) {
    stepIdx--;
    localStorage.setItem("drosera_step", String(stepIdx));
    renderStep(stepIdx);
  }
});

// --- End of cadet.js ---
