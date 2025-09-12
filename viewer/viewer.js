// viewer/viewer.js

// Import PDF.js
import * as pdfjsLib from './pdfjs/pdf.mjs'; 
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('viewer/pdfjs/pdf.worker.mjs');

class TextLayerBuilder {
    constructor({ textLayerDiv, pageIndex, viewport }) {
        this.textLayerDiv = textLayerDiv;
        this.textContent = null;
        this.renderingDone = false;
        this.pageNumber = pageIndex + 1;
        this.viewport = viewport;
        this.textDivs = [];
    }
    setTextContent(textContent) { this.textContent = textContent; }
    render() {
        if (!this.textContent) return;
        this.textLayerDiv.innerHTML = '';
        const textLayerFragment = document.createDocumentFragment();
        const { items, styles } = this.textContent;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        for (const item of items) {
            const tx = pdfjsLib.Util.transform(this.viewport.transform, item.transform);
            const style = styles[item.fontName];
            const words = item.str.split(/(\s+)/);
            if (words.length === 0) continue;
            const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
            ctx.font = `${fontSize}px ${style.fontFamily}`;
            let currentX = tx[4];
            for (const word of words) {
                if (word.trim().length > 0) {
                    const measuredWidth = ctx.measureText(word).width;
                    const span = document.createElement('span');
                    const spanStyle = span.style;
                    spanStyle.position = 'absolute';
                    spanStyle.whiteSpace = 'pre';
                    spanStyle.left = `${currentX}px`;
                    spanStyle.top = `${tx[5]}px`;
                    spanStyle.fontFamily = style.fontFamily;
                    spanStyle.fontSize = `${fontSize}px`;
                    spanStyle.transform = `scaleX(${tx[0] / fontSize})`;
                    spanStyle.transformOrigin = '0% 0%';
                    const ascent = style.ascent ? style.ascent * fontSize : (fontSize * 0.8);
                    spanStyle.top = `${tx[5] - ascent}px`;
                    span.textContent = word;
                    textLayerFragment.appendChild(span);
                    currentX += measuredWidth;
                } else {
                    currentX += ctx.measureText(word).width;
                }
            }
        }
        this.textLayerDiv.appendChild(textLayerFragment);
        this.renderingDone = true;
    }
    cancel() {}
}

// --- Constants ---
const PDF_URL = new URL(location.href).searchParams.get('file') || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf';
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3.0;
const ZOOM_INCREMENT = 0.1;
const ROTATION_INCREMENT = 90;
const MODIFIED_PDF_RENDER_SCALE = 2.0;
const { createApp, PDFViewer } = globalThis.pdfjsLib;

// --- DOM Elements ---
const DOM = {
    container: document.getElementById('pdf-container'),
    loadingMessage: document.getElementById('loading-message'),
    loadingOverlay: document.getElementById('loading-overlay'),
    pageNumberInput: document.getElementById('page-number'),
    pageCount: document.getElementById('page-count'),
    sidebarToggle: document.getElementById('sidebar-toggle'),
    fileNameDisplay: document.getElementById('file-name-display'),
    fileMenuBtn: document.getElementById('file-menu-btn'),
    openFileBtn: document.getElementById('open-file-btn'),
    sidebarPreview: document.getElementById('sidebar-preview'),
    sidebarContent: document.getElementById('sidebar-content'),
    firstPageBtn: document.getElementById('first-page-btn'),
    prevPageBtn: document.getElementById('prev-page'),
    nextPageBtn: document.getElementById('next-page'),
    lastPageBtn: document.getElementById('last-page-btn'),
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    zoomLevelDisplayBtn: document.getElementById('zoom-level-display-btn'),
    zoomDropdown: document.getElementById('zoom-dropdown'),
    zoomAutoBtn: document.getElementById('zoom-auto-btn'),
    zoomActualBtn: document.getElementById('zoom-actual-btn'),
    zoomFitBtn: document.getElementById('zoom-fit-btn'),
    zoomWidthBtn: document.getElementById('zoom-width-btn'),
    invertToggle: document.getElementById('invert-toggle'),
    grayscaleToggle: document.getElementById('grayscale-toggle'),
    viewModeToggle: document.getElementById('view-mode-toggle'),
    horizontalViewToggle: document.getElementById('horizontal-view-toggle'),
    invertScrollToggle: document.getElementById('invert-scroll-toggle'),
    viewmodeCategoryBtn: document.getElementById('viewmode-category-btn'),
    downloadBtn: document.getElementById('download-btn'),
    downloadDropdown: document.getElementById('download-dropdown'),
    downloadStandardBtn: document.getElementById('download-standard-btn'),
    downloadModifiedBtn: document.getElementById('download-modified-btn'),
    printBtn: document.getElementById('print-btn'),
    printDropdown: document.getElementById('print-dropdown'),
    printStandardBtn: document.getElementById('print-standard-btn'),
    printModifiedBtn: document.getElementById('print-modified-btn'),
    spreadModeBtn: document.getElementById('spread-mode-btn'),
    spreadModeDropdown: document.getElementById('spread-mode-dropdown'),
    spreadNoneBtn: document.getElementById('spread-none-btn'),
    spreadOddBtn: document.getElementById('spread-odd-btn'),
    spreadEvenBtn: document.getElementById('spread-even-btn'),
    presentationModeBtn: document.getElementById('presentation-mode-btn'),
    handToolToggle: document.getElementById('hand-tool-toggle'),
    highlighterToolBtn: document.getElementById('highlighter-tool-btn'),
    highlighterSettings: document.getElementById('highlighter-settings'),
    highlighterColor: document.getElementById('highlighter-color'),
    highlighterSize: document.getElementById('highlighter-size'),
    pencilToolBtn: document.getElementById('pencil-tool-btn'),
    pencilSettings: document.getElementById('pencil-settings'),
    pencilColor: document.getElementById('pencil-color'),
    pencilSize: document.getElementById('pencil-size'),
    eraserToolBtn: document.getElementById('eraser-tool-btn'),
    eraserSettings: document.getElementById('eraser-settings'),
    eraserSize: document.getElementById('eraser-size'),
    textToolBtn: document.getElementById('text-tool-btn'),
    textSettings: document.getElementById('text-settings'),
    textFont: document.getElementById('text-font'),
    textSize: document.getElementById('text-size'),
    textColor: document.getElementById('text-color'),
    imageToolBtn: document.getElementById('image-tool-btn'),
    signatureToolBtn: document.getElementById('signature-tool-btn'),
    signatureModal: document.getElementById('signature-modal'),
    signatureCanvas: document.getElementById('signature-canvas'),
    signatureClearBtn: document.getElementById('signature-clear-btn'),
    signatureSaveBtn: document.getElementById('signature-save-btn'),
    signatureCancelBtn: document.getElementById('signature-cancel-btn'),
    docPropertiesBtn: document.getElementById('doc-properties-btn'),
    docPropertiesModal: document.getElementById('doc-properties-modal'),
    docPropertiesContent: document.getElementById('doc-properties-content'),
    docPropertiesCloseBtn: document.getElementById('doc-properties-close-btn'),
    customizeBtn: document.getElementById('customize-btn'),
    annotationDropdown: document.getElementById('annotation-dropdown'),
    rotateLeftBtn: document.getElementById('rotate-left-btn'),
    rotateRightBtn: document.getElementById('rotate-right-btn'),
    comicModeBtn: document.getElementById('comic-mode-btn'),
    mangaModeBtn: document.getElementById('manga-mode-btn'),
    body: document.body,
};

// --- Application State ---
const state = {
    pdfDoc: null, currentPage: 1, totalPages: 1, rotation: 0, zoomLevel: 1.0, zoomMode: 'auto', isContinuousView: true, isHorizontalView: false, invertScroll: false, isPresentationMode: false, isHandToolActive: false, prePresentationState: null,
    highlighter: { isActive: false, color: '#FFFF00', size: 20 },
    pencil: { isActive: false, color: '#000000', size: 3, shapeCorrectionTimeout: null },
    eraser: { isActive: false, size: 20 },
    text: { isActive: false, isDrawing: false, startCoords: { x: 0, y: 0 }, font: 'Arial', size: 16, color: '#000000' },
    image: { isActive: false },
    signature: { isActive: false, src: null },
    selectedAnnotation: { pageNum: null, index: -1, isDragging: false, isResizing: false, resizeHandle: null, offsetX: 0, offsetY: 0 },
    docInfo: null, annotations: {}, spreadMode: 'none',
    filters: { invert: false, grayscale: false, blueLight: false, blueLightIntensity: 50, contrast: 100 },
    isComicMode: false, readingDirection: 'ltr', comicPages: [], comicZoomLevel: 1.0,
};

