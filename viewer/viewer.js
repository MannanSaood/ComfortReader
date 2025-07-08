// viewer/viewer.js

// Import PDF.js
import * as pdfjsLib from './pdfjs/pdf.mjs'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdfjs/pdf.worker.mjs');

// --- Constants ---
const PDF_URL = new URLSearchParams(window.location.search).get('file');
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_INCREMENT = 0.1;
const ROTATION_INCREMENT = 90;
const SIDEBAR_THUMB_SCALE = 0.18;
const MODIFIED_PDF_RENDER_SCALE = 2.0;

// --- DOM Elements ---
const DOM = {
    container: document.getElementById('pdf-container'),
    loadingMessage: document.getElementById('loading-message'),
    pageNumberInput: document.getElementById('page-number'),
    pageCount: document.getElementById('page-count'),
    zoomLevel: document.getElementById('zoom-level'),
    sidebarContent: document.getElementById('sidebar-content'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    invertToggle: document.getElementById('invert-toggle'),
    grayscaleToggle: document.getElementById('grayscale-toggle'),
    viewModeToggle: document.getElementById('view-mode-toggle'),
    rotateBtn: document.getElementById('rotate-btn'),
    downloadBtn: document.getElementById('download-btn'),
    downloadDropdown: document.getElementById('download-dropdown'),
    downloadStandardBtn: document.getElementById('download-standard-btn'),
    downloadModifiedBtn: document.getElementById('download-modified-btn'),
    printBtn: document.getElementById('print-btn'),
    printDropdown: document.getElementById('print-dropdown'),
    printStandardBtn: document.getElementById('print-standard-btn'),
    printModifiedBtn: document.getElementById('print-modified-btn'),
    body: document.body,
};

// --- Application State ---
const state = {
    pdfDoc: null,
    currentPage: 1,
    totalPages: 1,
    rotation: 0,
    zoomLevel: 1.0,
    isContinuousView: false,
    filters: {
        invert: false,
        grayscale: false,
        blueLight: false,
        blueLightIntensity: 50,
        contrast: 100,
    }
};

// --- Rendering ---

/**
 * Main render dispatcher. Calls the correct render function based on view mode.
 */
async function render() {
    if (state.isContinuousView) {
        await renderContinuousView();
    } else {
        await renderSinglePageView();
    }
}

/**
 * Renders a single page, scaled to fit the container.
 */
async function renderSinglePageView() {
    DOM.container.innerHTML = '';
    if (!state.pdfDoc) return;
    const page = await state.pdfDoc.getPage(state.currentPage);

    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
    await renderPage(page, viewport, DOM.container);
}

/**
 * Renders all pages for a continuous, scrollable view.
 */
async function renderContinuousView() {
    DOM.container.innerHTML = '';
    if (!state.pdfDoc) return;
    const pagePlaceholders = [];

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
        const pageDiv = document.createElement('div');
        pageDiv.id = `page-container-${pageNum}`;
        pageDiv.className = 'page-container';
        pageDiv.dataset.pageNumber = pageNum;
        DOM.container.appendChild(pageDiv);
        pagePlaceholders.push(pageDiv);
    }

    const renderObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            if (entry.isIntersecting) {
                const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
                if (!entry.target.hasChildNodes()) {
                    const page = await state.pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    await renderPage(page, viewport, entry.target);
                }
            }
        });
    }, { rootMargin: '500px 0px' });

    pagePlaceholders.forEach(div => renderObserver.observe(div));

    // Scroll to the current page's placeholder to ensure it's in view.
    const targetPage = document.getElementById(`page-container-${state.currentPage}`);
    if (targetPage) {
        targetPage.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
}

/**
 * Applies current filter settings to a canvas context or element style.
 * @param {HTMLElement | CanvasRenderingContext2D} target - The canvas or element to apply filters to.
 */
function applyCanvasFilters(target) {
    const { invert, grayscale, blueLight, blueLightIntensity, contrast } = state.filters;
    let filterString = '';
    if (invert) filterString += ' invert(1)';
    if (grayscale) filterString += ' grayscale(1)';
    if (blueLight) filterString += ` sepia(${blueLightIntensity / 100})`;
    filterString += ` contrast(${contrast}%)`;

    if (target instanceof CanvasRenderingContext2D) {
        target.filter = filterString.trim();
    } else {
        target.style.filter = filterString.trim();
    }
}

