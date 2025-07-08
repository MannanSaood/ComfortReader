// options/options.js

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const DOM = {
        colorButtons: document.querySelectorAll('.color-btn'),
        customColorPicker: document.getElementById('customColorPicker'),
        customColorInput: document.getElementById('customColorInput'),
        applyCustomColorBtn: document.getElementById('applyCustomColorBtn'),
        blueLightFilterToggle: document.getElementById('blueLightFilterToggle'),
        blueLightIntensitySlider: document.getElementById('blueLightIntensitySlider'),
        blueLightIntensityValue: document.getElementById('blueLightIntensityValue'),
        contrastLevelSlider: document.getElementById('contrastLevelSlider'),
        contrastLevelValue: document.getElementById('contrastLevelValue'),
        applyAllRadio: document.getElementById('applyAllRadio'),
        applySelectedRadio: document.getElementById('applySelectedRadio'),
        siteInput: document.getElementById('siteInput'),
        addSiteBtn: document.getElementById('addSiteBtn'),
        siteList: document.getElementById('siteList'),
        siteListContainer: document.querySelector('.site-list-container'),
        saveSettingsBtn: document.getElementById('saveSettingsBtn')
    };

    // --- Default Settings ---
    const DEFAULTS = {
        warmColor: '#333333', // Dark Gray
        contrastLevel: 100,
        blueLightFilter: false,
        blueLightIntensity: 50,
        scope: 'all',
        siteList: []
    };

    let currentSettings = { ...DEFAULTS };

    // --- Core Functions ---

    /**
     * Loads settings from chrome.storage.sync and updates the UI.
     */
    async function loadSettings() {
        currentSettings = await new Promise(resolve => {
            chrome.storage.sync.get(DEFAULTS, settings => resolve(settings));
        });
        updateUI(currentSettings);
    }

    /**
     * Gathers settings from the DOM, saves them to storage, and notifies other scripts.
     */
    function saveSettings() {
        const settingsToSave = readSettingsFromDOM();
        currentSettings = settingsToSave; // Update local state

        chrome.storage.sync.set(settingsToSave, () => {
            console.log('Settings saved:', settingsToSave);
            // Notify active viewer tabs
            chrome.tabs.query({ url: chrome.runtime.getURL("viewer/viewer.html") + "*" }, (tabs) => {
                tabs.forEach(tab => chrome.tabs.sendMessage(tab.id, { action: "settingsChanged" }));
            });
            // Notify background script
            chrome.runtime.sendMessage({ action: "settingsChanged" });
        });
    }

    // --- UI and DOM Interaction ---

    /**
     * Reads the current state of all UI controls and returns a settings object.
     * @returns {object} The current settings based on the UI.
     */
    function readSettingsFromDOM() {
        const activeButton = document.querySelector('.color-btn.active');
        let warmColor = DEFAULTS.warmColor;
        if (activeButton) {
            warmColor = activeButton.dataset.color;
        } else if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(DOM.customColorInput.value)) {
            warmColor = DOM.customColorInput.value;
        }

        const siteListItems = Array.from(DOM.siteList.children)
            .filter(li => !li.classList.contains('empty-message'))
            .map(li => li.textContent.replace('Remove', '').trim());

        return {
            warmColor,
            contrastLevel: parseInt(DOM.contrastLevelSlider.value, 10),
            blueLightFilter: DOM.blueLightFilterToggle.checked,
            blueLightIntensity: parseInt(DOM.blueLightIntensitySlider.value, 10),
            scope: DOM.applyAllRadio.checked ? 'all' : 'selected',
            siteList: siteListItems
        };
    }

    /**
     * Updates all UI elements to reflect the provided settings object.
     * @param {object} settings - The settings object to apply to the UI.
     */
    function updateUI(settings) {
        // Background Warmth
        DOM.colorButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.color === settings.warmColor);
        });
        const isPreset = Array.from(DOM.colorButtons).some(btn => btn.dataset.color === settings.warmColor);
        if (!isPreset) {
            DOM.customColorInput.value = settings.warmColor;
            DOM.customColorPicker.value = settings.warmColor;
        } else {
            DOM.customColorInput.value = '';
        }

        // Filters
        DOM.blueLightFilterToggle.checked = settings.blueLightFilter;
        DOM.blueLightIntensitySlider.value = settings.blueLightIntensity;
        DOM.blueLightIntensityValue.textContent = `${settings.blueLightIntensity}%`;
        DOM.blueLightIntensitySlider.disabled = !settings.blueLightFilter;
        DOM.contrastLevelSlider.value = settings.contrastLevel;
        DOM.contrastLevelValue.textContent = `${settings.contrastLevel}%`;

        // Scope
        DOM.applyAllRadio.checked = settings.scope === 'all';
        DOM.applySelectedRadio.checked = settings.scope === 'selected';
        DOM.siteListContainer.style.display = settings.scope === 'selected' ? 'block' : 'none';

        // Site List
        renderSiteList(settings.siteList);

        // Remove the redundant "Save" button
        DOM.saveSettingsBtn.style.display = 'none';
    }

    /**
     * Renders the list of sites in the DOM.
     * @param {string[]} siteList - An array of site URLs.
     */
    function renderSiteList(siteList) {
        DOM.siteList.innerHTML = '';
        if (siteList.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No sites added yet.';
            li.className = 'empty-message';
            DOM.siteList.appendChild(li);
            return;
        }
        siteList.forEach(site => {
            const li = document.createElement('li');
            li.textContent = site;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.className = 'remove-site-btn';
            removeBtn.addEventListener('click', () => removeSite(site));
            li.appendChild(removeBtn);
            DOM.siteList.appendChild(li);
        });
    }

    /**
     * Adds a site to the list and saves settings.
     */
    function addSite() {
        const site = DOM.siteInput.value.trim().toLowerCase();
        if (site && !currentSettings.siteList.includes(site)) {
            currentSettings.siteList.push(site);
            DOM.siteInput.value = '';
            renderSiteList(currentSettings.siteList);
            saveSettings();
        } else if (currentSettings.siteList.includes(site)) {
            alert('Site already in list!');
        }
    }

    /**
     * Removes a site from the list and saves settings.
     * @param {string} siteToRemove - The site URL to remove.
     */
    function removeSite(siteToRemove) {
        currentSettings.siteList = currentSettings.siteList.filter(site => site !== siteToRemove);
        renderSiteList(currentSettings.siteList);
        saveSettings();
    }

    // --- Event Listeners ---

    /**
     * Initializes all event listeners for the page.
     */
    function initEventListeners() {
        // Background Warmth
        DOM.colorButtons.forEach(button => {
            button.addEventListener('click', () => {
                DOM.colorButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                DOM.customColorInput.value = '';
                saveSettings();
            });
        });

        const handleCustomColor = () => {
            DOM.colorButtons.forEach(btn => btn.classList.remove('active'));
            saveSettings();
        };

        DOM.customColorPicker.addEventListener('input', e => {
            DOM.customColorInput.value = e.target.value;
        });

        DOM.customColorInput.addEventListener('input', e => {
            if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(e.target.value)) {
                DOM.customColorPicker.value = e.target.value;
            }
        });

        DOM.applyCustomColorBtn.addEventListener('click', handleCustomColor);

        // Filters
        DOM.blueLightFilterToggle.addEventListener('change', () => {
            DOM.blueLightIntensitySlider.disabled = !DOM.blueLightFilterToggle.checked;
            saveSettings();
        });

        DOM.blueLightIntensitySlider.addEventListener('input', () => {
            DOM.blueLightIntensityValue.textContent = `${DOM.blueLightIntensitySlider.value}%`;
            saveSettings();
        });

        DOM.contrastLevelSlider.addEventListener('input', () => {
            DOM.contrastLevelValue.textContent = `${DOM.contrastLevelSlider.value}%`;
            saveSettings();
        });

        // Scope
        [DOM.applyAllRadio, DOM.applySelectedRadio].forEach(radio => {
            radio.addEventListener('change', () => {
                DOM.siteListContainer.style.display = DOM.applySelectedRadio.checked ? 'block' : 'none';
                saveSettings();
            });
        });

        // Site List
        DOM.addSiteBtn.addEventListener('click', addSite);
        DOM.siteInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSite();
            }
        });
    }

    // --- Initialization ---
    initEventListeners();
    loadSettings();
});