// --- Rendering ---
async function render() {
    if (state.isComicMode) {
        await renderComicBookView();
        return;
    }
    if (state.isContinuousView) {
        await renderContinuousView();
    } else {
        await renderSinglePageView();
    }
}
async function renderComicBookView() {
    DOM.container.innerHTML = '';
    if (state.comicPages.length === 0) return;
    const spreadContainer = document.createElement('div');
    spreadContainer.className = 'spread-container';
    const pageNum = state.currentPage;
    const pagesToRender = [];
    if (state.spreadMode === 'none' || (state.spreadMode === 'even' && pageNum === state.totalPages) || (state.spreadMode === 'odd' && pageNum === 1)) {
        pagesToRender.push(state.comicPages[pageNum - 1]);
    } else {
        let page1Num;
        if (state.spreadMode === 'odd') { // Spreads are (2,3), (4,5)...
            page1Num = (pageNum % 2 === 0) ? pageNum : pageNum - 1;
        } else { // 'even' spread (1,2), (3,4)...
            page1Num = (pageNum % 2 !== 0) ? pageNum : pageNum - 1;
        }
        
        if (state.comicPages[page1Num -1]) pagesToRender.push(state.comicPages[page1Num -1]);
        if (state.comicPages[page1Num]) pagesToRender.push(state.comicPages[page1Num]);
    }
    pagesToRender.forEach(imageUrl => {
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.className = 'comic-page-image';
            spreadContainer.appendChild(img);
        }
    });
    DOM.container.appendChild(spreadContainer);
}
async function renderSinglePageView() {
    DOM.container.innerHTML = '';
    if (!state.pdfDoc) return;
    const pageNum = state.currentPage;
    const { spreadMode, totalPages } = state;
    const isOddSpread = spreadMode === 'odd';
    const isFirstPageAlone = isOddSpread && pageNum === 1;
    const isLastPageAlone = (isOddSpread && totalPages % 2 === 1 && pageNum === totalPages) ||
                           (!isOddSpread && totalPages % 2 === 1 && pageNum === totalPages);
    if (spreadMode === 'none' || isFirstPageAlone || isLastPageAlone) {
        const page = await state.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
        await renderPage(page, viewport, DOM.container);
    } else {
        let page1Num, page2Num;
        if (isOddSpread) {
            page1Num = (pageNum % 2 === 0) ? pageNum : pageNum - 1;
        } else {
            page1Num = (pageNum % 2 === 1) ? pageNum : pageNum - 1;
        }
        page2Num = page1Num + 1;
        if (page1Num >= 1 && page2Num <= totalPages) {
            const page1 = await state.pdfDoc.getPage(page1Num);
            const page2 = await state.pdfDoc.getPage(page2Num);
            const viewport1 = page1.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
            const viewport2 = page2.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
            const spreadContainer = document.createElement('div');
            spreadContainer.className = 'spread-container';
            await renderPage(page1, viewport1, spreadContainer);
            await renderPage(page2, viewport2, spreadContainer);
            DOM.container.appendChild(spreadContainer);
        } else {
            const page = await state.pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
            await renderPage(page, viewport, DOM.container);
        }
    }
}
async function renderContinuousView() {
    DOM.container.innerHTML = '';
    if (!state.pdfDoc) return;
    DOM.container.classList.add('continuous-view');
    const pagePlaceholders = [];
    let pageNum = 1;
    while (pageNum <= state.totalPages) {
        const pageContainer = document.createElement('div');
        pageContainer.id = `page-container-${pageNum}`;
        pageContainer.className = 'page-container';
        pageContainer.dataset.pageNumber = pageNum;
        const isSpread = state.spreadMode !== 'none';
        const isOddSpread = state.spreadMode === 'odd';
        const { totalPages } = state;
        const isFirstPageAlone = isOddSpread && pageNum === 1;
        const isLastPageAlone = (isOddSpread && totalPages % 2 === 1 && pageNum === totalPages) ||
                               (!isOddSpread && totalPages % 2 === 1 && pageNum === totalPages);
        if (!isSpread || isFirstPageAlone || isLastPageAlone) {
            pageContainer.dataset.pageCount = 1;
            pagePlaceholders.push(pageContainer);
            DOM.container.appendChild(pageContainer);
            pageNum++;
        } else {
            pageContainer.dataset.pageCount = 2;
            pageContainer.dataset.secondPageNumber = pageNum + 1;
            pagePlaceholders.push(pageContainer);
            DOM.container.appendChild(pageContainer);
            pageNum += 2;
        }
    }
    const renderObserver = new IntersectionObserver((entries) => {
        entries.forEach(async (entry) => {
            if (entry.isIntersecting && !entry.target.hasChildNodes()) {
                const pageNum = parseInt(entry.target.dataset.pageNumber, 10);
                const pageCount = parseInt(entry.target.dataset.pageCount, 10);
                if (pageCount === 1) {
                    const page = await state.pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    await renderPage(page, viewport, entry.target);
                } else {
                    const page1Num = pageNum;
                    const page2Num = parseInt(entry.target.dataset.secondPageNumber, 10);
                    const page1 = await state.pdfDoc.getPage(page1Num);
                    const page2 = await state.pdfDoc.getPage(page2Num);
                    const viewport1 = page1.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    const viewport2 = page2.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    const spreadContainer = document.createElement('div');
                    spreadContainer.className = 'spread-container';
                    await renderPage(page1, viewport1, spreadContainer);
                    await renderPage(page2, viewport2, spreadContainer);
                    entry.target.appendChild(spreadContainer);
                }
            }
        });
    }, { rootMargin: '500px 0px' });
    pagePlaceholders.forEach(div => renderObserver.observe(div));
    const targetPage = document.getElementById(`page-container-${state.currentPage}`);
    if (targetPage) {
        targetPage.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
}
async function renderPage(page, viewport, container) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.style.position = 'relative';
    pageDiv.style.width = `${viewport.width}px`;
    pageDiv.style.height = `${viewport.height}px`;
    const canvas = document.createElement('canvas');
    const annotationLayer = document.createElement('canvas');
    const textLayerDiv = document.createElement('div');
    annotationLayer.style.backgroundColor = 'transparent';
    textLayerDiv.style.backgroundColor = 'transparent';
    [canvas, annotationLayer, textLayerDiv].forEach(layer => {
        layer.style.position = 'absolute';
        layer.style.left = '0';
        layer.style.top = '0';
        layer.style.right = '0';
        layer.style.bottom = '0';
    });
    canvas.style.zIndex = '0';
    annotationLayer.style.zIndex = '1';
    textLayerDiv.style.zIndex = '2';
    textLayerDiv.className = 'textLayer';
    textLayerDiv.style.overflow = 'hidden';
    annotationLayer.className = 'annotationLayer';
    pageDiv.appendChild(canvas);
    pageDiv.appendChild(annotationLayer);
    pageDiv.appendChild(textLayerDiv);
    const dpr = window.devicePixelRatio || 1;
    [canvas, annotationLayer].forEach(cvs => {
        cvs.width = viewport.width * dpr;
        cvs.height = viewport.height * dpr;
        cvs.style.width = `${viewport.width}px`;
        cvs.style.height = `${viewport.height}px`;
    });
    const canvasContext = canvas.getContext('2d');
    const { invert, grayscale, blueLight, blueLightIntensity, contrast } = state.filters;
    let filterString = '';
    if (invert) filterString += ' invert(1)';
    if (grayscale) filterString += ' grayscale(1)';
    if (blueLight) filterString += ` sepia(${blueLightIntensity / 100})`;
    filterString += ` contrast(${contrast}%)`;
    canvas.style.filter = filterString.trim();
    canvasContext.scale(dpr, dpr);
    if (container.className.includes('page-container')) {
        container.innerHTML = '';
    }
    container.appendChild(pageDiv);
    const renderTask = page.render({ canvasContext, viewport });
    const textContent = await page.getTextContent();
    const textLayer = new TextLayerBuilder({
        textLayerDiv: textLayerDiv,
        pageIndex: page.pageIndex,
        viewport: viewport,
    });
    textLayer.setTextContent(textContent);
    await renderTask.promise;
    textLayer.render();
    redrawAnnotations(page.pageNumber, annotationLayer.getContext('2d'), viewport);
}
function redrawAnnotations(pageNum, context, viewport) {
    const pageAnnotations = state.annotations[pageNum];
    if (!pageAnnotations) return;
    const dpr = window.devicePixelRatio || 1;
    context.save();
    context.scale(dpr, dpr);
    pageAnnotations.forEach((annotation, index) => {
        if (state.selectedAnnotation.pageNum === pageNum && state.selectedAnnotation.index === index) {
            context.save();
            context.strokeStyle = 'rgba(0, 123, 255, 0.9)';
            context.lineWidth = 1;
            context.setLineDash([5, 5]);
            const zoom = viewport.scale;
            if (annotation.type === 'text' || annotation.type === 'image') {
                const width = annotation.width || (annotation.size * annotation.content.length * 0.5); 
                const height = annotation.height || annotation.size;
                context.strokeRect(annotation.x * zoom - 2, annotation.y * zoom - 2, width * zoom + 4, height * zoom + 4);
                context.fillStyle = 'rgba(0, 123, 255, 0.9)';
                const handles = getResizeHandles(annotation, viewport);
                handles.forEach(handle => {
                    context.fillRect(handle.x, handle.y, handle.width, handle.height);
                });
            }
            context.restore();
        }
        if (annotation.type === 'highlight' || annotation.type === 'pencil') {
            context.save();
            context.lineCap = 'round';
            context.lineJoin = 'round';
            if (annotation.type === 'highlight') {
                context.globalAlpha = 0.5; 
            } else {
                context.globalAlpha = 1.0;
            }
            if (annotation.paths) {
                context.strokeStyle = annotation.color;
                context.lineWidth = annotation.size * viewport.scale;
                annotation.paths.forEach(path => {
                    context.beginPath();
                    if (path.length > 0) {
                        context.moveTo(path[0].x * viewport.scale, path[0].y * viewport.scale);
                        for (let i = 1; i < path.length; i++) {
                            context.lineTo(path[i].x * viewport.scale, path[i].y * viewport.scale);
                        }
                        context.stroke();
                    }
                });
            } else if (annotation.rects) {
                context.fillStyle = annotation.color;
                annotation.rects.forEach(rect => {
                    context.fillRect(rect.x * viewport.scale, rect.y * viewport.scale, rect.width * viewport.scale, rect.height * viewport.scale);
                });
            }
            context.restore();
        } else if (annotation.type === 'text') {
            const zoom = viewport.scale;
            if (annotation.width === undefined || annotation.height === undefined) {
                const tempCtx = document.createElement('canvas').getContext('2d');
                tempCtx.font = `${annotation.size}px ${annotation.font}`;
                const metrics = tempCtx.measureText(annotation.content);
                annotation.width = metrics.width;
                annotation.height = annotation.size; 
            }
            context.font = `${annotation.size * zoom}px ${annotation.font}`;
            context.fillStyle = annotation.color;
            context.fillText(annotation.content, annotation.x * zoom, (annotation.y + annotation.size) * zoom);
        } else if (annotation.type === 'image') {
            const img = new Image();
            img.src = annotation.src;
            if (img.complete) {
                context.drawImage(img, annotation.x * viewport.scale, annotation.y * viewport.scale, annotation.width * viewport.scale, annotation.height * viewport.scale);
            } else {
                img.onload = () => {
                    context.drawImage(img, annotation.x * viewport.scale, annotation.y * viewport.scale, annotation.width * viewport.scale, annotation.height * viewport.scale);
                };
            }
        }
    });
    context.restore();
}