/**
 * Renders a single PDF page to a canvas with high-DPI scaling.
 * @param {import('./pdfjs/pdf.mjs').PDFPageProxy} page The PDF page object.
 * @param {import('./pdfjs/pdf.mjs').PDFPageViewport} viewport The viewport with desired scale and rotation.
 * @param {HTMLElement} container The DOM element to append the canvas to.
 */
async function renderPage(page, viewport, container) {
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewport.width * dpr;
    canvas.height = viewport.height * dpr;
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const canvasContext = canvas.getContext('2d');
    canvasContext.scale(dpr, dpr);

    applyCanvasFilters(canvas);

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
    state.currentPage = num;
    DOM.pageNumberInput.value = num;
    highlightSidebarThumbnail(num);
}

/**
 * Highlights the active thumbnail in the sidebar.
 * @param {number} pageNum The page number to highlight.
 */
function highlightSidebarThumbnail(pageNum) {
    DOM.sidebarContent.querySelectorAll('.sidebar-thumb').forEach((thumb, idx) => {
        thumb.classList.toggle('selected', idx + 1 === pageNum);
    });
}

/**
 * Applies the current filter settings to all sidebar thumbnails.
 */
function updateSidebarFilter() {
    const { invert, grayscale } = state.filters;
    let filter = '';
    if (invert) filter += ' invert(1)';
    if (grayscale) filter += ' grayscale(1)';

    DOM.sidebarContent.querySelectorAll('.sidebar-thumb').forEach(thumb => {
        thumb.style.filter = filter.trim();
    });
}

/**
 * Renders all the page thumbnails for the sidebar.
 * @param {import('./pdfjs/pdf.mjs').PDFDocumentProxy} pdf The loaded PDF document.
 */
async function renderSidebarThumbnails(pdf) {
    DOM.sidebarContent.innerHTML = '';
    const fragment = document.createDocumentFragment();

    const { invert, grayscale } = state.filters;
    let filterString = '';
    if (invert) filterString += ' invert(1)';
    if (grayscale) filterString += ' grayscale(1)';
    filterString = filterString.trim();

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: SIDEBAR_THUMB_SCALE });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'sidebar-thumb';

        if (filterString) {
            canvas.style.filter = filterString;
        }

        canvas.addEventListener('click', () => {
            if (state.isContinuousView) {
                document.getElementById(`page-container-${pageNum}`)?.scrollIntoView({ behavior: 'smooth' });
            } else {
                updateCurrentPage(pageNum);
                render();
            }
        });

        fragment.appendChild(canvas);
        page.render({ canvasContext: canvas.getContext('2d'), viewport });
    }
    DOM.sidebarContent.appendChild(fragment);
    highlightSidebarThumbnail(state.currentPage);
}

// --- Settings Management ---

function applySettings(settings) {
    if (settings.warmColor) {
        document.documentElement.style.setProperty('--background-color', settings.warmColor);
    }
    state.filters.invert = settings.invertColors || false;
    state.filters.grayscale = settings.grayscale || false;
    state.filters.blueLight = settings.blueLightFilter || false;
    state.filters.blueLightIntensity = settings.blueLightIntensity || 50;
    state.filters.contrast = settings.contrastLevel || 100;

    DOM.invertToggle.checked = state.filters.invert;
    DOM.grayscaleToggle.checked = state.filters.grayscale;
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

// --- PDF Generation ---

/**
 * Generates a new PDF with the current visual modifications (filters, rotation).
 * @returns {Promise<Blob>} A promise that resolves with the Blob of the generated PDF.
 */
async function generateModifiedPdf() {
    DOM.loadingMessage.textContent = 'Generating Modified PDF...';
    DOM.loadingMessage.style.display = 'block';

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt' });
    doc.deletePage(1);

    for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
        const page = await state.pdfDoc.getPage(pageNum);
        const pageViewport = page.getViewport({ scale: 1.0, rotation: state.rotation });
        const { width: pageWidth, height: pageHeight } = pageViewport;
        const renderViewport = page.getViewport({ scale: MODIFIED_PDF_RENDER_SCALE, rotation: state.rotation });

        const canvas = document.createElement('canvas');
        canvas.width = renderViewport.width;
        canvas.height = renderViewport.height;

        await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        applyCanvasFilters(tempCtx);
        tempCtx.drawImage(canvas, 0, 0);

        const imgData = tempCanvas.toDataURL('image/png');

        doc.addPage([pageWidth, pageHeight], pageWidth > pageHeight ? 'l' : 'p');
        doc.addImage(imgData, 'PNG', 0, 0, pageWidth, pageHeight);
    }

    DOM.loadingMessage.style.display = 'none';
    return doc.output('blob');
}

