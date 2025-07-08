// viewer/viewer.js

// Import PDF.js
import * as pdfjsLib from './pdfjs/pdf.mjs'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdfjs/pdf.worker.mjs');

// --- Global State ---
const pdfUrl = new URLSearchParams(window.location.search).get('file');
const pdfContainer = document.getElementById('pdf-container');
const loadingMessage = document.getElementById('loading-message');

let pdfDoc = null;
let currentPage = 1;
let totalPages = 1;
let rotation = 0;
let zoomLevel = 1.0; // Default zoom for continuous view
let isContinuousView = false;
let invertColors = false;
let grayscale = false;
let blueLightFilter = false;
let blueLightIntensity = 0;
let contrastLevel = 0;

// --- Rendering ---

/**
 * Main render dispatcher. Calls the correct render function based on view mode.
 */
async function render() {
    if (isContinuousView) {
        await renderContinuousView();
    } else {
        await renderSinglePageView();
    }
}

/**
 * Renders a single page, scaled to fit the container.
 */
async function renderSinglePageView() {
    pdfContainer.innerHTML = '';
    if (!pdfDoc) return;
    const page = await pdfDoc.getPage(currentPage);

    const viewport = page.getViewport({ scale: zoomLevel, rotation });
    renderPage(page, viewport, pdfContainer);
}

/**
 * Renders all pages for a continuous, scrollable view.
 */
async function renderContinuousView() {
    pdfContainer.innerHTML = '';
    if (!pdfDoc) return;
    const pagePlaceholders = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const pageDiv = document.createElement('div');
        pageDiv.id = `page-container-${pageNum}`;
        pageDiv.className = 'page-container';
        pageDiv.dataset.pageNumber = pageNum;
        pdfContainer.appendChild(pageDiv);
        pagePlaceholders.push(pageDiv);
    }

    // Observer to lazily render pages as they scroll into view
    const renderObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
                if (!entry.target.hasChildNodes()) {
                    const page = await pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: zoomLevel, rotation });
                    renderPage(page, viewport, entry.target);
                }
            }
        });
    }, { rootMargin: '500px 0px' });

    pagePlaceholders.forEach(div => renderObserver.observe(div));

    // Observer to update the current page number in the UI
    const pageUpdateObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
                updateCurrentPage(pageNum);
            }
        });
    }, { threshold: 0.5 });

    pagePlaceholders.forEach(div => pageUpdateObserver.observe(div));
}

/**
 * Renders a single PDF page to a canvas with high-DPI scaling.
 * @param {PDFPageProxy} page The PDF page object.
 * @param {PDFPageViewport} viewport The viewport with desired scale and rotation.
 * @param {HTMLElement} container The DOM element to append the canvas to.
 */
async function renderPage(page, viewport, container) {
    // High-DPI Rendering
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const canvasContext = canvas.getContext('2d');
    canvasContext.scale(dpr, dpr);

    let filter = '';
    if (invertColors) filter += ' invert(1)';
    if (grayscale) filter += ' grayscale(1)';
    if (blueLightFilter) filter += ` sepia(${blueLightIntensity / 100})`;
    filter += ` contrast(${contrastLevel}%)`;
    canvas.style.filter = filter.trim();

    if (container.className.includes('page-container')) {
        container.innerHTML = ''; // Clear placeholder
    }
    container.appendChild(canvas);
    
    await page.render({ canvasContext, viewport }).promise;
}

// --- UI Updates & Helpers ---

/**
 * Updates the current page number and highlights the correct sidebar thumbnail.
 * @param {number} num The new page number.
 */
function updateCurrentPage(num) {
    currentPage = num;
    document.getElementById('page-number').value = num;
    highlightSidebarThumbnail(num);
}

/**
 * Highlights the active thumbnail in the sidebar.
 * @param {number} pageNum The page number to highlight.
 */
function highlightSidebarThumbnail(pageNum) {
    document.querySelectorAll('.sidebar-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('selected', idx + 1 === pageNum);
    });
}

/**
 * Applies the current filter settings to all sidebar thumbnails.
 */
function updateSidebarFilter() {
    let filter = '';
    if (invertColors) filter += ' invert(1)';
    if (grayscale) filter += ' grayscale(1)';
    
    document.querySelectorAll('.sidebar-thumb').forEach(thumb => {
        thumb.style.filter = filter.trim();
    });
}

/**
 * Renders all the page thumbnails for the sidebar.
 * @param {PDFDocumentProxy} pdf The loaded PDF document.
 */
async function renderSidebarThumbnails(pdf) {
    const sidebarContent = document.getElementById('sidebar-content');
    sidebarContent.innerHTML = '';
    const fragment = document.createDocumentFragment();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.18 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'sidebar-thumb';

        let filter = '';
        if (invertColors) filter += ' invert(1)';
        if (grayscale) filter += ' grayscale(1)';
        canvas.style.filter = filter.trim();

        canvas.addEventListener('click', () => {
            if (isContinuousView) {
                document.getElementById(`page-container-${pageNum}`)?.scrollIntoView({ behavior: 'smooth' });
            } else {
                updateCurrentPage(pageNum);
                render();
            }
        });

        fragment.appendChild(canvas);
        // Don't await in loop for faster perceived load
        page.render({ canvasContext: canvas.getContext('2d'), viewport });
    }
    sidebarContent.appendChild(fragment);
    highlightSidebarThumbnail(currentPage);
}