// --- UI Updates & Helpers ---
function updateCurrentPage(num) {
    state.currentPage = num;
    DOM.pageNumberInput.value = num;
    highlightSidebarThumbnail(num);
}
function highlightSidebarThumbnail(pageNum) {
    DOM.sidebarContent.querySelectorAll('.sidebar-thumb-container').forEach((container, idx) => {
        container.classList.toggle('selected', idx + 1 === pageNum);
    });
}
function updateSidebarFilter() {
    const { invert, grayscale } = state.filters;
    let filter = '';
    if (invert) filter += ' invert(1)';
    if (grayscale) filter += ' grayscale(1)';
    DOM.sidebarContent.querySelectorAll('.sidebar-thumb').forEach(thumb => {
        thumb.style.filter = filter.trim();
    });
}
// FIX: Updated to render sharper thumbnails
async function renderSidebarThumbnails(pdf) {
    DOM.sidebarContent.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'sidebar-thumb-container';
        thumbContainer.addEventListener('click', () => {
            if (state.isContinuousView) {
                document.getElementById(`page-container-${pageNum}`)?.scrollIntoView({ behavior: 'smooth' });
            } else {
                updateCurrentPage(pageNum);
                render();
            }
        });
        const canvas = document.createElement('canvas');
        canvas.className = 'sidebar-thumb';
        const pageNumberDiv = document.createElement('div');
        pageNumberDiv.className = 'sidebar-thumb-number';
        pageNumberDiv.textContent = pageNum;
        thumbContainer.appendChild(canvas);
        thumbContainer.appendChild(pageNumberDiv);
        fragment.appendChild(thumbContainer);
        // Render asynchronously to prevent blocking the UI thread
        (async () => {
            try {
                const page = await pdf.getPage(pageNum);
                // Render at a higher resolution for sharpness
                const scale = 2.0; 
                const viewport = page.getViewport({ scale, rotation: state.rotation });
                
                canvas.width = viewport.width;
                canvas.height = viewport.height;
                // CSS will scale it down to fit the sidebar
                canvas.style.width = "100%";
                canvas.style.height = "auto";

                await page.render({
                    canvasContext: canvas.getContext('2d'),
                    viewport
                }).promise;

                if (state.filters.invert || state.filters.grayscale) {
                    let filterString = '';
                    if (state.filters.invert) filterString += ' invert(1)';
                    if (state.filters.grayscale) filterString += ' grayscale(1)';
                    canvas.style.filter = filterString.trim();
                }
            } catch (error) {
                console.error(`Failed to render sidebar thumbnail for page ${pageNum}`, error);
            }
        })();
    }
    DOM.sidebarContent.appendChild(fragment);
    highlightSidebarThumbnail(state.currentPage);
}
async function renderComicSidebarThumbnails() {
    DOM.sidebarContent.innerHTML = '';
    const fragment = document.createDocumentFragment();
    state.comicPages.forEach((imageUrl, index) => {
        const pageNum = index + 1;
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'sidebar-thumb-container';
        thumbContainer.addEventListener('click', () => {
            updateCurrentPage(pageNum);
            render();
        });
        const img = document.createElement('img');
        img.src = imageUrl;
        img.className = 'sidebar-thumb';
        img.loading = 'lazy';
        const pageNumberDiv = document.createElement('div');
        pageNumberDiv.className = 'sidebar-thumb-number';
        pageNumberDiv.textContent = pageNum;
        thumbContainer.appendChild(img);
        thumbContainer.appendChild(pageNumberDiv);
        fragment.appendChild(thumbContainer);
    });
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
async function generateModifiedPdf() {
    showLoader(true, 'Generating PDF...');
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF();
        const totalPages = state.pdfDoc.numPages;

        for (let i = 1; i <= totalPages; i++) {
            const page = await state.pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: MODIFIED_PDF_RENDER_SCALE, rotation: state.rotation });
            const sourceCanvas = document.createElement('canvas');
            sourceCanvas.width = viewport.width;
            sourceCanvas.height = viewport.height;
            const sourceCtx = sourceCanvas.getContext('2d');
            await page.render({ canvasContext: sourceCtx, viewport }).promise;
            const finalCanvas = document.createElement('canvas');
            finalCanvas.width = viewport.width;
            finalCanvas.height = viewport.height;
            const finalCtx = finalCanvas.getContext('2d');
            const { invert, grayscale, blueLight, blueLightIntensity, contrast } = state.filters;
            let filterString = '';
            if (invert) filterString += ' invert(1)';
            if (grayscale) filterString += ' grayscale(1)';
            if (blueLight) filterString += ` sepia(${blueLightIntensity / 100})`;
            filterString += ` contrast(${contrast}%)`;
            finalCtx.filter = filterString.trim();
            finalCtx.drawImage(sourceCanvas, 0, 0);
            finalCtx.filter = 'none';
            redrawAnnotations(i, finalCtx, viewport);
            const imgData = finalCanvas.toDataURL('image/png');
            if (i > 1) {
                pdf.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? 'l' : 'p');
            } else {
                pdf.deletePage(1);
                pdf.addPage([viewport.width, viewport.height], viewport.width > viewport.height ? 'l' : 'p');
            }
            pdf.addImage(imgData, 'PNG', 0, 0, viewport.width, viewport.height);
        }
        showLoader(false);
        return pdf.output('blob');
    } catch (error) {
        console.error("Failed to generate modified PDF:", error);
        showLoader(false);
        return null;
    }
}

// --- App Initialization ---
async function finishInitialization(pdf) {
    state.isComicMode = false;
    document.body.classList.remove('comic-mode-active');
    state.pdfDoc = pdf;
    state.totalPages = pdf.numPages;
    DOM.pageCount.textContent = `/ ${state.totalPages}`;
    DOM.pageNumberInput.max = state.totalPages;
    DOM.fileNameDisplay.value = PDF_URL.split('/').pop() || 'document.pdf';

    try {
        const metadata = await pdf.getMetadata();
        state.docInfo = metadata.info;
    } catch (metaError) {
        console.warn("Could not get PDF metadata:", metaError);
        state.docInfo = { Title: 'N/A', Author: 'N/A' };
    }
    
    await renderSidebarThumbnails(pdf);
    await render();
    updateZoomDisplay();

    DOM.loadingMessage.style.display = 'none';
    showLoader(false);
}
async function initializeViewer() {
    try {
        DOM.loadingMessage.textContent = 'Loading...';
        DOM.loadingMessage.style.display = 'block';

        const url = new URL(location.href);
        const filename = url.searchParams.get('file');

        if (!filename) {
            DOM.loadingMessage.textContent = 'No file specified.';
            return;
        }

        const extension = filename.split('.').pop().toLowerCase();

        if (extension === 'cbr' || extension === 'cbz') {
            await handleArchive(filename);
        } else {
            const pdf = await pdfjsLib.getDocument(filename).promise;
            await finishInitialization(pdf);
        }

    } catch (error) {
        console.error('Error initializing viewer:', error);
        DOM.loadingMessage.textContent = `Error: ${error.message}`;
        showLoader(false);
    }
}
async function handleArchive(url) {
    showLoader(true, 'Opening archive...');
    
    state.isComicMode = true;
    DOM.fileNameDisplay.value = url.split('/').pop() || 'archive.cbz';
    document.body.classList.add('comic-mode-active');

    const { Archive } = await import('./lib/libarchive.js/dist/libarchive.js');

    try {
        Archive.init({ workerUrl: './lib/libarchive.js/dist/worker-bundle.js' });
    } catch (e) { console.warn('Archive.init may have already been called:', e); }

    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const file = new File([blob], url.split('/').pop());

        const archive = await Archive.open(file);
        const files = await archive.extractFiles();

        function findImageFiles(obj, path = '') {
            let fileList = [];
            for (const key in obj) {
                const currentPath = path ? `${path}/${key}` : key;
                const item = obj[key];
                if (/\.(jpe?g|png|gif|webp)$/i.test(key)) {
                    fileList.push({ file: item, fullPath: currentPath });
                } else if (item && typeof item === 'object' && !item.extract) {
                    fileList = fileList.concat(findImageFiles(item, currentPath));
                }
            }
            return fileList;
        }

        const imageFiles = findImageFiles(files)
            .sort((a, b) => a.fullPath.localeCompare(b.fullPath, undefined, { numeric: true, sensitivity: 'base' }));

        if (imageFiles.length === 0) throw new Error('No images found in the archive.');
        
        showLoader(true, 'Loading images...');
        state.comicPages = [];
        for (const imageContainer of imageFiles) {
            state.comicPages.push(URL.createObjectURL(imageContainer.file));
        }

        state.totalPages = state.comicPages.length;
        DOM.pageCount.textContent = `/ ${state.totalPages}`;
        DOM.pageNumberInput.max = state.totalPages;
        DOM.loadingMessage.style.display = 'none';
        
        // FIX: Set comic-friendly defaults on load
        setSpreadMode('even');
        setZoomMode('fit');

        await renderComicSidebarThumbnails();
        await render();
        showLoader(false);

    } catch (extractionError) {
        console.error('A critical error occurred during archive handling:', extractionError);
        DOM.loadingMessage.textContent = `Error: ${extractionError.message}`;
        showLoader(false);
        throw extractionError;
    }
}

