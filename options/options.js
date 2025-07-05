// options/options.js

document.addEventListener('DOMContentLoaded', () => {
    // Background Warmth Buttons
    const colorButtons = document.querySelectorAll('.color-btn'); // This selects all buttons with class 'color-btn'
    const customColorPicker = document.getElementById('customColorPicker');
    const customColorInput = document.getElementById('customColorInput');
    const applyCustomColorBtn = document.getElementById('applyCustomColorBtn');

    // Filter Sliders and Toggles
    const blueLightFilterToggle = document.getElementById('blueLightFilterToggle');
    const blueLightIntensitySlider = document.getElementById('blueLightIntensitySlider');
    const blueLightIntensityValueSpan = document.getElementById('blueLightIntensityValue');
    const contrastLevelSlider = document.getElementById('contrastLevelSlider');
    const contrastLevelValueSpan = document.getElementById('contrastLevelValue');

    // Scope Radios
    const applyAllRadio = document.getElementById('applyAllRadio');
    const applySelectedRadio = document.getElementById('applySelectedRadio');

    // Site List Elements
    const siteInput = document.getElementById('siteInput');
    const addSiteBtn = document.getElementById('addSiteBtn');
    const siteListUl = document.getElementById('siteList');

    // Save Button
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    // Default settings
    const defaultSettings = {
        warmColor: '#FBF0E0', // Cream
        contrastLevel: 100, // 100% means no change from original
        blueLightFilter: false,
        blueLightIntensity: 50,
        scope: 'all', // 'all' or 'selected'
        siteList: []
    };

    // Load settings from storage
    function loadSettings() {
        chrome.storage.sync.get(defaultSettings, (settings) => {
            // Background Warmth
            let activeColor = settings.warmColor;
            colorButtons.forEach(button => {
                if (button.dataset.color === activeColor) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
            // Set custom color input if it's not one of the presets
            const presetColors = Array.from(colorButtons).map(btn => btn.dataset.color);
            if (!presetColors.includes(activeColor)) {
                customColorInput.value = activeColor;
                customColorPicker.value = activeColor; // Set picker value too
            } else {
                customColorInput.value = ''; // Clear if a preset is active
                // If you want picker to show preset color, uncomment: customColorPicker.value = activeColor;
            }


            // Filters
            blueLightFilterToggle.checked = settings.blueLightFilter;
            blueLightIntensitySlider.value = settings.blueLightIntensity;
            blueLightIntensityValueSpan.textContent = settings.blueLightIntensity + '%';
            blueLightIntensitySlider.disabled = !settings.blueLightFilter; // Set initial disabled state
            contrastLevelSlider.value = settings.contrastLevel;
            contrastLevelValueSpan.textContent = settings.contrastLevel + '%';


            // Scope
            if (settings.scope === 'all') {
                applyAllRadio.checked = true;
            } else {
                applySelectedRadio.checked = true;
            }
            toggleSiteListVisibility(settings.scope);

            // Site List
            renderSiteList(settings.siteList);
        });
    }

    // Save settings to storage and notify content script
    function saveSettings() {
        let selectedWarmColor = defaultSettings.warmColor; // Default to cream if nothing is active/custom
        const activeButton = document.querySelector('.color-btn.active');
        if (activeButton) {
            selectedWarmColor = activeButton.dataset.color;
        } else if (customColorInput.value && /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(customColorInput.value)) {
            // Only use custom color if it's a valid hex and no preset is active
            selectedWarmColor = customColorInput.value;
        } else {
            // If custom input is empty or invalid, and no preset is active, revert to default preset (Cream)
             selectedWarmColor = defaultSettings.warmColor;
             // Visually reset if needed
             customColorInput.value = '';
             colorButtons.forEach(btn => btn.classList.remove('active'));
             document.getElementById('creamBtn').classList.add('active');
        }

        const settingsToSave = {
            warmColor: selectedWarmColor,
            contrastLevel: parseInt(contrastLevelSlider.value),
            blueLightFilter: blueLightFilterToggle.checked,
            blueLightIntensity: parseInt(blueLightIntensitySlider.value),
            scope: document.querySelector('input[name="scope"]:checked').value,
            siteList: getSiteListFromDOM()
        };

        chrome.storage.sync.set(settingsToSave, () => {
            console.log('Settings saved:', settingsToSave);
            // Notify background script that settings have changed
            chrome.runtime.sendMessage({ action: "settingsChanged" });
            // You might want to show a "Settings saved!" message here
        });
    }

    // Render site list in the DOM
    function renderSiteList(siteList) {
        siteListUl.innerHTML = '';
        if (siteList.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No sites added yet.';
            li.style.fontStyle = 'italic';
            li.style.color = 'var(--text-color-medium)';
            siteListUl.appendChild(li);
            return;
        }
        siteList.forEach(site => {
            const li = document.createElement('li');
            li.textContent = site;
            const removeBtn = document.createElement('button');
            removeBtn.textContent = 'Remove';
            removeBtn.classList.add('remove-site-btn');
            removeBtn.addEventListener('click', () => {
                removeSite(site);
            });
            li.appendChild(removeBtn);
            siteListUl.appendChild(li);
        });
    }

    // Add a site to the list
    function addSite() {
        const site = siteInput.value.trim().toLowerCase();
        if (site) {
            chrome.storage.sync.get(defaultSettings, (settings) => {
                if (!settings.siteList.includes(site)) {
                    settings.siteList.push(site);
                    chrome.storage.sync.set({ siteList: settings.siteList }, () => {
                        renderSiteList(settings.siteList);
                        siteInput.value = ''; // Clear input
                        saveSettings(); // Save immediately after adding/removing a site
                    });
                } else {
                    alert('Site already in list!'); // Basic feedback
                }
            });
        }
    }

    // Remove a site from the list
    function removeSite(siteToRemove) {
        chrome.storage.sync.get(defaultSettings, (settings) => {
            const updatedList = settings.siteList.filter(site => site !== siteToRemove);
            chrome.storage.sync.set({ siteList: updatedList }, () => {
                renderSiteList(updatedList);
                saveSettings(); // Save immediately after adding/removing a site
            });
        });
    }

    // Get current site list from DOM (for saving)
    function getSiteListFromDOM() {
        // Filter out the "No sites added yet." placeholder if it exists
        const items = Array.from(siteListUl.children)
                      .filter(li => li.textContent !== 'No sites added yet.');
        return items.map(li => li.textContent.replace('Remove', '').trim());
    }

    // Toggle visibility of site list container
    function toggleSiteListVisibility(scope) {
        const siteListContainer = document.querySelector('.site-list-container');
        if (scope === 'selected') {
            siteListContainer.style.display = 'block';
        } else {
            siteListContainer.style.display = 'none';
        }
    }

    // Event Listeners

    // Background Warmth Buttons
    colorButtons.forEach(button => {
        button.addEventListener('click', () => {
            colorButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            customColorInput.value = ''; // Clear custom input when a preset is selected
            saveSettings(); // Save on preset selection
        });
    });

    // Custom Color Picker and Input
    customColorPicker.addEventListener('input', (event) => {
        customColorInput.value = event.target.value;
        colorButtons.forEach(btn => btn.classList.remove('active')); // Deactivate preset buttons
        // saveSettings() called by applyCustomColorBtn or general save
    });

    customColorInput.addEventListener('input', (event) => {
        const value = event.target.value;
        if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
            customColorPicker.value = value;
            colorButtons.forEach(btn => btn.classList.remove('active')); // Deactivate preset buttons
        }
        // saveSettings() called by applyCustomColorBtn or general save
    });

    applyCustomColorBtn.addEventListener('click', () => {
        // Ensure custom color is applied and other buttons are deselected
        // Validation for customColorInput value will happen in saveSettings
        colorButtons.forEach(btn => btn.classList.remove('active'));
        saveSettings();
    });


    // Filters - Use 'change' for checkboxes and 'input' for sliders
    blueLightFilterToggle.addEventListener('change', () => {
        blueLightIntensitySlider.disabled = !blueLightFilterToggle.checked;
        saveSettings();
    });
    blueLightIntensitySlider.addEventListener('input', () => {
        blueLightIntensityValueSpan.textContent = blueLightIntensitySlider.value + '%';
        saveSettings(); // Save as slider is moved
    });
    contrastLevelSlider.addEventListener('input', () => {
        contrastLevelValueSpan.textContent = contrastLevelSlider.value + '%';
        saveSettings(); // Save as slider is moved
    });


    // Scope Radios - Use 'change' for radios
    applyAllRadio.addEventListener('change', (event) => {
        toggleSiteListVisibility(event.target.value);
        saveSettings();
    });
    applySelectedRadio.addEventListener('change', (event) => {
        toggleSiteListVisibility(event.target.value);
        saveSettings();
    });

    // Site List
    addSiteBtn.addEventListener('click', addSite);
    siteInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent default form submission if any
            addSite();
        }
    });

    // Initial load of settings when popup opens
    loadSettings();
});