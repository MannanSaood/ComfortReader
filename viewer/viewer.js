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
let zoomLevel = 1;
let invertColors = false;
let grayscale = false;
let bookmarkedPage = null;
let firstLoad = true; // Track if it's the first load
let sidebarThumbnailsRendered = false;
let thumbnailCache = [];
const renderedPages = {};

let currentPage = 1;
let totalPages = 1;
let rotation = 0;
let pdfDoc = null;

// Load PDF and render sidebar + first page
async function loadPdf(url) {
    loadingMessage.textContent = 'Loading PDF...';
    loadingMessage.style.display = 'block';
    pdfDoc = await pdfjsLib.getDocument(url).promise;
    totalPages = pdfDoc.numPages;
    document.getElementById('page-count').textContent = `/ ${totalPages}`;
    await renderSidebarThumbnails(pdfDoc, currentPage);
    await renderCurrentPage();
    loadingMessage.style.display = 'none';
}

// Render only the current page
async function renderCurrentPage() {
    const pdfContainer = document.getElementById('pdf-container');
    pdfContainer.innerHTML = '';
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale: zoomLevel, rotation });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    let filter = '';
    if (invertColors) filter += ' invert(1)';
    if (grayscale) filter += ' grayscale(1)';
    canvas.style.filter = filter.trim();

    pdfContainer.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

    document.getElementById('page-number').value = currentPage;
    highlightSidebarThumbnail(currentPage);
}

// Sidebar thumbnails
async function renderSidebarThumbnails(pdf, selectedPage) {
    const sidebarContent = document.getElementById('sidebar-content');
    sidebarContent.innerHTML = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.18 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'sidebar-thumb' + (pageNum === selectedPage ? ' selected' : '');

        let filter = '';
        if (invertColors) filter += ' invert(1)';
        if (grayscale) filter += ' grayscale(1)';
        canvas.style.filter = filter.trim();

        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        canvas.addEventListener('click', () => {
            currentPage = pageNum;
            renderCurrentPage();
            highlightSidebarThumbnail(pageNum);
        });
        sidebarContent.appendChild(canvas);
    }
}

function highlightSidebarThumbnail(pageNum) {
    document.querySelectorAll('.sidebar-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('selected', idx + 1 === pageNum);
    });
}

// Navigation controls
document.getElementById('prev-page').onclick = () => {
    if (currentPage > 1) {
        currentPage--;
        renderCurrentPage();
    }
};
document.getElementById('next-page').onclick = () => {
    if (currentPage < totalPages) {
        currentPage++;
        renderCurrentPage();
    }
};
document.getElementById('page-number').addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= totalPages) {
        currentPage = val;
        renderCurrentPage();
    }
});

// Invert, Grayscale, Rotate, Download
document.getElementById('invert-toggle').addEventListener('change', (e) => {
    invertColors = e.target.checked;
    renderCurrentPage();
    renderSidebarThumbnails(pdfDoc, currentPage);
});
document.getElementById('grayscale-toggle').addEventListener('change', (e) => {
    grayscale = e.target.checked;
    renderCurrentPage();
    renderSidebarThumbnails(pdfDoc, currentPage);
});
document.getElementById('rotate-btn').onclick = () => {
    rotation = (rotation + 90) % 360;
    renderCurrentPage();
};
document.getElementById('download-btn').onclick = () => {
    chrome.downloads.download({ url: pdfUrl, filename: 'document.pdf' });
};

// Sidebar toggle
document.getElementById('sidebar-toggle').onclick = () => {
    document.body.classList.toggle('sidebar-collapsed');
};

// On load
document.addEventListener('DOMContentLoaded', () => {
    loadPdf(pdfUrl);
});

// Listen for settings changes from the options page (if viewer is already open)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "settingsChanged") {
        console.log("Settings changed received in viewer. Re-rendering...");
        // Re-render the PDF to apply new settings
        renderPdf(pdfUrl);
    }
});