// --- Initial Load ---

/**
 * Main function to load the PDF and initialize the viewer.
 */
async function initializeViewer() {
    DOM.loadingMessage.style.display = 'block';
    try {
        state.pdfDoc = await pdfjsLib.getDocument(PDF_URL).promise;
        state.totalPages = state.pdfDoc.numPages;

        updateCurrentPage(1);
        DOM.pageCount.textContent = `/ ${state.totalPages}`;
        DOM.zoomLevel.textContent = `${Math.round(state.zoomLevel * 100)}%`;

        await renderSidebarThumbnails(state.pdfDoc);
        await render();

    } catch (error) {
        console.error("Failed to load PDF:", error);
        DOM.loadingMessage.textContent = 'Failed to load PDF.';
    } finally {
        DOM.loadingMessage.style.display = 'none';
    }
}

// --- Event Handlers ---

function handlePageNavigation(direction) {
    let newPage = state.currentPage + direction;
    if (newPage >= 1 && newPage <= state.totalPages) {
        if (state.isContinuousView) {
            document.getElementById(`page-container-${newPage}`)?.scrollIntoView({ behavior: 'smooth' });
        } else {
            updateCurrentPage(newPage);
            render();
        }
    }
}

function handleZoom(direction) {
    const newZoom = state.zoomLevel + (direction * ZOOM_INCREMENT);
    if (newZoom >= MIN_ZOOM && newZoom <= MAX_ZOOM) {
        state.zoomLevel = newZoom;
        DOM.zoomLevel.textContent = `${Math.round(state.zoomLevel * 100)}%`;
        render();
    }
}

function handleDropdown(dropdown, otherDropdown) {
    otherDropdown.classList.remove('show');
    dropdown.classList.toggle('show');
}

