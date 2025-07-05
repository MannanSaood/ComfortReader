// viewer/viewer.js

// Import PDF.js directly as this script is now a module
import * as pdfjsLib from './pdfjs/pdf.mjs'; 

// Set up the worker source (this belongs with the pdfjsLib initialization)
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdfjs/pdf.worker.mjs');

// --- Debugging log, if you want to keep it ---
console.log('PDF.js module imported successfully in viewer.js:', !!pdfjsLib);
// --- End Debugging Log ---

const urlParams = new URLSearchParams(window.location.search);
const pdfUrl = urlParams.get('file');
const pdfContainer = document.getElementById('pdf-container');
const loadingMessage = document.getElementById('loading-message');

let currentSettings = {};
let isRendering = false; // Add this at the top (global scope)

// Function to fetch and apply settings
async function loadAndApplySettings() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['warmColor', 'contrastLevel', 'blueLightFilter', 'blueLightIntensity', 'scope', 'siteList'], function(settings) {
            currentSettings = settings;
            console.log('Loaded settings:', currentSettings);

            // Apply global background color to the viewer's body/container
            const bgColor = currentSettings.warmColor || '#FBF0E0'; // Default warm cream
            document.body.style.backgroundColor = bgColor;
            pdfContainer.style.backgroundColor = bgColor; // Ensure container also has it

            // Set CSS variables based on settings
            document.body.style.setProperty('--contrast-value', currentSettings.contrastLevel + '%');
            document.body.style.setProperty('--brightness-value', (200 - currentSettings.contrastLevel) + '%'); // Inverse brightness slightly for better contrast feel

            if (currentSettings.blueLightFilter) {
                // These values can be fine-tuned. 0.3 sepia, -15deg hue-rotate is a common starting point
                // Intensity can scale these values.
                const sepiaVal = (currentSettings.blueLightIntensity / 100) * 0.3; // Max 0.3 sepia
                const hueRotateVal = (currentSettings.blueLightIntensity / 100) * -15; // Max -15 deg hue-rotate
                document.body.style.setProperty('--blue-light-sepia', sepiaVal);
                document.body.style.setProperty('--blue-light-hue-rotate', hueRotateVal + 'deg');
            } else {
                document.body.style.setProperty('--blue-light-sepia', '0');
                document.body.style.setProperty('--blue-light-hue-rotate', '0deg');
            }

            resolve();
        });
    });
}

// Function to render the PDF
async function renderPdf(url) {
    if (isRendering) return; // Prevent duplicate renders
    isRendering = true;

    if (!url) {
        loadingMessage.textContent = 'No PDF URL provided.';
        isRendering = false;
        return;
    }

    // Save scroll position
    const prevScroll = pdfContainer.scrollTop || window.scrollY;

    loadingMessage.textContent = 'Loading PDF...';
    pdfContainer.innerHTML = ''; // Clear previous content

    await loadAndApplySettings(); // Load settings before rendering

    try {
        // Use pdfjsLib directly now that it's imported in this module
        const loadingTask = pdfjsLib.getDocument(url);
        const pdf = await loadingTask.promise;

        loadingMessage.textContent = `Rendering ${pdf.numPages} pages...`;

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.5 }); // Adjust scale as needed

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            // Apply filters for contrast and blue light reduction directly to canvas via CSS variables
            canvas.style.filter = `
                sepia(var(--blue-light-sepia, 0))
                hue-rotate(var(--blue-light-hue-rotate, 0deg))
                contrast(var(--contrast-value, 100%))
                brightness(var(--brightness-value, 100%))
            `;

            pdfContainer.appendChild(canvas);

            const renderContext = {
                canvasContext: context,
                viewport: viewport,
            };
            await page.render(renderContext).promise;

            // Optional: If you want selectable text, PDF.js can also render a text layer.
            // This is more complex to implement and style correctly for readability enhancements.
            // For now, focusing on canvas rendering.
        }
        loadingMessage.style.display = 'none'; // Hide loading message

        // Restore scroll position
        pdfContainer.scrollTop = prevScroll;
        window.scrollTo(0, prevScroll);
    } catch (error) {
        console.error('Error rendering PDF:', error);
        let errorMessage = 'Error loading or rendering PDF: ' + error.message;

        // Check if it's a 403 Forbidden error
        if (error.name === 'FetchError' && error.message.includes('403')) { // Or a more robust check based on PDF.js error object structure
             errorMessage = "Error: Access to this PDF is forbidden (403). The website may be blocking direct access or require login. Please try downloading the PDF first, then open the downloaded file.";
        } else if (error.message.includes('403') || (error.response && error.response.status === 403)) {
            errorMessage = "Error: Access to this PDF is forbidden (403). The website may be blocking direct access or require login. Please try downloading the PDF first, then open the downloaded file.";
        }
        loadingMessage.textContent = errorMessage;
    } finally {
        isRendering = false; // Allow future renders
    }
}

// Start rendering when the viewer page loads
document.addEventListener('DOMContentLoaded', () => {
    renderPdf(pdfUrl);
});

// Listen for settings changes from the options page (if viewer is already open)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "settingsChanged") {
        console.log("Settings changed received in viewer. Re-rendering...");
        // Re-render the PDF to apply new settings
        renderPdf(pdfUrl);
    }
});