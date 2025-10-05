// setup.js

let guideData = null; // Global object to store the entire guide (the 5 phases)
let currentStepIndex = 0; // Global index to track the current phase (0 to 4)

// --- Idea Retrieval (Initial Setup) ---
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
    // Ensure controls are hidden initially if they are not already hidden by inline style
    if (wizardControls) wizardControls.style.display = 'none';

    // 3. Load the guide
    if (displayTitle) loadGuide();
});


// ---------------------------------------------
// 🔹 API CALL (Fetch the nested JSON guide)
// ---------------------------------------------
async function loadGuide() {
    // FIX: Target the inner container, NOT the parent (.guide-section) which holds controls
    const stepsContainer = document.getElementById('guide-steps-container'); 
    
    // Display the loading message inside the dedicated container
    if (stepsContainer) {
        stepsContainer.innerHTML = '<p class="text-warning" id="loading-message">⏳ Generating guide, please wait (up to 60 seconds)...</p>';
    } else {
        console.error("Critical: #guide-steps-container not found.");
        return;
    }

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
            stepsContainer.innerHTML = `<p class="text-danger">❌ Failed to load guide: ${errorMsg}</p>`;
            console.error("Guide API error:", data);
            return;
        }

        guideData = data.guide;
        initializeWizard(); // Start the guide navigation
    } catch (err) {
        stepsContainer.innerHTML = `<p class="text-danger">❌ Error loading guide: ${err.message}</p>`;
        console.error(err);
    }
}

// ---------------------------------------------
// 🔹 WIZARD LOGIC (Initialization and Rendering)
// ---------------------------------------------
function initializeWizard() {
    // Clean up loading message once data is received
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) loadingMessage.remove();

    const wizardControls = document.getElementById('wizard-controls');

    if (guideData.steps.length > 0) {
        // Now it's safe to access wizard-controls because it was not deleted
        if (wizardControls) wizardControls.style.display = 'flex';
        renderCurrentStep();
    } else {
        const stepsContainer = document.getElementById('guide-steps-container');
        if (stepsContainer) stepsContainer.innerHTML = '<p class="text-danger">No steps generated.</p>';
    }
}

function renderCurrentStep() {
    if (!guideData || guideData.steps.length === 0) return;

    // FIX: Use the dedicated container for step content
    const stepsContainer = document.getElementById('guide-steps-container');
    if (!stepsContainer) return; // Exit if the container isn't found

    stepsContainer.innerHTML = ""; // Clear old step content

    const step = guideData.steps[currentStepIndex];
    const totalSteps = guideData.steps.length;

    // --- 1. Render Step Header ---
    const headerHTML = `
        <p class="text-warning">${currentStepIndex + 1}/${totalSteps}</p>
        <h3 class="top-2">${step.title}</h3>
        <p class="small-muted mb-4">${step.description || ""}</p>
    `;
    stepsContainer.insertAdjacentHTML('beforeend', headerHTML);
    
    // --- 2. Render all Code Blocks (sub_steps) ---
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
        stepsContainer.insertAdjacentHTML('beforeend', blockHTML);
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
    // This is called by the top-left 'Back' button in the HTML (goToStep(1))
    if (guideData && n >= 1 && n <= guideData.steps.length) {
        currentStepIndex = n - 1;
        renderCurrentStep();
    }
}

/**
 * @name finishWizard
 * Handles the final step logic: showing the Toast (optional) and displaying the GitHub Modal.
 */
function finishWizard() {
    // Navigate to the final step (Phase 5) to keep the documentation visible
    // Assumes the guide has a fixed number of phases (e.g., 5 steps)
    goToStep(guideData.steps.length);

    // 1. Show the Bootstrap Toast notification (Optional, for visual feedback)
    const toastElement = document.getElementById('successToast');
    if (toastElement) {
         if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastElement);
            // Update the toast message to reflect completion
            document.getElementById('toast-body-text').innerText = "Congratulations! Deployment guide complete.";
            toast.show();
        } else {
            console.error("Bootstrap Toast library not found.");
        }
    }
    
    // 2. CRITICAL: Display the GitHub Modal
    const githubModalElement = document.getElementById('githubModal');
    if (githubModalElement && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        const githubModal = new bootstrap.Modal(githubModalElement);
        githubModal.show();
    } else {
        console.error("Bootstrap Modal library or #githubModal element not found.");
    }
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


// --- Global helper functions (required for HTML onclick handlers) ---
window.goToStep = goToStep;
window.prevStep = prevStep;
window.nextStep = nextStep;
window.askAI = askAI; // Ensure these are defined globally if referenced in HTML
window.clearError = clearError;


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
        // Check for error response from the AI route
        if (data.error) {
             out.innerText = `❌ Bjorn is asleep: ${data.error}`;
        } else {
             // Assuming the output is markdown/plain text that needs pre-tag rendering
             out.innerHTML = `<pre class="text-white bg-dark p-2 rounded">${data.output || "No detailed output received."}</pre>`;
        }
        
    } catch (err) {
        out.innerText = "❌ Error contacting Boba: " + err.message;
    }
}

function clearError() {
    document.getElementById("errorInput").value = "";
    document.getElementById("aiResponse").innerText = "Copy the step instructions on the left and run them. If an error occurs, paste it here and click Ask AI.";
}