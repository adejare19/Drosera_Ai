// setup.js

let currentGuide = null;

// Try to get full idea object from localStorage (if user clicked an AI idea)
let storedIdea = null;
try {
  storedIdea = JSON.parse(localStorage.getItem("selectedIdea")) || null;
} catch {}

// Also check the URL query (for manual idea typing)
const ideaFromQuery = new URLSearchParams(window.location.search).get("idea") || "";

// Determine what to show as description
const displayTitle = storedIdea?.title || ideaFromQuery || "";

// Update header text
document.addEventListener("DOMContentLoaded", () => {
  const small = document.querySelector(".small-muted");
  if (small) {
    small.innerText = displayTitle
      ? `Step-by-step file setup for your idea: "${displayTitle}".`
      : "Step-by-step file setup.";
  }
  if (displayTitle) loadGuide();
});

// 🔹 Build payload for API: either the full idea object or just { idea: string }
async function loadGuide() {
  try {
    let payload;
    if (storedIdea) {
      // Send the whole object (includes title, summary, solidity_file, etc.)
      payload = storedIdea;
    } else {
      payload = { idea: ideaFromQuery };
    }

    const res = await fetch("/api/generateGuide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!data.guide) {
      document.querySelector(".guide-section").innerHTML =
        `<p class="text-danger">❌ Failed to load guide for "${displayTitle}".</p>`;
      console.error("Guide API error:", data);
      return;
    }

    currentGuide = data.guide;
    renderGuide(data.guide.steps);
  } catch (err) {
    document.querySelector(".guide-section").innerHTML =
      `<p class="text-danger">❌ Error loading guide: ${err.message}</p>`;
    console.error(err);
  }
}

// 🔹 Render the guide dynamically
function renderGuide(steps) {
  const guideSection = document.querySelector(".guide-section");
  guideSection.innerHTML = "";

  steps.forEach((step, i) => {
    const div = document.createElement("div");
    div.className = "step " + (i === 0 ? "active" : "d-none");
    div.dataset.step = i + 1;

    // Step commands or code
    const codeBlock = step.code
      ? `<pre class="bg-dark text-success p-3 rounded">${step.code}</pre>`
      : step.commands
      ? `<pre class="bg-dark text-success p-3 rounded">${step.commands}</pre>`
      : "";

    div.innerHTML = `
      <h4>${i + 1}) ${step.title}</h4>
      <div class="position-relative">${codeBlock}</div>
      <p>${step.description || ""}</p>
      <div class="wizard-controls">
        ${i > 0 ? `<button class="btn btn-secondary" onclick="goToStep(${i})">← Back</button>` : ""}
        ${
          i < steps.length - 1
            ? `<button class="btn btn-next" onclick="goToStep(${i + 2})">Next →</button>`
            : `<button class="btn btn-next" onclick="finishWizard()">Finish</button>`
        }
      </div>
    `;
    guideSection.appendChild(div);
  });
}

// 🔹 Step navigation
function goToStep(n) {
  const steps = document.querySelectorAll(".guide-section .step");
  steps.forEach((s, i) => {
    s.classList.toggle("active", i === n - 1);
    s.classList.toggle("d-none", i !== n - 1);
  });
}

function finishWizard() {
  alert("✅ Setup complete. You can now follow 'Build & test' and 'Deploy'.");
  goToStep(1);
}

// 🔹 Troubleshooting with guide context
async function askAI() {
  const txt = document.getElementById("errorInput").value.trim();
  const out = document.getElementById("aiResponse");

  if (!txt) {
    out.innerText = "Paste your compiler/log output above and click Ask AI.";
    return;
  }
  if (!currentGuide) {
    out.innerText = "❌ No guide context loaded yet.";
    return;
  }

  out.innerText = "⏳ Kermit is consulting Boba...";
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: txt, idea: storedIdea || ideaFromQuery, guide: currentGuide }),
    });
    const data = await res.json();
    out.innerHTML = `<pre>${data.output}</pre>` || data.error || "No response.";
  } catch (err) {
    out.innerText = "❌ Error contacting Boba: " + err.message;
  }
}

function clearError() {
  document.getElementById("errorInput").value = "";
  document.getElementById("aiResponse").innerText = "AI Response will appear here...";
}
