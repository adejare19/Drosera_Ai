// setup.js

let guideData = null; // Global object to store the entire guide (the 5 phases)
let currentStepIndex = 0; // Global index to track the current phase (0 to 4)

// --- Idea Retrieval ---
let storedIdea = null;
try {
    // Attempt to load the full idea object from localStorage
    storedIdea = JSON.parse(localStorage.getItem("selectedIdea")) || null;
} catch {}
// Check the URL query (for manual idea typing)
const ideaFromQuery = new URLSearchParams(window.location.search).get("idea") || "";
// Determine the display title
const displayTitle = storedIdea?.title || ideaFromQuery || "Unnamed Trap Idea";


document.addEventListener("DOMContentLoaded", () => {
    // 1. Update header text
    const small = document.querySelector(".small-muted");
    if (small) {
        small.innerText = `Step-by-step file setup for your idea: "${displayTitle}". Follow each step and click Next to proceed.`;
    }

    // 2. Hide controls until guide loads
    const wizardControls = document.getElementById('wizard-controls');
    if (wizardControls) wizardControls.style.display = 'none';

    // 3. Load the guide
    if (displayTitle) loadGuide();
});


// ---------------------------------------------
// 🔹 API CALL (Fetch the nested JSON guide)
// ---------------------------------------------
async function loadGuide() {
    const guideSection = document.querySelector(".guide-section");
    guideSection.innerHTML = '<p class="text-warning" id="loading-message">⏳ Generating guide, please wait (up to 30 seconds)...</p>';

    try {
        // Build payload: use the full stored object or fallback to just the query string idea
        let payload = storedIdea || { idea: ideaFromQuery };

        const res = await fetch("/api/generateGuide", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        const data = await res.json();
        
        if (!res.ok || !data.guide || !Array.isArray(data.guide.steps)) {
            const errorMsg = data.error || "Invalid structure returned by AI.";
            guideSection.innerHTML = `<p class="text-danger">❌ Failed to load guide: ${errorMsg}</p>`;
            console.error("Guide API error:", data);
            return;
        }

        guideData = data.guide;
        initializeWizard(); // Start the guide navigation
    } catch (err) {
        guideSection.innerHTML = `<p class="text-danger">❌ Error loading guide: ${err.message}</p>`;
        console.error(err);
    }
}

// ---------------------------------------------
// 🔹 WIZARD LOGIC (Initialization and Rendering)
// ---------------------------------------------
function initializeWizard() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) loadingMessage.remove();

    if (guideData.steps.length > 0) {
        document.getElementById('wizard-controls').style.display = 'flex';
        renderCurrentStep();
    } else {
        document.querySelector(".guide-section").innerHTML = '<p class="text-danger">No steps generated.</p>';
    }
}

function renderCurrentStep() {
    if (!guideData || guideData.steps.length === 0) return;

    const guideSection = document.querySelector(".guide-section");
    guideSection.innerHTML = ""; // Clear old step content

    const step = guideData.steps[currentStepIndex];
    const totalSteps = guideData.steps.length;

    // --- 1. Render Step Header ---
    const headerHTML = `
        <p class="text-warning">${currentStepIndex + 1}/${totalSteps}</p>
        <h3 class="top-2">${step.title}</h3>
        <p class="small-muted mb-4">${step.description || ""}</p>
    `;
    guideSection.insertAdjacentHTML('beforeend', headerHTML);
    
    // --- 2. Render all Code Blocks (sub_steps) ---
    // Note: The UI is based on the 'sub_steps' array
    step.sub_steps.forEach(block => {
        const descriptionHTML = block.description ? `<p class="text-white-50 mt-1 mb-2">${block.description}</p>` : '';
        const blockHTML = `
            <div class="file-code-block">
                <h5 class="file-code-title">${block.block_title}</h5>
                ${descriptionHTML}
                <div class="cmd-pre">
                    <pre><code>${block.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
                    <button class="btn btn-sm btn-warning copy-btn-inline" onclick="copyCode(this)">📋 Copy</button>
                </div>
            </div>
        `;
        guideSection.insertAdjacentHTML('beforeend', blockHTML);
    });

    // --- 3. Update Controls Visibility and Text ---
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    if (prevBtn) prevBtn.disabled = (currentStepIndex === 0);
    if (nextBtn) nextBtn.textContent = (currentStepIndex === totalSteps - 1) ? 'Finish Guide' : 'Yes, Proceed →';
}


// ---------------------------------------------
// 🔹 NAVIGATION AND UTILITY FUNCTIONS
// ---------------------------------------------
function prevStep() {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        renderCurrentStep();
    }
}

function nextStep() {
    const totalSteps = guideData.steps.length;
    if (currentStepIndex < totalSteps - 1) {
        currentStepIndex++;
        renderCurrentStep();
    } else {
        finishWizard();
    }
}

function goToStep(n) {
    if (guideData && n >= 1 && n <= guideData.steps.length) {
        currentStepIndex = n - 1;
        renderCurrentStep();
    }
}

function finishWizard() {
    // 1. Show the Bootstrap Toast notification
    const toastElement = document.getElementById('successToast');
    if (toastElement) {
        const toast = new bootstrap.Toast(toastElement);
        toast.show();
    }
    
    // 2. Navigate to the final documentation step (Phase 5)
    // The finish button on the last step (index 4) navigates to the same step (5)
    goToStep(5);
}


function copyCode(button) {
    const codeElement = button.closest('.cmd-pre').querySelector('code');
    navigator.clipboard.writeText(codeElement.textContent).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => { button.textContent = '📋 Copy'; }, 2000);
    }).catch(err => {
        console.error('Could not copy text: ', err);
    });
}


// --- Global helper function for the top-left 'Back' button ---
// The HTML uses onclick="goToStep(1)" for the main back button
window.goToStep = goToStep;


// --- Placeholder functions for troubleshooting panel ---
async function askAI() {
    const txt = document.getElementById("errorInput").value.trim();
    const out = document.getElementById("aiResponse");

    if (!txt) {
        out.innerText = "Paste your compiler/log output above and click Ask AI.";
        return;
    }
    if (!guideData) {
        out.innerText = "❌ No guide context loaded yet.";
        return;
    }

    out.innerText = "⏳ Consulting AI...";
    try {
        // Send the entire guide context for accurate troubleshooting
        const res = await fetch("/api/ai", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                input: txt, 
                idea: storedIdea || ideaFromQuery, 
                guide: guideData // Sending the full guide structure as context
            }),
        });
        const data = await res.json();
        out.innerHTML = `<pre class="text-white bg-dark p-2 rounded">${data.output}</pre>` || data.error || "No response.";
    } catch (err) {
        out.innerText = "❌ Error contacting AI: " + err.message;
    }
}

function clearError() {
    document.getElementById("errorInput").value = "";
    document.getElementById("aiResponse").innerText = "Copy the step instructions on the left and run them. If an error occurs, paste it here and click Ask AI.";
}