// --- Navigation & View Logic ---
async function goToPage(pageTarget) {
    let newPage;
    if (pageTarget === 'first') newPage = 1;
    else if (pageTarget === 'last') newPage = state.totalPages;
    else newPage = pageTarget;
    if (newPage < 1) newPage = 1;
    if (newPage > state.totalPages) newPage = state.totalPages;
    if (newPage >= 1 && newPage <= state.totalPages && newPage !== state.currentPage) {
        const needsAnimation = state.isComicMode || !state.isContinuousView;
        if (needsAnimation) {
            DOM.container.classList.add('page-changing');
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        updateCurrentPage(newPage);
        if (state.isComicMode || !state.isContinuousView) {
            await render();
        } else {
            document.getElementById(`page-container-${newPage}`)?.scrollIntoView({ behavior: 'smooth' });
        }
        if (needsAnimation) {
            DOM.container.classList.remove('page-changing');
        }
    }
}
async function handlePageNavigation(direction) {
    let newPage;
    const navDirection = state.readingDirection === 'rtl' ? -direction : direction;
    if (state.spreadMode !== 'none' && !state.isContinuousView) {
        const isOddSpread = state.spreadMode === 'odd';
        const currentPage = state.currentPage;
        let currentSpreadStart;
        if (isOddSpread) {
            currentSpreadStart = (currentPage === 1) ? 1 : (currentPage % 2 === 0 ? currentPage : currentPage - 1);
        } else {
            currentSpreadStart = (currentPage % 2 === 1) ? currentPage : currentPage - 1;
        }
        newPage = currentSpreadStart + (navDirection * 2);
        if (isOddSpread) {
            if (currentSpreadStart >= 2 && newPage < 2) newPage = 1;
            else if (currentSpreadStart === 1 && navDirection === 1) newPage = 2;
        }
    } else {
        newPage = state.currentPage + navDirection;
    }
    await goToPage(newPage);
}
function handleZoom(direction) {
    if (state.isComicMode) {
        let newZoom;
        if (typeof direction === 'number') newZoom = direction;
        else {
            const increment = direction === 'in' ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
            newZoom = state.comicZoomLevel + increment; 
        }
        state.comicZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        DOM.container.style.transform = `scale(${state.comicZoomLevel})`;
        state.zoomMode = 'percentage';
        updateZoomDisplay();
        return;
    }
    let newZoom;
    if (typeof direction === 'number') newZoom = direction;
    else {
        const increment = direction === 'in' ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
        newZoom = state.zoomLevel + increment;
    }
    state.zoomMode = 'percentage'; 
    state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    updateZoomDisplay();
    render();
}
async function togglePresentationMode() {
    state.isPresentationMode = !state.isPresentationMode;
    document.body.classList.toggle('presentation-mode', state.isPresentationMode);
    if (state.isPresentationMode) {
        state.prePresentationState = {
            spreadMode: state.spreadMode,
            isContinuousView: state.isContinuousView,
            zoomMode: state.zoomMode,
            zoomLevel: state.zoomLevel,
        };
        state.isContinuousView = false;
        DOM.viewModeToggle.checked = false;
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
            });
        } else {
            await setZoomMode('fit');
        }
    } else {
        if (state.prePresentationState) {
            state.spreadMode = state.prePresentationState.spreadMode;
            state.isContinuousView = state.prePresentationState.isContinuousView;
            state.zoomMode = state.prePresentationState.zoomMode;
            state.zoomLevel = state.prePresentationState.zoomLevel;
            state.prePresentationState = null;
            DOM.viewModeToggle.checked = state.isContinuousView;
        }
        await render();
        updateZoomDisplay();
        if (document.exitFullscreen && document.fullscreenElement) {
            document.exitFullscreen();
        }
    }
}
function handleKeydown(e) {
    if (e.target.tagName === 'INPUT' || e.target.isContentEditable) return;
    if (e.ctrlKey) {
        switch (e.key) {
            case '+': case '=': e.preventDefault(); handleZoom('in'); break;
            case '-': e.preventDefault(); handleZoom('out'); break;
            case 'p': togglePresentationMode(); break;
            case 'h': DOM.highlighterToolBtn.click(); break;
            case 'd': DOM.pencilToolBtn.click(); break;
            case 't': DOM.textToolBtn.click(); break;
            case 'g': DOM.handToolToggle.click(); break;
            case 'Escape': if (state.isPresentationMode) { togglePresentationMode(); } break;
        }
    } else {
        switch (e.key) {
            case 'ArrowLeft': handlePageNavigation(-1); break;
            case 'ArrowRight': handlePageNavigation(1); break;
            case 'Escape': if (state.isPresentationMode) { togglePresentationMode(); } break;
        }
    }
}
function handleWheel(e) {
    if (e.ctrlKey) {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY);
        const currentZoom = state.isComicMode ? state.comicZoomLevel : state.zoomLevel;
        const newZoom = currentZoom + delta * ZOOM_INCREMENT;
        handleZoom(newZoom);
    } else if (state.isContinuousView) {
        e.preventDefault();
        const scrollDirection = state.invertScroll ? -1 : 1;
        if (state.isHorizontalView) {
            DOM.container.scrollLeft += e.deltaY * scrollDirection;
        } else {
            DOM.container.scrollTop += e.deltaY * scrollDirection;
        }
    }
}
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
function updatePageOnScroll() {
    if (!state.isContinuousView || !state.pdfDoc) return;
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
function updateZoomDisplay() {
    let text;
    const zoomLevel = state.isComicMode ? state.comicZoomLevel : state.zoomLevel;
    switch (state.zoomMode) {
        case 'auto':    text = 'Auto'; break;
        case 'actual':  text = 'Actual Size'; break;
        case 'fit':     text = 'Page Fit'; break;
        case 'width':   text = 'Page Width'; break;
        default:        text = `${Math.round(zoomLevel * 100)}%`; break;
    }
    if (DOM.zoomLevelDisplayBtn) {
        DOM.zoomLevelDisplayBtn.textContent = text;
    }
}
async function setZoomMode(mode) {
    state.zoomMode = mode;
    if (state.isComicMode) {
        DOM.container.style.transform = 'scale(1)';
        state.comicZoomLevel = 1.0;
        DOM.container.classList.remove('zoom-fit', 'zoom-width', 'zoom-actual');
        switch (mode) {
            case 'fit': case 'auto': DOM.container.classList.add('zoom-fit'); break;
            case 'width': DOM.container.classList.add('zoom-width'); break;
            case 'actual': DOM.container.classList.add('zoom-actual'); break;
        }
        updateZoomDisplay();
        return;
    }
    let newScale = state.zoomLevel;
    if (!state.pdfDoc) return;
    const page = await state.pdfDoc.getPage(state.currentPage);
    const viewport = page.getViewport({ scale: 1, rotation: page.rotate }); 
    const containerWidth = DOM.container.clientWidth - 2 * parseFloat(getComputedStyle(DOM.container).paddingLeft);
    const containerHeight = DOM.container.clientHeight - 2 * parseFloat(getComputedStyle(DOM.container).paddingTop);
    switch (mode) {
        case 'actual': newScale = 1.0; break;
        case 'fit': case 'auto': newScale = Math.min(containerHeight / viewport.height, containerWidth / viewport.width); break;
        case 'width': newScale = containerWidth / viewport.width; break;
    }
    state.zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));
    updateZoomDisplay();
    render();
}
const setSpreadMode = (mode) => {
    state.spreadMode = mode;
    render();
    if(DOM.spreadModeDropdown) DOM.spreadModeDropdown.closest('.sidebar-dropdown-container').classList.remove('open');
};

// --- Action Handlers ---
async function handleStandardDownload() {
    if(DOM.downloadDropdown) DOM.downloadDropdown.closest('.sidebar-dropdown-container').classList.remove('open');
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
    if(DOM.downloadDropdown) DOM.downloadDropdown.closest('.sidebar-dropdown-container').classList.remove('open');
    const blob = await generateModifiedPdf();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'modified-document.pdf';
    DOM.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}
async function handleStandardPrint() {
    if(DOM.printDropdown) DOM.printDropdown.closest('.sidebar-dropdown-container').classList.remove('open');
    try {
        const response = await fetch(PDF_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
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
    } catch (error) {
        console.error('Standard print failed:', error);
        alert('Could not prepare the standard PDF for printing.');
    }
}
async function handleModifiedPrint() {
    if(DOM.printDropdown) DOM.printDropdown.closest('.sidebar-dropdown-container').classList.remove('open');
    showLoader(true, 'Preparing modified PDF for printing...');
    try {
        const blob = await generateModifiedPdf();
        if(!blob) { showLoader(false); return; }
        const blobUrl = URL.createObjectURL(blob);
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = blobUrl;
        let cleanupCalled = false;
        const cleanup = () => {
            if (cleanupCalled) return;
            cleanupCalled = true;
            URL.revokeObjectURL(blobUrl);
            iframe.remove();
            window.removeEventListener('afterprint', cleanup);
            showLoader(false);
        };
        window.addEventListener('afterprint', cleanup);
        iframe.onload = () => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
        };
        DOM.body.appendChild(iframe);
        setTimeout(cleanup, 15000);
    } catch (e) {
        console.error("Failed to generate modified PDF for print:", e);
        alert("Sorry, there was an error preparing your modified PDF for printing.");
        showLoader(false);
    }
}