async function handleStandardDownload() {
    DOM.downloadDropdown.classList.remove('show');
    try {
        const response = await fetch(PDF_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = PDF_URL.split('/').pop() || 'document.pdf';
        DOM.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Standard download failed:', error);
        alert('Could not download the PDF. The file URL may be invalid or expired.');
    }
}

async function handleModifiedDownload() {
    DOM.downloadDropdown.classList.remove('show');
    const blob = await generateModifiedPdf();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified-document.pdf';
    DOM.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

/**
 * Creates an iframe with the given blob URL and triggers the print dialog.
 * @param {string} blobUrl - The URL of the blob to print.
 */
function printBlob(blobUrl) {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = blobUrl;

    const cleanup = () => {
        URL.revokeObjectURL(blobUrl);
        iframe.remove();
        window.removeEventListener('afterprint', cleanup);
    };

    window.addEventListener('afterprint', cleanup);

    DOM.body.appendChild(iframe);
    iframe.onload = () => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
    };
}

async function handleStandardPrint() {
    DOM.printDropdown.classList.remove('show');
    try {
        const response = await fetch(PDF_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        printBlob(blobUrl);
    } catch (error) {
        console.error('Standard print failed:', error);
        alert('Could not prepare the standard PDF for printing.');
    }
}

async function handleModifiedPrint() {
    DOM.printDropdown.classList.remove('show');
    const blob = await generateModifiedPdf();
    const blobUrl = URL.createObjectURL(blob);
    printBlob(blobUrl);
}

/**
 * A utility to prevent a function from being called too frequently.
 * @param {Function} func The function to throttle.
 * @param {number} limit The minimum time in ms between invocations.
 * @returns {Function} The throttled function.
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

/**
 * Calculates the current page based on the scroll position in continuous view.
 */
function updatePageOnScroll() {
    if (!state.isContinuousView) return;

    const { scrollTop, clientHeight } = DOM.container;
    const scrollCenter = scrollTop + (clientHeight / 2);

    let bestMatch = { pageNum: state.currentPage, distance: Infinity };

    const pages = DOM.container.querySelectorAll('.page-container');
    pages.forEach(pageElement => {
        if (pageElement.hasChildNodes()) {
            const pageTop = pageElement.offsetTop;
            const pageCenter = pageTop + (pageElement.offsetHeight / 2);
            const distance = Math.abs(scrollCenter - pageCenter);

            if (distance < bestMatch.distance) {
                bestMatch.distance = distance;
                bestMatch.pageNum = parseInt(pageElement.dataset.pageNumber, 10);
            }
        }
    });

    if (bestMatch.pageNum !== state.currentPage) {
        updateCurrentPage(bestMatch.pageNum);
    }
}

function initEventListeners() {
    // Page Navigation
    DOM.prevPageBtn.addEventListener('click', () => handlePageNavigation(-1));
    DOM.nextPageBtn.addEventListener('click', () => handlePageNavigation(1));
    DOM.pageNumberInput.addEventListener('change', (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > state.totalPages) val = state.totalPages;
        if (state.isContinuousView) {
            document.getElementById(`page-container-${val}`)?.scrollIntoView({ behavior: 'smooth' });
        } else {
            updateCurrentPage(val);
            render();
        }
    });

    // Zoom Controls
    DOM.zoomOutBtn.addEventListener('click', () => handleZoom(-1));
    DOM.zoomInBtn.addEventListener('click', () => handleZoom(1));

    // View Controls
    DOM.invertToggle.addEventListener('change', (e) => {
        state.filters.invert = e.target.checked;
        chrome.storage.sync.set({ invertColors: state.filters.invert });
        updateSidebarFilter();
        render();
    });

    DOM.grayscaleToggle.addEventListener('change', (e) => {
        state.filters.grayscale = e.target.checked;
        chrome.storage.sync.set({ grayscale: state.filters.grayscale });
        updateSidebarFilter();
        render();
    });

    DOM.viewModeToggle.addEventListener('change', (e) => {
        state.isContinuousView = e.target.checked;
        render();
    });

    // Action Controls
    DOM.rotateBtn.addEventListener('click', () => {
        state.rotation = (state.rotation + ROTATION_INCREMENT) % 360;
        render();
    });

    // Dropdowns
    DOM.downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDropdown(DOM.downloadDropdown, DOM.printDropdown);
    });
    DOM.printBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleDropdown(DOM.printDropdown, DOM.downloadDropdown);
    });
    window.addEventListener('click', () => {
        DOM.downloadDropdown.classList.remove('show');
        DOM.printDropdown.classList.remove('show');
    });

    // Download and Print buttons
    DOM.downloadStandardBtn.addEventListener('click', handleStandardDownload);
    DOM.downloadModifiedBtn.addEventListener('click', handleModifiedDownload);
    DOM.printStandardBtn.addEventListener('click', handleStandardPrint);
    DOM.printModifiedBtn.addEventListener('click', handleModifiedPrint);

    // Sidebar
    DOM.sidebarToggle.addEventListener('click', () => {
        DOM.body.classList.toggle('sidebar-collapsed');
        if (!state.isContinuousView) {
            render();
        }
    });

    // Main container scroll listener
    DOM.container.addEventListener('scroll', throttle(updatePageOnScroll, 150));

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;

        if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            handleStandardPrint();
            return;
        }

        switch (e.key) {
            case 'ArrowLeft': handlePageNavigation(-1); break;
            case 'ArrowRight': handlePageNavigation(1); break;
            case '+': case '=': if (e.ctrlKey) { e.preventDefault(); handleZoom(1); } break;
            case '-': if (e.ctrlKey) { e.preventDefault(); handleZoom(-1); } break;
        }
    });

    // Live Settings Update
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsChanged") {
            loadAndApplySettings();
            render();
        }
    });
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    loadAndApplySettings();
    initEventListeners();
    initializeViewer();
});