// --- Controls for Zoom, Invert Colors, Grayscale --- //
// These controls allow basic manipulations of the PDF view
const zoomSlider = document.getElementById('zoom-slider');
const zoomInput = document.getElementById('zoom-input');
const zoomValue = document.getElementById('zoom-value');
const invertToggle = document.getElementById('invert-toggle');
const grayscaleToggle = document.getElementById('grayscale-toggle');
const sidebarToggle = document.getElementById('sidebar-toggle');
const pageNumberInput = document.getElementById('page-number');

if (zoomSlider && zoomInput && zoomValue) {
    zoomSlider.addEventListener('input', (e) => {
        zoomLevel = parseFloat(e.target.value);
        zoomValue.textContent = zoomLevel.toFixed(2) + 'x';
        zoomInput.value = zoomLevel;
        renderPdf(pdfUrl, currentPage);
    });
    zoomInput.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        if (isNaN(val) || val < 0.5) val = 0.5;
        if (val > 2.5) val = 2.5;
        zoomLevel = val;
        zoomSlider.value = zoomLevel;
        zoomValue.textContent = zoomLevel.toFixed(2) + 'x';
        renderPdf(pdfUrl, currentPage);
    });
}

if (invertToggle) invertToggle.addEventListener('change', () => renderPdf(pdfUrl, currentPage));
if (grayscaleToggle) grayscaleToggle.addEventListener('change', () => renderPdf(pdfUrl, currentPage));
if (sidebarToggle) sidebarToggle.onclick = () => document.body.classList.toggle('sidebar-collapsed');
if (pageNumberInput) pageNumberInput.addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (val >= 1 && val <= totalPages) {
        currentPage = val;
        renderPdf(pdfUrl, currentPage);
    }
});

// Rotate
document.getElementById('rotate-btn').onclick = () => {
  rotation = (rotation + 90) % 360;
  renderPdf(pdfUrl, currentPage);
};

// Download
document.getElementById('download-btn').onclick = () => {
  chrome.downloads.download({ url: pdfUrl, filename: 'document.pdf' });
};

// Update page info
function updatePageInfo(page, numPages) {
  document.getElementById('page-number').value = page;
  document.getElementById('page-count').textContent = `/ ${numPages}`;
}

// --- Lazy Rendering of Pages --- //
// Render only the visible pages plus a buffer
async function renderVisiblePages(pdf) {
    const buffer = 2; // How many pages above/below the viewport to render
    const windowHeight = window.innerHeight;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;

    for (let i = 0; i < window.pagePlaceholders.length; i++) {
        const pageDiv = window.pagePlaceholders[i];
        const pageTop = pageDiv.offsetTop;
        const pageBottom = pageTop + pageDiv.offsetHeight;

        // Render if the page is within (viewport + buffer pages) of the current scroll
        if (
            (pageBottom > scrollTop - buffer * windowHeight) &&
            (pageTop < scrollTop + (1 + buffer) * windowHeight)
        ) {
            if (!renderedPages[i + 1]) {
                // Render this page
                const pageNum = i + 1;
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 1.5 });
                const canvas = document.createElement('canvas');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                let filter = 'sepia(var(--blue-light-sepia, 0)) hue-rotate(var(--blue-light-hue-rotate, 0deg)) contrast(var(--contrast-value, 100%)) brightness(var(--brightness-value, 100%))';
                if (invertColors) filter += ' invert(1)';
                if (grayscale) filter += ' grayscale(1)';
                canvas.style.filter = filter.trim();
                canvas.style.transform = `scale(${zoomLevel})`;
                canvas.style.transformOrigin = 'center center';

                pageDiv.innerHTML = '';
                pageDiv.appendChild(canvas);

                await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
                renderedPages[pageNum] = true;
            }
        } else if (renderedPages[i + 1]) {
            // Remove canvas to save memory
            pageDiv.innerHTML = '';
            delete renderedPages[i + 1];
        }
    }
}

// --- DO NOT add global scroll/resize listeners for renderVisiblePages(pdf) ---
// Only add them inside renderPdf, after pdf is loaded