// --- Settings Management ---

function applySettings(settings) {
    if (settings.warmColor) {
        document.documentElement.style.setProperty('--warm-background-color', settings.warmColor);
    }
    invertColors = settings.invertColors || false;
    grayscale = settings.grayscale || false;
    blueLightFilter = settings.blueLightFilter || false;
    blueLightIntensity = settings.blueLightIntensity || 50;
    contrastLevel = settings.contrastLevel || 100;
    document.getElementById('invert-toggle').checked = invertColors;
    document.getElementById('grayscale-toggle').checked = grayscale;
}

function loadAndApplySettings() {
    const defaults = { 
        warmColor: '#FBF0E0', 
        invertColors: false, 
        grayscale: false,
        blueLightFilter: false,
        blueLightIntensity: 50,
        contrastLevel: 100
    };
    chrome.storage.sync.get(defaults, applySettings);
}

// --- Initial Load ---

/**
 * Main function to load the PDF and initialize the viewer.
 */
async function loadPdf(url) {
    loadingMessage.style.display = 'block';
    try {
        pdfDoc = await pdfjsLib.getDocument(url).promise;
        totalPages = pdfDoc.numPages;
        
        // Set initial state
        updateCurrentPage(1);
        document.getElementById('page-count').textContent = `/ ${totalPages}`;
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;

        renderSidebarThumbnails(pdfDoc);
        render();

    } catch (error) {
        console.error("Failed to load PDF:", error);
        loadingMessage.textContent = 'Failed to load PDF.';
    } finally {
        loadingMessage.style.display = 'none';
    }
}

// --- Event Listeners ---

// Page Navigation
document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        if (isContinuousView) {
            document.getElementById(`page-container-${currentPage - 1}`)?.scrollIntoView({ behavior: 'smooth' });
        } else {
            updateCurrentPage(currentPage - 1);
            render();
    }
    }
});

document.getElementById('next-page').addEventListener('click', () => {
    if (currentPage < totalPages) {
        if (isContinuousView) {
            document.getElementById(`page-container-${currentPage + 1}`)?.scrollIntoView({ behavior: 'smooth' });
        } else {
            updateCurrentPage(currentPage + 1);
            render();
    }
    }
});

document.getElementById('page-number').addEventListener('change', (e) => {
    let val = parseInt(e.target.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > totalPages) val = totalPages;
    
    if (isContinuousView) {
        document.getElementById(`page-container-${val}`)?.scrollIntoView({ behavior: 'smooth' });
    } else {
        updateCurrentPage(val);
        render();
    }
});

// Zoom Controls
document.getElementById('zoom-out-btn').addEventListener('click', () => {
    if (zoomLevel > 0.25) {
        zoomLevel = Math.max(0.25, zoomLevel - 0.1);
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
        render();
    }
});

document.getElementById('zoom-in-btn').addEventListener('click', () => {
    if (zoomLevel < 3.0) {
        zoomLevel = Math.min(3.0, zoomLevel + 0.1);
        document.getElementById('zoom-level').textContent = `${Math.round(zoomLevel * 100)}%`;
        render();
    }
});

// View Controls
document.getElementById('invert-toggle').addEventListener('change', (e) => {
    invertColors = e.target.checked;
    chrome.storage.sync.set({ invertColors });
    updateSidebarFilter();
    render();
});

document.getElementById('grayscale-toggle').addEventListener('change', (e) => {
    grayscale = e.target.checked;
    chrome.storage.sync.set({ grayscale });
    updateSidebarFilter();
    render();
});

document.getElementById('view-mode-toggle').addEventListener('change', (e) => {
    isContinuousView = e.target.checked;
    
    if (isContinuousView) {
        updateCurrentPage(currentPage); // Ensure state is consistent
    }

    render();
});

// Action Controls
document.getElementById('rotate-btn').addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    render();
});

const downloadBtn = document.getElementById('download-btn');
const downloadDropdown = document.getElementById('download-dropdown');
const printBtn = document.getElementById('print-btn');
const printDropdown = document.getElementById('print-dropdown');

downloadBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    printDropdown.classList.remove('show');
    downloadDropdown.classList.toggle('show');
});

printBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    downloadDropdown.classList.remove('show');
    printDropdown.classList.toggle('show');
});

document.getElementById('download-standard-btn').addEventListener('click', async () => {
    downloadDropdown.classList.remove('show');
    try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = 'document.pdf'; // Or a more dynamic name
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
    } catch (error) {
        console.error('Standard download failed:', error);
        alert('Could not download the PDF. The file URL may be invalid or expired.');
    }
});