// --- Event Listeners ---
function initEventListeners() {
    DOM.firstPageBtn.addEventListener('click', () => goToPage('first'));
    DOM.prevPageBtn.addEventListener('click', () => handlePageNavigation(-1));
    DOM.nextPageBtn.addEventListener('click', () => handlePageNavigation(1));
    DOM.lastPageBtn.addEventListener('click', () => goToPage('last'));
    DOM.zoomOutBtn.addEventListener('click', () => handleZoom('out'));
    DOM.zoomInBtn.addEventListener('click', () => handleZoom('in'));

    if(DOM.zoomLevelDisplayBtn) DOM.zoomLevelDisplayBtn.parentElement.addEventListener('click', (e) => {
        if(e.target === DOM.zoomLevelDisplayBtn) {
            e.currentTarget.classList.toggle('open');
        }
    });
    DOM.zoomAutoBtn.addEventListener('click', () => setZoomMode('auto'));
    DOM.zoomActualBtn.addEventListener('click', () => setZoomMode('actual'));
    DOM.zoomFitBtn.addEventListener('click', () => setZoomMode('fit'));
    DOM.zoomWidthBtn.addEventListener('click', () => setZoomMode('width'));

    document.querySelectorAll('.zoom-preset-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const zoomValue = parseFloat(e.target.dataset.zoom);
            handleZoom(zoomValue);
        });
    });

    DOM.pageNumberInput.addEventListener('change', () => {
        let val = parseInt(DOM.pageNumberInput.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > state.totalPages) val = state.totalPages;
        goToPage(val);
    });

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
        DOM.container.classList.toggle('continuous-view', state.isContinuousView);
        render();
    });
    DOM.horizontalViewToggle.addEventListener('change', (e) => {
        state.isHorizontalView = e.target.checked;
        DOM.container.classList.toggle('horizontal-view', state.isHorizontalView);
    });
    DOM.invertScrollToggle.addEventListener('change', (e) => {
        state.invertScroll = e.target.checked;
    });

    if(DOM.downloadBtn) DOM.downloadBtn.parentElement.addEventListener('click', (e) => {
        if(e.target === DOM.downloadBtn || e.target.parentElement === DOM.downloadBtn) e.currentTarget.classList.toggle('open');
    });
    if(DOM.printBtn) DOM.printBtn.parentElement.addEventListener('click', (e) => {
        if(e.target === DOM.printBtn || e.target.parentElement === DOM.printBtn) e.currentTarget.classList.toggle('open');
    });
    
    DOM.downloadStandardBtn.addEventListener('click', handleStandardDownload);
    DOM.downloadModifiedBtn.addEventListener('click', handleModifiedDownload);
    DOM.printStandardBtn.addEventListener('click', handleStandardPrint);
    DOM.printModifiedBtn.addEventListener('click', handleModifiedPrint);
    
    if(DOM.spreadModeBtn) DOM.spreadModeBtn.parentElement.addEventListener('click', (e) => {
        if(e.target === DOM.spreadModeBtn || e.target.parentElement === DOM.spreadModeBtn) e.currentTarget.classList.toggle('open');
    });

    DOM.spreadNoneBtn.addEventListener('click', () => setSpreadMode('none'));
    DOM.spreadOddBtn.addEventListener('click', () => setSpreadMode('odd'));
    DOM.spreadEvenBtn.addEventListener('click', () => setSpreadMode('even'));
    DOM.presentationModeBtn.addEventListener('click', togglePresentationMode);
    DOM.rotateLeftBtn.addEventListener('click', () => {
        state.rotation = (state.rotation - 90 + 360) % 360;
        render();
    });
    DOM.rotateRightBtn.addEventListener('click', () => {
        state.rotation = (state.rotation + 90) % 360;
        render();
    });
    
    [
        DOM.customizeBtn, 
        DOM.docPropertiesBtn.nextElementSibling.firstElementChild,
        DOM.viewmodeCategoryBtn
    ].forEach(btn => {
        if(btn) btn.parentElement.addEventListener('click', (e) => {
            if(e.target === btn || e.target.parentElement === btn) {
                e.currentTarget.classList.toggle('open');
            }
        });
    });

    if(DOM.comicModeBtn) {
        DOM.comicModeBtn.addEventListener('click', async () => {
            if (!state.isComicMode) return;
            state.readingDirection = 'ltr';
            DOM.invertScrollToggle.checked = false;
            state.invertScroll = false;
            setSpreadMode('even');
            setZoomMode('fit');
            if (!state.isPresentationMode) {
                await togglePresentationMode();
            }
        });
    }

    if(DOM.mangaModeBtn) {
        DOM.mangaModeBtn.addEventListener('click', async () => {
            if (!state.isComicMode) return;
            state.readingDirection = 'rtl';
            DOM.invertScrollToggle.checked = true;
            state.invertScroll = true;
            setSpreadMode('even');
            setZoomMode('fit');
            if (!state.isPresentationMode) {
                await togglePresentationMode();
            }
        });
    }

    DOM.handToolToggle.addEventListener('click', () => toggleTool('hand'));
    DOM.highlighterToolBtn.addEventListener('click', () => toggleTool('highlighter'));
    DOM.pencilToolBtn.addEventListener('click', () => toggleTool('pencil'));
    DOM.eraserToolBtn.addEventListener('click', () => toggleTool('eraser'));
    DOM.textToolBtn.addEventListener('click', () => toggleTool('text'));
    DOM.imageToolBtn.addEventListener('click', () => toggleTool('image'));
    DOM.signatureToolBtn.addEventListener('click', () => toggleTool('signature'));

    DOM.highlighterColor.addEventListener('input', (e) => state.highlighter.color = e.target.value);
    DOM.highlighterSize.addEventListener('input', (e) => state.highlighter.size = parseInt(e.target.value, 10));
    DOM.pencilColor.addEventListener('input', (e) => state.pencil.color = e.target.value);
    DOM.pencilSize.addEventListener('input', (e) => state.pencil.size = parseInt(e.target.value, 10));
    DOM.eraserSize.addEventListener('input', (e) => state.eraser.size = parseInt(e.target.value, 10));
    DOM.textFont.addEventListener('change', (e) => state.text.font = e.target.value);
    DOM.textSize.addEventListener('input', (e) => state.text.size = parseInt(e.target.value, 10));
    DOM.textColor.addEventListener('input', (e) => state.text.color = e.target.value);

    DOM.docPropertiesBtn.addEventListener('click', () => {
        const contentDiv = DOM.docPropertiesContent;
        contentDiv.innerHTML = '';
        const properties = [
            { label: 'File Name:', value: PDF_URL.split('/').pop() }, { label: 'Title:', value: state.docInfo.Title }, { label: 'Author:', value: state.docInfo.Author }, { label: 'Subject:', value: state.docInfo.Subject }, { label: 'Keywords:', value: state.docInfo.Keywords }, { label: 'Creator:', value: state.docInfo.Creator }, { label: 'Producer:', value: state.docInfo.Producer }, { label: 'Creation Date:', value: state.docInfo.CreationDate ? new Date(state.docInfo.CreationDate).toLocaleString() : 'N/A' }, { label: 'Modification Date:', value: state.docInfo.ModDate ? new Date(state.docInfo.ModDate).toLocaleString() : 'N/A' }, { label: 'PDF Version:', value: state.docInfo.PDFFormatVersion },
        ];
        properties.forEach(prop => {
            if (prop.value) {
                const label = document.createElement('span');
                label.textContent = prop.label;
                const value = document.createElement('span');
                value.textContent = prop.value;
                contentDiv.appendChild(label);
                contentDiv.appendChild(value);
            }
        });
        DOM.docPropertiesModal.style.display = 'flex';
    });
    DOM.docPropertiesCloseBtn.addEventListener('click', () => DOM.docPropertiesModal.style.display = 'none');
    
    DOM.sidebarToggle.addEventListener('click', () => {
        DOM.body.classList.toggle('sidebar-collapsed');
        setTimeout(() => render(), 50);
    });

    if (DOM.fileMenuBtn) DOM.fileMenuBtn.parentElement.addEventListener('click', (e) => {
        if (e.target === DOM.fileMenuBtn || DOM.fileMenuBtn.contains(e.target)) {
            e.currentTarget.classList.toggle('open');
        }
    });
    DOM.openFileBtn.addEventListener('click', () => alert("File opening not yet implemented."));
    
    DOM.sidebarPreview.addEventListener('wheel', (e) => { e.stopPropagation(); });
    DOM.container.addEventListener('scroll', throttle(updatePageOnScroll, 100));
    document.addEventListener('keydown', handleKeydown);
    window.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement && state.isPresentationMode) {
            setZoomMode('fit');
        } else if (!document.fullscreenElement && state.isPresentationMode) {
            togglePresentationMode();
        }
    });

    let isPanning = false;
    let lastX, lastY;
    let isDrawing = false;
    let currentPath = null;
    let isClickOnSelected = false;
    let mouseDownX = 0;
    let mouseDownY = 0;

    DOM.container.addEventListener('mousedown', async (e) => {
        if (e.target.isContentEditable) return;
        
        mouseDownX = e.clientX;
        mouseDownY = e.clientY;
        isClickOnSelected = false;

        if (isAnyToolActive()) {
            e.preventDefault();
            
            const pageDiv = e.target.closest('.page');
            if (!pageDiv) return;
            const rect = pageDiv.getBoundingClientRect();
            const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
            const x = (e.clientX - rect.left) / state.zoomLevel;
            const y = (e.clientY - rect.top) / state.zoomLevel;

            const activeDrawingTool = state.highlighter.isActive ? 'highlight' : state.pencil.isActive ? 'pencil' : null;
            const isErasing = state.eraser.isActive;
    
            if (state.text.isActive) {
                state.text.isDrawing = true;
                state.text.startCoords = { x: e.clientX, y: e.clientY };
                
                const tempBox = document.createElement('div');
                tempBox.className = 'temp-textbox-selection';
                tempBox.style.left = `${e.clientX}px`;
                tempBox.style.top = `${e.clientY}px`;
                document.body.appendChild(tempBox);

            } else if (activeDrawingTool || isErasing) {
                isDrawing = true;
                currentPath = [{ x, y }];
                if (!state.annotations[pageNum]) {
                    state.annotations[pageNum] = [];
                }
                if (activeDrawingTool) {
                    state.annotations[pageNum].push({
                        type: activeDrawingTool,
                        paths: [],
                        color: state.highlighter.isActive ? state.highlighter.color : state.pencil.color,
                        size: state.highlighter.isActive ? state.highlighter.size : state.pencil.size
                    });

                    if (state.pencil.isActive) {
                        clearTimeout(state.pencil.shapeCorrectionTimeout);
                        state.pencil.shapeCorrectionTimeout = setTimeout(() => {
                            correctShapeAfterDelay(pageDiv, pageNum, currentPath);
                        }, 1500);
                    }
                }
            } else if (state.isHandToolActive) {
                isPanning = true;
                lastX = e.clientX;
                lastY = e.clientY;
                DOM.container.classList.add('grabbing');
            }
            return;
        }

        if (!e.target.closest('.textLayer')) {
            e.preventDefault();
        }

        const previouslySelected = { ...state.selectedAnnotation };
        const pageDiv = e.target.closest('.page');
        
        if (!pageDiv) {
            if (previouslySelected.pageNum) {
                state.selectedAnnotation.index = -1;
                state.selectedAnnotation.pageNum = null;
                const pageToRedraw = document.getElementById(`page-container-${previouslySelected.pageNum}`)?.querySelector('.page');
                if (pageToRedraw) {
                    const annotationLayer = pageToRedraw.querySelector('.annotationLayer');
                    const context = annotationLayer.getContext('2d');
                    const page = await state.pdfDoc.getPage(previouslySelected.pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                    redrawAnnotations(previouslySelected.pageNum, context, viewport);
                }
            }
            return;
        }
        
        const rect = pageDiv.getBoundingClientRect();
        const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
        const x = (e.clientX - rect.left) / state.zoomLevel;
        const y = (e.clientY - rect.top) / state.zoomLevel;
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (state.selectedAnnotation.pageNum === pageNum && state.selectedAnnotation.index !== -1) {
            const selectedAnnotation = state.annotations[pageNum][state.selectedAnnotation.index];
            if ((selectedAnnotation.type === 'text' || selectedAnnotation.type === 'image')) {
                const page = await state.pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                const handles = getResizeHandles(selectedAnnotation, viewport);
        
                for (const handle of handles) {
                    if (clickX >= handle.x && clickX <= handle.x + handle.width &&
                        clickY >= handle.y && clickY <= handle.y + handle.height) {
                        
                        state.selectedAnnotation.isResizing = true;
                        state.selectedAnnotation.resizeHandle = handle.name;
                        e.stopPropagation();
                        return;
                    }
                }
            }
        }

        let hitDetected = false;
        let hitIndex = -1;

        (state.annotations[pageNum] || []).forEach((annotation, index) => {
            if (annotation.type === 'text' || annotation.type === 'image') {
                const width = annotation.width || (annotation.size * (annotation.content?.length || 1) * 0.6); 
                const height = annotation.height || annotation.size;
                const isHit = x >= annotation.x && x <= annotation.x + width &&
                              y >= annotation.y && y <= annotation.y + height;
                if (isHit) {
                    hitDetected = true;
                    hitIndex = index;
                }
            }
        });

        if (hitDetected) {
            const annotation = state.annotations[pageNum][hitIndex];
            if (previouslySelected.pageNum === pageNum && previouslySelected.index === hitIndex) {
                isClickOnSelected = true;
            }

            state.selectedAnnotation = {
                ...state.selectedAnnotation,
                pageNum,
                index: hitIndex,
                isDragging: true,
                offsetX: x - annotation.x,
                offsetY: y - annotation.y,
            };
            document.body.classList.add('grabbing-annotation');

        } else {
            state.selectedAnnotation.index = -1;
            state.selectedAnnotation.pageNum = null;
        }
        
        const selectionChanged = state.selectedAnnotation.pageNum !== previouslySelected.pageNum || state.selectedAnnotation.index !== previouslySelected.index;
        if (selectionChanged) {
            const redraw = async (pNum) => {
                if (!pNum) return;
                const pageToRedraw = document.getElementById(`page-container-${pNum}`)?.querySelector('.page');
                if (pageToRedraw) {
                    const annotationLayer = pageToRedraw.querySelector('.annotationLayer');
                    if (annotationLayer) {
                        const context = annotationLayer.getContext('2d');
                        const page = await state.pdfDoc.getPage(pNum);
                        const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                        context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                        redrawAnnotations(pNum, context, viewport);
                    }
                }
            };

            const pagesToRedraw = new Set([previouslySelected.pageNum, state.selectedAnnotation.pageNum]);
            for (const pNum of pagesToRedraw) {
                await redraw(pNum);
            }
        }
    });

    document.addEventListener('mousemove', async (e) => {
        if (isPanning) {
            DOM.container.scrollLeft -= e.clientX - lastX;
            DOM.container.scrollTop -= e.clientY - lastY;
            lastX = e.clientX;
            lastY = e.clientY;
            return;
        }
        const MIN_DIM = 20;
        
        if (state.selectedAnnotation.isResizing) {
            const selected = state.selectedAnnotation;
            const annotation = state.annotations[selected.pageNum][selected.index];
            const pageDiv = document.getElementById(`page-container-${selected.pageNum}`).querySelector('.page');
            
            if (pageDiv && annotation) {
                const rect = pageDiv.getBoundingClientRect();
                const x = (e.clientX - rect.left) / state.zoomLevel;
                const y = (e.clientY - rect.top) / state.zoomLevel;
                const handle = selected.resizeHandle;
                const originalX = annotation.x;
                const originalY = annotation.y;
                const originalWidth = annotation.width;
                const originalHeight = annotation.height;
                const right = originalX + originalWidth;
                const bottom = originalY + originalHeight;
                if (handle.includes('r')) {
                    const newWidth = x - originalX;
                    if (newWidth > MIN_DIM) annotation.width = newWidth;
                }
                if (handle.includes('b')) {
                    const newHeight = y - originalY;
                    if (newHeight > MIN_DIM) annotation.height = newHeight;
                }
                if (handle.includes('l')) {
                    const newWidth = right - x;
                    if (newWidth > MIN_DIM) {
                        annotation.x = x;
                        annotation.width = newWidth;
                    }
                }
                if (handle.includes('t')) {
                    const newHeight = bottom - y;
                    if (newHeight > MIN_DIM) {
                        annotation.y = y;
                        annotation.height = newHeight;
                    }
                }
                const annotationLayer = pageDiv.querySelector('.annotationLayer');
                const context = annotationLayer.getContext('2d');
                const page = await state.pdfDoc.getPage(selected.pageNum);
                const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                redrawAnnotations(selected.pageNum, context, viewport);
            }
            return;
        }

        if (state.selectedAnnotation.isDragging) {
            const selected = state.selectedAnnotation;
            const annotation = state.annotations[selected.pageNum][selected.index];
            const pageDiv = document.getElementById(`page-container-${selected.pageNum}`).querySelector('.page');
            
            if (pageDiv && annotation) {
                const rect = pageDiv.getBoundingClientRect();
                const x = (e.clientX - rect.left) / state.zoomLevel;
                const y = (e.clientY - rect.top) / state.zoomLevel;
                annotation.x = x - selected.offsetX;
                annotation.y = y - selected.offsetY;
                const annotationLayer = pageDiv.querySelector('.annotationLayer');
                const context = annotationLayer.getContext('2d');
                const page = await state.pdfDoc.getPage(selected.pageNum);
                const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                redrawAnnotations(selected.pageNum, context, viewport);
            }
            return;
        }

        const cursorPageDiv = e.target.closest('.page');
        let onHandle = false;
        if (cursorPageDiv && state.selectedAnnotation.pageNum !== null && state.selectedAnnotation.index !== -1) {
            const pageNum = parseInt(cursorPageDiv.parentElement.dataset.pageNumber, 10);
            if (pageNum === state.selectedAnnotation.pageNum) {
                const rect = cursorPageDiv.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const selectedAnnotation = state.annotations[pageNum][state.selectedAnnotation.index];
                if ((selectedAnnotation.type === 'text' || selectedAnnotation.type === 'image')) {
                    const page = await state.pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    const handles = getResizeHandles(selectedAnnotation, viewport);
                    for (const handle of handles) {
                        if (clickX >= handle.x && clickX <= handle.x + handle.width &&
                            clickY >= handle.y && clickY <= handle.y + handle.height) {
                            DOM.container.style.cursor = handle.cursor;
                            onHandle = true;
                            break;
                        }
                    }
                }
            }
        }
        if (!onHandle) {
             DOM.container.style.cursor = 'default';
        }


        if (state.text.isDrawing) {
            const tempBox = document.querySelector('.temp-textbox-selection');
            if (tempBox) {
                const startX = state.text.startCoords.x;
                const startY = state.text.startCoords.y;
                const currentX = e.clientX;
                const currentY = e.clientY;
                tempBox.style.left = `${Math.min(startX, currentX)}px`;
                tempBox.style.top = `${Math.min(startY, currentY)}px`;
                tempBox.style.width = `${Math.abs(currentX - startX)}px`;
                tempBox.style.height = `${Math.abs(currentY - startY)}px`;
            }
            return;
        }

        const pageDiv = e.target.closest('.page');
        if (!pageDiv) return;
        const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
        const rect = pageDiv.getBoundingClientRect();
        const x = (e.clientX - rect.left) / state.zoomLevel;
        const y = (e.clientY - rect.top) / state.zoomLevel;

        if (state.eraser.isActive && isDrawing) {
            const eraserRadius = state.eraser.size / 2 / state.zoomLevel;
            let annotationsModified = false;
            state.annotations[pageNum] = state.annotations[pageNum].filter(annotation => {
                if (annotation.type === 'highlight' || annotation.type === 'pencil') {
                    if (annotation.paths) {
                        return !annotation.paths.some(path =>
                            path.some(point => Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2)) < eraserRadius)
                        );
                    }
                    if (annotation.rects) {
                        return !annotation.rects.some(rect => {
                            const rectBounds = { left: rect.x, top: rect.y, right: rect.x + rect.width, bottom: rect.y + rect.height };
                            const eraserRect = { left: x - eraserRadius, top: y - eraserRadius, right: x + eraserRadius, bottom: y + eraserRadius };
                            return !(rectBounds.right < eraserRect.left || rectBounds.left > eraserRect.right || rectBounds.bottom < eraserRect.top || rectBounds.top > eraserRect.bottom);
                        });
                    }
                } else if (annotation.type === 'text' || annotation.type === 'image') {
                    const annotationRect = { left: annotation.x, top: annotation.y, right: annotation.x + annotation.width, bottom: annotation.y + annotation.height };
                    const eraserRect = { left: x - eraserRadius, top: y - eraserRadius, right: x + eraserRadius, bottom: y + eraserRadius };
                    const hit = !(annotationRect.right < eraserRect.left || annotationRect.left > eraserRect.right || annotationRect.bottom < eraserRect.top || annotationRect.top > eraserRect.bottom);
                    return !hit;
                }
                return true;
            });
            annotationsModified = true;
            if (annotationsModified) {
                const annotationLayer = pageDiv.querySelector('.annotationLayer');
                const context = annotationLayer.getContext('2d');
                const page = await state.pdfDoc.getPage(pageNum);
                const viewport = page.getViewport({ scale: state.zoomLevel });
                context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                redrawAnnotations(pageNum, context, viewport);
            }
        } else if (isDrawing && currentPath) {
            currentPath.push({ x, y });
            const annotationLayer = pageDiv.querySelector('.annotationLayer');
            if (!annotationLayer) return;
            const context = annotationLayer.getContext('2d');
            const viewport = (await state.pdfDoc.getPage(parseInt(pageDiv.parentElement.dataset.pageNumber, 10))).getViewport({ scale: state.zoomLevel });
            context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
            redrawAnnotations(parseInt(pageDiv.parentElement.dataset.pageNumber, 10), context, viewport);
            const dpr = window.devicePixelRatio || 1;
            context.save();
            context.scale(dpr,dpr);
            if (state.highlighter.isActive) {
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.globalAlpha = 0.5;
                context.strokeStyle = state.highlighter.color;
                context.lineWidth = state.highlighter.size * state.zoomLevel;
            } else if (state.pencil.isActive) {
                context.lineCap = 'round';
                context.lineJoin = 'round';
                context.globalAlpha = 1.0;
                context.strokeStyle = state.pencil.color;
                context.lineWidth = state.pencil.size * state.zoomLevel;
            }
            context.beginPath();
            context.moveTo(currentPath[0].x * state.zoomLevel, currentPath[0].y * state.zoomLevel);
            for (let i = 1; i < currentPath.length; i++) {
                context.lineTo(currentPath[i].x * state.zoomLevel, currentPath[i].y * state.zoomLevel);
            }
            context.stroke();
            context.restore();
        }

        if (isDrawing && currentPath && state.pencil.isActive) {
            clearTimeout(state.pencil.shapeCorrectionTimeout);
            state.pencil.shapeCorrectionTimeout = setTimeout(async () => {
                if (!isDrawing || !currentPath) return;
                const pageDiv = e.target.closest('.page');
                if (!pageDiv) return;
                const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
                await correctShapeAfterDelay(pageDiv, pageNum, currentPath);
            }, 1500);
        }
    });

    document.addEventListener('mouseup', (e) => {
        const mouseDidNotMove = Math.abs(e.clientX - mouseDownX) < 5 && Math.abs(e.clientY - mouseDownY) < 5;
        
        if (isClickOnSelected && mouseDidNotMove && !state.selectedAnnotation.isResizing) {
            const pageNumToDeselect = state.selectedAnnotation.pageNum;
            state.selectedAnnotation.pageNum = null;
            state.selectedAnnotation.index = -1;
            isClickOnSelected = false;

            if (pageNumToDeselect) {
                (async () => {
                    const pageContainer = document.getElementById(`page-container-${pageNumToDeselect}`);
                    const pageToRedraw = pageContainer?.querySelector('.page');
                    if (pageToRedraw) {
                        const annotationLayer = pageToRedraw.querySelector('.annotationLayer');
                        const context = annotationLayer.getContext('2d');
                        const page = await state.pdfDoc.getPage(pageNumToDeselect);
                        const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                        context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                        redrawAnnotations(pageNumToDeselect, context, viewport);
                    }
                })();
            }
        }

        if (state.selectedAnnotation.isResizing) {
            state.selectedAnnotation.isResizing = false;
            state.selectedAnnotation.resizeHandle = null;
            DOM.container.style.cursor = 'default';
        }
        if (isPanning) {
            isPanning = false;
            DOM.container.classList.remove('grabbing');
        } else if (state.selectedAnnotation.isDragging) {
            state.selectedAnnotation.isDragging = false;
            document.body.classList.remove('grabbing-annotation');
        } else if (state.text.isDrawing) {
            state.text.isDrawing = false;
            const tempBox = document.querySelector('.temp-textbox-selection');
            if (tempBox) {
                const boxRect = tempBox.getBoundingClientRect();
                document.body.removeChild(tempBox);
                const pageDiv = document.elementFromPoint(boxRect.left, boxRect.top)?.closest('.page');
                if (pageDiv) {
                    const pageRect = pageDiv.getBoundingClientRect();
                    const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
                    const x = (boxRect.left - pageRect.left);
                    const y = (boxRect.top - pageRect.top);
                    createTextAnnotationInput(x, y, boxRect.width, boxRect.height, pageDiv, pageNum);
                }
            }
            toggleTool('text'); 
        } else if (isDrawing) {
            isDrawing = false;
            if (state.pencil.isActive) {
                clearTimeout(state.pencil.shapeCorrectionTimeout);
                state.pencil.shapeCorrectionTimeout = null;
            }
            const pageDiv = e.target.closest('.page');
            if (!pageDiv) return;
            if (state.eraser.isActive) {
                return;
            }
            if (!currentPath || currentPath.length < 2) {
                currentPath = null;
                return;
            };
            const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
            if (state.highlighter.isActive) {
                const pageRect = pageDiv.getBoundingClientRect();
                const spans = pageDiv.querySelectorAll('.textLayer span');
                const selectedRects = [];
                let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                currentPath.forEach(p => {
                    const viewX = p.x * state.zoomLevel;
                    const viewY = p.y * state.zoomLevel;
                    minX = Math.min(minX, viewX);
                    minY = Math.min(minY, viewY);
                    maxX = Math.max(maxX, viewX);
                    maxY = Math.max(maxY, viewY);
                });
                const pathRect = { left: minX, top: minY, right: maxX, bottom: maxY };
                spans.forEach(span => {
                    const spanRect = span.getBoundingClientRect();
                    const relativeSpanRect = {
                        left: spanRect.left - pageRect.left, top: spanRect.top - pageRect.top, right: spanRect.right - pageRect.left, bottom: spanRect.bottom - pageRect.top
                    };
                    const intersects = !(relativeSpanRect.right < pathRect.left || relativeSpanRect.left > pathRect.right || relativeSpanRect.bottom < pathRect.top || relativeSpanRect.top > pathRect.bottom);
                    if (intersects) {
                        selectedRects.push({
                            x: (relativeSpanRect.left) / state.zoomLevel, y: (relativeSpanRect.top) / state.zoomLevel, width: (relativeSpanRect.right - relativeSpanRect.left) / state.zoomLevel, height: (relativeSpanRect.bottom - relativeSpanRect.top) / state.zoomLevel,
                        });
                    }
                });
                const mergedRects = [];
                if (selectedRects.length > 0) {
                    const lines = {};
                    const yTolerance = 5 / state.zoomLevel;
                    selectedRects.forEach(rect => {
                        const lineY = Object.keys(lines).find(y => Math.abs(y - rect.y) < yTolerance);
                        if (lineY) {
                            lines[lineY].push(rect);
                        } else {
                            lines[rect.y] = [rect];
                        }
                    });
                    for (const y in lines) {
                        const lineRects = lines[y];
                        if (lineRects.length === 0) continue;
                        lineRects.sort((a, b) => a.x - b.x);
                        let currentMergedRect = { ...lineRects[0] };
                        for (let i = 1; i < lineRects.length; i++) {
                            const nextRect = lineRects[i];
                            const gap = nextRect.x - (currentMergedRect.x + currentMergedRect.width);
                            if (gap < (10 / state.zoomLevel)) {
                                currentMergedRect.width = (nextRect.x + nextRect.width) - currentMergedRect.x;
                                const top = Math.min(currentMergedRect.y, nextRect.y);
                                const bottom = Math.max(currentMergedRect.y + currentMergedRect.height, nextRect.y + nextRect.height);
                                currentMergedRect.y = top;
                                currentMergedRect.height = bottom - top;
                            } else {
                                mergedRects.push(currentMergedRect);
                                currentMergedRect = { ...nextRect };
                            }
                        }
                        mergedRects.push(currentMergedRect);
                    }
                }
                if (mergedRects.length > 0) {
                    state.annotations[pageNum].pop();
                    state.annotations[pageNum].push({
                        type: 'highlight', rects: mergedRects, color: state.highlighter.color, size: state.highlighter.size
                    });
                } else {
                    const correctedPath = correctShape(currentPath);
                    const newAnnotation = state.annotations[pageNum].pop();
                    newAnnotation.paths = [correctedPath];
                    state.annotations[pageNum].push(newAnnotation);
                }
                (async () => {
                    const annotationLayer = pageDiv.querySelector('.annotationLayer');
                    const context = annotationLayer.getContext('2d');
                    const page = await state.pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                    redrawAnnotations(pageNum, context, viewport);
                })();
            } else {
                const correctedPath = correctShape(currentPath);
                const newAnnotation = state.annotations[pageNum].pop();
                newAnnotation.paths = [correctedPath];
                state.annotations[pageNum].push(newAnnotation);
            }
            currentPath = null;
        }
    });

    DOM.container.addEventListener('click', (e) => {
         if (state.image.isActive) {
            const pageDiv = e.target.closest('.page');
            if (!pageDiv) return;
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.style.display = 'none';
            fileInput.addEventListener('change', (event) => {
                const file = event.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (loadEvent) => {
                        const imgSrc = loadEvent.target.result;
                        const img = new Image();
                        img.onload = () => {
                            const rect = pageDiv.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;
                            const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
                            const maxDim = 150;
                            let w = img.width;
                            let h = img.height;
                            if (w > h) {
                                if (w > maxDim) { h *= maxDim / w; w = maxDim; }
                            } else {
                                if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                            }
                            if (!state.annotations[pageNum]) {
                                state.annotations[pageNum] = [];
                            }
                            state.annotations[pageNum].push({
                                type: 'image', src: imgSrc, x: x / state.zoomLevel, y: y / state.zoomLevel, width: w / state.zoomLevel, height: h / state.zoomLevel,
                            });
                            render();
                        };
                        img.src = imgSrc;
                    };
                    reader.readAsDataURL(file);
                }
                document.body.removeChild(fileInput);
                toggleTool('image');
            }, { once: true });
            document.body.appendChild(fileInput);
            fileInput.click();
        } else if (state.signature.isActive) {
            const pageDiv = e.target.closest('.page');
            if (!pageDiv || !state.signature.src) return;
            const img = new Image();
            img.onload = () => {
                const rect = pageDiv.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const pageNum = parseInt(pageDiv.parentElement.dataset.pageNumber, 10);
                const maxDim = 150;
                let w = img.width;
                let h = img.height;
                if (w > h) {
                    if (w > maxDim) { h *= maxDim / w; w = maxDim; }
                } else {
                    if (h > maxDim) { w *= maxDim / h; h = maxDim; }
                }
                if (!state.annotations[pageNum]) {
                    state.annotations[pageNum] = [];
                }
                state.annotations[pageNum].push({
                    type: 'image', src: state.signature.src, x: x / state.zoomLevel, y: y / state.zoomLevel, width: w / state.zoomLevel, height: h / state.zoomLevel,
                });
                render();
            };
            img.src = state.signature.src;
            state.signature.isActive = false;
            if(DOM.signatureToolBtn) DOM.signatureToolBtn.classList.remove('active');
            document.body.classList.remove('signature-active');
            state.signature.src = null;
        }
    });

    function createTextAnnotationInput(x, y, width, height, pageDiv, pageNum) {
        const input = document.createElement('div');
        input.contentEditable = true;
        input.className = 'temp-text-input';
        input.style.position = 'absolute';
        input.style.left = `${x}px`;
        input.style.top = `${y}px`;
        input.style.width = `${width}px`;
        input.style.height = `${height}px`;
        input.style.fontFamily = state.text.font;
        input.style.fontSize = `${state.text.size}px`;
        input.style.color = state.text.color;
        input.style.border = '1px dashed #888';
        input.style.overflowWrap = 'break-word';
        input.style.zIndex = '1001';
        pageDiv.appendChild(input);
        input.focus();
        input.addEventListener('blur', async () => {
            const trimmedText = input.textContent.trim();
            if (trimmedText) {
                if (!state.annotations[pageNum]) {
                    state.annotations[pageNum] = [];
                }
                state.annotations[pageNum].push({
                    type: 'text', content: trimmedText, x: x / state.zoomLevel, y: y / state.zoomLevel, width: width / state.zoomLevel, height: height / state.zoomLevel, font: state.text.font, size: state.text.size, color: state.text.color,
                });
                const annotationLayer = pageDiv.querySelector('.annotationLayer');
                if (annotationLayer) {
                    const context = annotationLayer.getContext('2d');
                    const page = await state.pdfDoc.getPage(pageNum);
                    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
                    context.clearRect(0, 0, annotationLayer.width, annotationLayer.height);
                    redrawAnnotations(pageNum, context, viewport);
                }
            }
            pageDiv.removeChild(input);
        }, { once: true });
    }

    const sigCanvas = DOM.signatureCanvas;
    const sigCtx = sigCanvas.getContext('2d');
    let isDrawingSig = false;
    function clearSignatureCanvas() { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); }
    function openSignatureModal() {
        DOM.signatureModal.style.display = 'flex';
        clearSignatureCanvas();
    }
    function closeSignatureModal() { DOM.signatureModal.style.display = 'none'; }
    sigCanvas.addEventListener('mousedown', (e) => {
        isDrawingSig = true;
        const rect = sigCanvas.getBoundingClientRect();
        sigCtx.beginPath();
        sigCtx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    });
    sigCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawingSig) return;
        const rect = sigCanvas.getBoundingClientRect();
        sigCtx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
        sigCtx.stroke();
    });
    sigCanvas.addEventListener('mouseup', () => isDrawingSig = false);
    sigCanvas.addEventListener('mouseout', () => isDrawingSig = false);
    DOM.signatureClearBtn.addEventListener('click', clearSignatureCanvas);
    DOM.signatureCancelBtn.addEventListener('click', closeSignatureModal);
    DOM.signatureSaveBtn.addEventListener('click', () => {
        state.signature.src = sigCanvas.toDataURL('image/png');
        state.signature.isActive = true;
        if(DOM.signatureToolBtn) DOM.signatureToolBtn.classList.add('active');
        document.body.classList.add('signature-active');
        closeSignatureModal();
    });

    document.addEventListener('click', (e) => {
        document.querySelectorAll('.sidebar-dropdown-container.open, #top-bar-center .dropdown-container.open').forEach(container => {
            if (!container.contains(e.target)) {
                container.classList.remove('open');
            }
        });
    });

    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === "settingsChanged") {
            loadAndApplySettings();
            render();
        }
    });
}

