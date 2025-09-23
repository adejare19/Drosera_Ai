// setup.js

let currentGuide = null;
const userIdea = new URLSearchParams(window.location.search).get("idea") || "";

// Update header description
document.addEventListener("DOMContentLoaded", () => {
  document.querySelector('.small-muted').innerText =
    userIdea ? `Step-by-step file setup for your idea: "${userIdea}".` : "Step-by-step file setup.";

  if (userIdea) loadGuide();
});

// Load AI-generated guide
async function loadGuide() {
  try {
    const res = await fetch('/api/generateGuide', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: userIdea })
    });

    const data = await res.json();
    if (!data.guide) {
      document.querySelector('.guide-section').innerHTML =
        `<p class="text-danger">❌ Failed to load guide for "${userIdea}".</p>`;
      return;
    }

    currentGuide = data.guide;
    renderGuide(data.guide.steps);
  } catch (err) {
    document.querySelector('.guide-section').innerHTML =
      `<p class="text-danger">❌ Error loading guide: ${err.message}</p>`;
  }
}

// Render guide dynamically
function renderGuide(steps) {
  const guideSection = document.querySelector('.guide-section');
  guideSection.innerHTML = ""; // clear static HTML

  steps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "step " + (i === 0 ? "active" : "d-none");
    div.dataset.step = i + 1;

    div.innerHTML = `
      <h4>${i + 1}) ${step.title}</h4>
      <div class="position-relative">
        <pre class="cmd-pre bg-dark text-success p-3 rounded">${step.commands || ""}</pre>
      </div>
      ${(step.files ? Object.entries(step.files).map(([file, content]) => `
        <div class="file-code-block">
          <div class="file-code-title">Paste into <code>${file}</code></div>
          <pre class="bg-dark text-success p-3 rounded">${content}</pre>
        </div>
      `).join("") : "")}
      <div class="wizard-controls">
        ${i > 0 ? `<button class="btn btn-secondary" onclick="goToStep(${i})">← Back</button>` : ""}
        ${i < steps.length - 1
          ? `<button class="btn btn-next" onclick="goToStep(${i + 2})">Next →</button>`
          : `<button class="btn btn-next" onclick="finishWizard()">Finish</button>`}
      </div>
    `;
    guideSection.appendChild(div);
  });
}

// Step navigation
function goToStep(n) {
  const steps = document.querySelectorAll('.guide-section .step');
  steps.forEach((s, i) => {
    s.classList.toggle('active', i === n - 1);
    s.classList.toggle('d-none', i !== n - 1);
  });
}

function finishWizard() {
  alert("✅ Setup complete. You can now follow 'Build & test' and 'Deploy'.");
  goToStep(1);
}

// Troubleshooting with guide context
async function askAI() {
  const txt = document.getElementById('errorInput').value.trim();
  const out = document.getElementById('aiResponse');

  if (!txt) {
    out.innerText = 'Paste your compiler/log output above and click Ask AI.';
    return;
  }
  if (!currentGuide) {
    out.innerText = '❌ No guide context loaded yet.';
    return;
  }

  out.innerText = '⏳ Kermit is consulting Boba...';
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: txt, idea: userIdea, guide: currentGuide })
    });
    const data = await res.json();
    out.innerHTML = `<pre>${data.output}</pre>` || data.error || 'No response.';
  } catch (err) {
    out.innerText = '❌ Error contacting Boba: ' + err.message;
  }
}

// Clear troubleshoot input
function clearError() {
  document.getElementById('errorInput').value = '';
  document.getElementById('aiResponse').innerText = 'AI Response will appear here...';
}