document.getElementById('download-modified-btn').addEventListener('click', async () => {
    downloadDropdown.classList.remove('show');
    loadingMessage.textContent = 'Generating Modified PDF...';
    loadingMessage.style.display = 'block';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt' });
    doc.deletePage(1); 

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);

        // 1. Get the original page dimensions at scale 1.0
        const pageViewport = page.getViewport({ scale: 1.0, rotation });
        const { width: pageWidth, height: pageHeight } = pageViewport;

        // 2. Render the page at a higher scale for better quality
        const renderViewport = page.getViewport({ scale: 2.0, rotation });
        
        const canvas = document.createElement('canvas');
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;
        
        await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;
        
        // 3. Apply filters to the high-resolution canvas
        let filter = '';
        if (invertColors) filter += ' invert(1)';
        if (grayscale) filter += ' grayscale(1)';
        if (blueLightFilter) filter += ` sepia(${blueLightIntensity / 100})`;
        filter += ` contrast(${contrastLevel}%)`;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.filter = filter.trim();
        tempCtx.drawImage(canvas, 0, 0);

        // 4. Get the image data as a lossless PNG
        const imgData = tempCanvas.toDataURL('image/png');
        
        // 5. Add a page to the PDF with the original dimensions
        doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'l' : 'p');
        // Add the high-resolution image, which jsPDF will scale down to fit the page
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    }
    
    doc.save('modified-document.pdf');
    loadingMessage.style.display = 'none';
});

// Sidebar Toggle
document.getElementById('sidebar-toggle').addEventListener('click', () => {
    document.body.classList.toggle('sidebar-collapsed');
    if (!isContinuousView) {
        render(); // Re-render to adjust for new container size in single-page view
    }
});

// Keyboard Navigation
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT') return;

    if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        printStandardPDF();
        return;
    }

    if (e.key === 'ArrowLeft') {
        document.getElementById('prev-page').click();
    } else if (e.key === 'ArrowRight') {
        document.getElementById('next-page').click();
    }
});

// Live Settings Update
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "settingsChanged") {
        loadAndApplySettings();
        render(); // Re-render to apply color changes
    }
});

// Close dropdown when clicking outside
window.addEventListener('click', (event) => {
    if (!downloadBtn.contains(event.target)) {
        downloadDropdown.classList.remove('show');
    }
    if (!printBtn.contains(event.target)) {
        printDropdown.classList.remove('show');
    }
});

// --- Print Controls ---

async function printStandardPDF() {
    printDropdown.classList.remove('show');
    try {
        const response = await fetch(pdfUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        document.body.appendChild(iframe);
        iframe.onload = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            URL.revokeObjectURL(blobUrl);
            setTimeout(() => iframe.remove(), 1000); 
        };
    } catch (error) {
        console.error('Standard print failed:', error);
        alert('Could not prepare the standard PDF for printing.');
    }
}

document.getElementById('print-standard-btn').addEventListener('click', printStandardPDF);

document.getElementById('print-modified-btn').addEventListener('click', async () => {
    printDropdown.classList.remove('show');
    loadingMessage.textContent = 'Preparing Modified PDF for Print...';
    loadingMessage.style.display = 'block';

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt' });
        doc.deletePage(1);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const pageViewport = page.getViewport({ scale: 1.0, rotation });
            const { width: pageWidth, height: pageHeight } = pageViewport;
            const renderViewport = page.getViewport({ scale: 2.0, rotation });

            const canvas = document.createElement('canvas');
            canvas.width = renderViewport.width;
            canvas.height = renderViewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;

            let filter = '';
            if (invertColors) filter += ' invert(1)';
            if (grayscale) filter += ' grayscale(1)';
            if (blueLightFilter) filter += ` sepia(${blueLightIntensity / 100})`;
            filter += ` contrast(${contrastLevel}%)`;

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.filter = filter.trim();
            tempCtx.drawImage(canvas, 0, 0);

            const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);

            doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'l' : 'p');
            doc.addImage(imgData, 'JPEG', 0, 0, pageWidth, pageHeight);
        }

        const pdfBlob = doc.output('blob');
        const blobUrl = URL.createObjectURL(pdfBlob);

        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';

        const cleanup = () => {
            URL.revokeObjectURL(blobUrl);
            if (iframe.parentNode) {
                iframe.parentNode.removeChild(iframe);
            }
        };

        iframe.onload = () => {
            try {
                if (!iframe.contentWindow) {
                    throw new Error("Cannot access print content.");
                }
                // Tell the window to close itself after printing
                iframe.contentWindow.onafterprint = cleanup;
                // Trigger the print dialog
                iframe.contentWindow.print();
            } catch (e) {
                console.error("Print failed:", e);
                cleanup(); // Clean up on failure
                // As a fallback, open in a new tab
                alert("Could not open print dialog. Opening in new tab as a fallback.");
                window.open(blobUrl, '_blank');
            }
        };

        iframe.src = blobUrl;
        document.body.appendChild(iframe);

    } catch (error) {
        console.error('Modified print preparation failed:', error);
        alert('Could not prepare the modified PDF for printing.');
    } finally {
        loadingMessage.style.display = 'none';
    }
});

// DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    loadAndApplySettings();
    loadPdf(pdfUrl);
});