// --- Utility Functions ---
function isAnyToolActive() {
    return state.highlighter.isActive || state.pencil.isActive || state.eraser.isActive || state.text.isActive || state.image.isActive || state.signature.isActive || state.isHandToolActive;
}
function toggleTool(toolToActivate) {
    const allTools = ['hand', 'highlighter', 'pencil', 'eraser', 'text', 'image', 'signature'];
    const isDeactivating = (toolToActivate === 'hand' && state.isHandToolActive) || (state[toolToActivate] && state[toolToActivate].isActive);

    allTools.forEach(toolName => {
        const isHand = toolName === 'hand';
        const stateObj = isHand ? state : state[toolName];
        if (!stateObj) return;
        const activeProp = isHand ? 'isHandToolActive' : 'isActive';
        const btn = DOM[isHand ? 'handToolToggle' : `${toolName}ToolBtn`];
        const settings = DOM[`${toolName}Settings`];
        let bodyClass = isHand ? 'hand-tool-active' : `${toolName}-active`;
        if (toolName === 'signature') bodyClass = 'signature-active';
        stateObj[activeProp] = false;
        if (btn) btn.classList.remove('active');
        if (settings) settings.style.display = 'none';
        document.body.classList.remove(bodyClass);
    });

    if (!isDeactivating) {
        if (toolToActivate === 'signature') {
            openSignatureModal();
        } else {
            const isHand = toolToActivate === 'hand';
            const stateObj = isHand ? state : state[toolToActivate];
            const activeProp = isHand ? 'isHandToolActive' : 'isActive';
            const btn = DOM[isHand ? 'handToolToggle' : `${toolToActivate}ToolBtn`];
            const settings = DOM[`${toolToActivate}Settings`];
            let bodyClass = isHand ? 'hand-tool-active' : `${toolToActivate}-active`;
            stateObj[activeProp] = true;
            if (btn) btn.classList.add('active');
            if (settings) settings.style.display = 'block';
            document.body.classList.add(bodyClass);
        }
    }
}
function showLoader(show, text = 'Generating PDF...') {
    if (!DOM.loadingOverlay) return;
    const loadingTextElement = DOM.loadingOverlay.querySelector('.loading-text');
    if (show) {
        if(loadingTextElement) loadingTextElement.textContent = text;
        DOM.loadingOverlay.style.display = 'flex';
    } else {
        DOM.loadingOverlay.style.display = 'none';
    }
}
function getResizeHandles(annotation, viewport) {
    if (!annotation.width || !annotation.height) return [];
    const rect = { x: annotation.x * viewport.scale, y: annotation.y * viewport.scale, width: annotation.width * viewport.scale, height: annotation.height * viewport.scale };
    const handleSize = 8;
    const halfHandle = handleSize / 2;
    const handleDefs = [
        { name: 'tl', cursor: 'nwse-resize', x: rect.x, y: rect.y }, { name: 'tm', cursor: 'ns-resize',   x: rect.x + rect.width / 2, y: rect.y }, { name: 'tr', cursor: 'nesw-resize', x: rect.x + rect.width, y: rect.y }, { name: 'ml', cursor: 'ew-resize',   x: rect.x, y: rect.y + rect.height / 2 }, { name: 'mr', cursor: 'ew-resize',   x: rect.x + rect.width, y: rect.y + rect.height / 2 }, { name: 'bl', cursor: 'nesw-resize', x: rect.x, y: rect.y + rect.height }, { name: 'bm', cursor: 'ns-resize',   x: rect.x + rect.width / 2, y: rect.y + rect.height }, { name: 'br', cursor: 'nwse-resize', x: rect.x + rect.width, y: rect.y + rect.height }
    ];
    return handleDefs.map(h => ({ ...h, x: h.x - halfHandle, y: h.y - halfHandle, width: handleSize, height: handleSize }));
}
function simplifyPath(points, tolerance) {
    if (points.length <= 2) return points;
    const sqTolerance = tolerance * tolerance;
    function getSqSegDist(p, p1, p2) {
        let x = p1.x, y = p1.y, dx = p2.x - x, dy = p2.y - y;
        if (dx !== 0 || dy !== 0) {
            const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
            if (t > 1) { x = p2.x; y = p2.y; } else if (t > 0) { x += dx * t; y += dy * t; }
        }
        dx = p.x - x; dy = p.y - y;
        return dx * dx + dy * dy;
    }
    function simplifyRecursive(points, start, end, sqTolerance, simplified) {
        let maxSqDist = sqTolerance, index;
        for (let i = start + 1; i < end; i++) {
            const sqDist = getSqSegDist(points[i], points[start], points[end]);
            if (sqDist > maxSqDist) { index = i; maxSqDist = sqDist; }
        }
        if (maxSqDist > sqTolerance) {
            if (index - start > 1) simplifyRecursive(points, start, index, sqTolerance, simplified);
            simplified.push(points[index]);
            if (end - index > 1) simplifyRecursive(points, index, end, sqTolerance, simplified);
        }
    }
    const last = points.length - 1;
    const simplified = [points[0]];
    simplifyRecursive(points, 0, last, sqTolerance, simplified);
    simplified.push(points[last]);
    return simplified;
}
function correctShape(path) {
    if (path.length < 10) return [path[0], path[path.length - 1]];
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const simplified = simplifyPath(path, 4);
    const isSimplifiedClosed = Math.sqrt(Math.pow(simplified[simplified.length - 1].x - simplified[0].x, 2) + Math.pow(simplified[simplified.length - 1].y - simplified[0].y, 2)) < 25;
    const vertices = isSimplifiedClosed ? simplified.slice(0, simplified.length - 1) : simplified;
    if (vertices.length === 3) return vertices.concat(vertices[0]);
    if (vertices.length === 4) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        return [ { x: minX, y: minY }, { x: maxX, y: minY }, { x: maxX, y: maxY }, { x: minX, y: maxY }, { x: minX, y: minY } ];
    }
    const closingDist = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));
    const isClosed = closingDist < 35;
    if (isClosed) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        path.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
        const boundingBox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        const centerX = boundingBox.x + boundingBox.width / 2;
        const centerY = boundingBox.y + boundingBox.height / 2;
        const radii = path.map(p => Math.sqrt(Math.pow(p.x - centerX, 2) + Math.pow(p.y - centerY, 2)));
        const avgR = radii.reduce((sum, r) => sum + r, 0) / radii.length;
        const stdDev = Math.sqrt(radii.map(r => Math.pow(r - avgR, 2)).reduce((sum, sq) => sum + sq, 0) / radii.length);
        const aspectRatio = boundingBox.width / (boundingBox.height || 1);
        const circleArea = Math.PI * avgR * avgR;
        const boxArea = boundingBox.width * boundingBox.height;
        const areaRatio = boxArea / (circleArea || 1);
        if ((stdDev / avgR) < 0.22 && aspectRatio > 0.7 && aspectRatio < 1.3 && areaRatio > 0.65) {
            const radius = (boundingBox.width + boundingBox.height) / 4;
            const circlePath = [];
            for (let i = 0; i <= 360; i += 10) {
                const rad = i * Math.PI / 180;
                circlePath.push({ x: centerX + radius * Math.cos(rad), y: centerY + radius * Math.sin(rad), });
            }
            return circlePath;
        }
    }
    return [startPoint, endPoint];
}
async function correctShapeAfterDelay(pageDiv, pageNum, path) {
    if (!isDrawing || !path) return;
    const correctedPath = correctShape(path);
    const newAnnotation = state.annotations[pageNum].pop();
    newAnnotation.paths = [correctedPath];
    state.annotations[pageNum].push(newAnnotation);
    const canvas = pageDiv.querySelector('.annotationLayer');
    const context = canvas.getContext('2d');
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.zoomLevel, rotation: state.rotation });
    context.clearRect(0, 0, canvas.width, canvas.height);
    redrawAnnotations(pageNum, context, viewport);
    isDrawing = false;
    currentPath = null;
    clearTimeout(state.pencil.shapeCorrectionTimeout);
}

// --- App Start ---
document.addEventListener('DOMContentLoaded', () => {
    loadAndApplySettings();
    initEventListeners();
    initializeViewer();
});

