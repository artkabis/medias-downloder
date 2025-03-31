document.addEventListener('DOMContentLoaded', function () {
    // Elements
    const scanBtn = document.getElementById('scanBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const progressBar = document.getElementById('progressBar');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const unselectAllBtn = document.getElementById('unselectAllBtn');
    const downloadSelectedBtn = document.getElementById('downloadSelectedBtn');
    const saveSettingsBtn = document.getElementById('saveSettings');

    // Tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    // Filters
    const imagesCheckbox = document.getElementById('images');
    const pdfCheckbox = document.getElementById('pdf');
    const videoCheckbox = document.getElementById('video');
    const audioCheckbox = document.getElementById('audio');
    const minWidthInput = document.getElementById('minWidth');
    const maxWidthInput = document.getElementById('maxWidth');
    const minHeightInput = document.getElementById('minHeight');
    const maxHeightInput = document.getElementById('maxHeight');
    const urlFilterInput = document.getElementById('urlFilter');

    // Settings
    const downloadLocationInput = document.getElementById('downloadLocation');
    const displayColumnsSelect = document.getElementById('displayColumns');
    const fileNamingSelect = document.getElementById('fileNaming');

    // State
    let mediaFiles = [];
    let filteredFiles = [];
    let selectedFiles = new Set();

    // Load settings
    loadSettings();

    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');

            // Update button states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // Update content visibility
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(`${tabName}-tab`).classList.add('active');
        });
    });

    // Button event listeners
    scanBtn.addEventListener('click', scanPage);
    selectAllBtn.addEventListener('click', selectAll);
    unselectAllBtn.addEventListener('click', unselectAll);
    downloadSelectedBtn.addEventListener('click', downloadSelected);
    saveSettingsBtn.addEventListener('click', saveSettings);

    // Filter event listeners
    imagesCheckbox.addEventListener('change', applyFilters);
    pdfCheckbox.addEventListener('change', applyFilters);
    videoCheckbox.addEventListener('change', applyFilters);
    audioCheckbox.addEventListener('change', applyFilters);
    minWidthInput.addEventListener('input', applyFilters);
    maxWidthInput.addEventListener('input', applyFilters);
    minHeightInput.addEventListener('input', applyFilters);
    maxHeightInput.addEventListener('input', applyFilters);
    urlFilterInput.addEventListener('input', applyFilters);

    // Display columns change
    displayColumnsSelect.addEventListener('change', () => {
        resultsDiv.style.gridTemplateColumns = `repeat(${displayColumnsSelect.value}, 1fr)`;
    });

    // Functions
    async function scanPage() {
        statusDiv.textContent = "Recherche des médias en cours...";
        progressBar.style.width = '30%';
        resultsDiv.innerHTML = "";
        selectedFiles.clear();
        updateDownloadButton();

        // Get selected file types
        const fileTypes = {
            images: imagesCheckbox.checked,
            pdf: pdfCheckbox.checked,
            video: videoCheckbox.checked,
            audio: audioCheckbox.checked
        };

        try {
            // Get the current active tab
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Inject the content script file first
            await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['contentScript.js']
            });

            // Execute the findMediaFiles function from the injected script
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (types) => {
                    // Cette fonction sera exécutée dans le contexte de la page
                    // et appellera la fonction findMediaFiles qui est définie dans contentScript.js
                    return window.findMediaFiles(types);
                },
                args: [fileTypes]
            });

            // Show progress
            progressBar.style.width = '60%';

            // Handle the results
            mediaFiles = result[0].result;

            // Get dimensions for images
            const dimensionsResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (urls) => {
                    // Cette fonction sera exécutée dans le contexte de la page
                    // et appellera la fonction getImageDimensions qui est définie dans contentScript.js
                    return window.getImageDimensions(urls);
                },
                args: [mediaFiles.filter(file => file.type === 'image').map(file => file.url)]
            });

            // Update image dimensions
            const dimensions = dimensionsResult[0].result;
            mediaFiles.forEach(file => {
                if (file.type === 'image' && dimensions[file.url]) {
                    file.width = dimensions[file.url].width;
                    file.height = dimensions[file.url].height;
                    file.size = dimensions[file.url].size || 'Inconnu';
                }
            });

            // Complete progress
            progressBar.style.width = '100%';
            setTimeout(() => {
                progressBar.style.width = '0%';
            }, 1000);

            // Apply filters and display results
            applyFilters();

        } catch (error) {
            statusDiv.textContent = `Erreur: ${error.message}`;
            progressBar.style.width = '0%';
        }
    }

    function applyFilters() {
        // Get filter values
        const filters = {
            images: imagesCheckbox.checked,
            pdf: pdfCheckbox.checked,
            video: videoCheckbox.checked,
            audio: audioCheckbox.checked,
            minWidth: minWidthInput.value ? parseInt(minWidthInput.value) : 0,
            maxWidth: maxWidthInput.value ? parseInt(maxWidthInput.value) : Infinity,
            minHeight: minHeightInput.value ? parseInt(minHeightInput.value) : 0,
            maxHeight: maxHeightInput.value ? parseInt(maxHeightInput.value) : Infinity,
            urlFilter: urlFilterInput.value.toLowerCase()
        };

        // Apply filters
        filteredFiles = mediaFiles.filter(file => {
            // File type filter
            if ((file.type === 'image' && !filters.images) ||
                (file.type === 'pdf' && !filters.pdf) ||
                (file.type === 'video' && !filters.video) ||
                (file.type === 'audio' && !filters.audio)) {
                return false;
            }

            // Dimension filter (only for images)
            if (file.type === 'image' && file.width && file.height) {
                if (file.width < filters.minWidth || file.width > filters.maxWidth ||
                    file.height < filters.minHeight || file.height > filters.maxHeight) {
                    return false;
                }
            }

            // URL filter
            if (filters.urlFilter && !file.url.toLowerCase().includes(filters.urlFilter)) {
                return false;
            }

            return true;
        });

        // Update UI
        displayResults();
    }

    function displayResults() {
        resultsDiv.innerHTML = "";

        // Set grid columns based on settings
        resultsDiv.style.gridTemplateColumns = `repeat(${displayColumnsSelect.value}, 1fr)`;

        if (filteredFiles.length === 0) {
            statusDiv.textContent = "Aucun fichier ne correspond aux critères.";
            return;
        }

        statusDiv.textContent = `${filteredFiles.length} fichiers trouvés.`;

        filteredFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'image-item';
            item.dataset.index = index;

            // Checkbox for selection
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'image-checkbox';
            checkbox.checked = selectedFiles.has(file.url);
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedFiles.add(file.url);
                } else {
                    selectedFiles.delete(file.url);
                }
                updateDownloadButton();
            });

            // Preview
            let preview;
            if (file.type === 'image') {
                preview = document.createElement('img');
                preview.src = file.url;
                preview.className = 'image-preview';
                preview.onerror = () => {
                    preview.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3H6a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V9L14 3h-4z"/><path d="M14 3v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>';
                };
            } else if (file.type === 'pdf') {
                preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#ff4433" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 3v5h5"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H9"/></svg>';
            } else if (file.type === 'video') {
                preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#4285f4" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/><path d="M10 8l6 4-6 4V8z"/></svg>';
            } else if (file.type === 'audio') {
                preview = document.createElement('div');
                preview.className = 'image-preview';
                preview.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
            }

            // File info
            const fileName = file.url.split('/').pop().split('?')[0];
            let fileInfo = document.createElement('div');
            fileInfo.className = 'image-info';

            // Show dimensions for images
            if (file.type === 'image' && file.width && file.height) {
                fileInfo.textContent = `${fileName.substring(0, 15)}... | ${file.width}x${file.height} | ${file.size}`;
            } else {
                fileInfo.textContent = `${fileName.substring(0, 25)}...`;
            }

            // Actions
            const actions = document.createElement('div');
            actions.className = 'image-actions';

            // Download button
            const downloadBtn = document.createElement('button');
            downloadBtn.innerHTML = '⬇️ Télécharger';
            downloadBtn.className = 'button-secondary';
            downloadBtn.style.fontSize = '12px';
            downloadBtn.addEventListener('click', () => {
                downloadFile(file);
            });

            // Copy URL button
            const copyBtn = document.createElement('button');
            copyBtn.innerHTML = '📋 Copier URL';
            copyBtn.className = 'button-secondary';
            copyBtn.style.fontSize = '12px';
            copyBtn.addEventListener('click', () => {
                navigator.clipboard.writeText(file.url)
                    .then(() => {
                        copyBtn.innerHTML = '✓ Copié!';
                        setTimeout(() => {
                            copyBtn.innerHTML = '📋 Copier URL';
                        }, 2000);
                    });
            });

            // Append elements
            actions.appendChild(downloadBtn);
            actions.appendChild(copyBtn);

            item.appendChild(checkbox);
            item.appendChild(preview);
            item.appendChild(fileInfo);
            item.appendChild(actions);

            resultsDiv.appendChild(item);
        });
    }

    function selectAll() {
        filteredFiles.forEach(file => {
            selectedFiles.add(file.url);
        });

        // Update checkboxes
        document.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });

        updateDownloadButton();
    }

    function unselectAll() {
        selectedFiles.clear();

        // Update checkboxes
        document.querySelectorAll('.image-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });

        updateDownloadButton();
    }

    function updateDownloadButton() {
        const count = selectedFiles.size;
        downloadSelectedBtn.textContent = `Télécharger la sélection (${count})`;
        downloadSelectedBtn.disabled = count === 0;
    }

    function downloadSelected() {
        const filesToDownload = mediaFiles.filter(file => selectedFiles.has(file.url));

        if (filesToDownload.length > 0) {
            statusDiv.textContent = `Téléchargement de ${filesToDownload.length} fichiers en cours...`;

            let downloadFolder = downloadLocationInput.value.trim();
            if (downloadFolder && !downloadFolder.endsWith('/')) {
                downloadFolder += '/';
            }

            let downloadedCount = 0;

            filesToDownload.forEach((file, index) => {
                let fileName = file.url.split('/').pop().split('?')[0];

                // Apply file naming strategy
                if (fileNamingSelect.value === 'sequence') {
                    const extension = fileName.split('.').pop();
                    fileName = `media_${index + 1}.${extension}`;
                } else if (fileNamingSelect.value === 'date') {
                    const extension = fileName.split('.').pop();
                    const now = new Date();
                    const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
                    fileName = `media_${timestamp}_${index + 1}.${extension}`;
                }

                // Download the file
                chrome.downloads.download({
                    url: file.url,
                    filename: downloadFolder + fileName,
                    conflictAction: 'uniquify'
                }, () => {
                    downloadedCount++;

                    // Update progress
                    const progress = (downloadedCount / filesToDownload.length) * 100;
                    progressBar.style.width = `${progress}%`;

                    if (downloadedCount === filesToDownload.length) {
                        statusDiv.textContent = `${downloadedCount} fichiers téléchargés avec succès.`;
                        setTimeout(() => {
                            progressBar.style.width = '0%';
                        }, 3000);
                    }
                });
            });
        }
    }

    function downloadFile(file) {
        let fileName = file.url.split('/').pop().split('?')[0];

        // Apply file naming strategy
        if (fileNamingSelect.value === 'sequence') {
            const extension = fileName.split('.').pop();
            fileName = `media_1.${extension}`;
        } else if (fileNamingSelect.value === 'date') {
            const extension = fileName.split('.').pop();
            const now = new Date();
            const timestamp = now.toISOString().replace(/:/g, '-').replace(/\..+/, '');
            fileName = `media_${timestamp}.${extension}`;
        }

        let downloadFolder = downloadLocationInput.value.trim();
        if (downloadFolder && !downloadFolder.endsWith('/')) {
            downloadFolder += '/';
        }

        chrome.downloads.download({
            url: file.url,
            filename: downloadFolder + fileName,
            conflictAction: 'uniquify'
        }, () => {
            statusDiv.textContent = `${fileName} téléchargé avec succès.`;
        });
    }

    function loadSettings() {
        if (!chrome.storage || !chrome.storage.sync) {
            // Utiliser des valeurs par défaut si l'API de stockage n'est pas disponible
            downloadLocationInput.value = 'Media Downloader';
            displayColumnsSelect.value = '2';
            fileNamingSelect.value = 'original';

            // Appliquer le paramètre de colonnes
            resultsDiv.style.gridTemplateColumns = `repeat(2, 1fr)`;

            console.warn('API de stockage Chrome non disponible, utilisation des valeurs par défaut');
            return;
        }

        chrome.storage.sync.get({
            downloadLocation: 'Media Downloader',
            displayColumns: '2',
            fileNaming: 'original'
        }, (items) => {
            downloadLocationInput.value = items.downloadLocation;
            displayColumnsSelect.value = items.displayColumns;
            fileNamingSelect.value = items.fileNaming;

            // Appliquer le paramètre de colonnes
            resultsDiv.style.gridTemplateColumns = `repeat(${items.displayColumns}, 1fr)`;
        });
    }

    function saveSettings() {
        const settings = {
            downloadLocation: downloadLocationInput.value,
            displayColumns: displayColumnsSelect.value,
            fileNaming: fileNamingSelect.value
        };

        if (!chrome.storage || !chrome.storage.sync) {
            console.warn('API de stockage Chrome non disponible, impossible de sauvegarder les paramètres');
            saveSettingsBtn.textContent = 'Stockage non disponible';
            setTimeout(() => {
                saveSettingsBtn.textContent = 'Enregistrer les paramètres';
            }, 2000);
            return;
        }

        chrome.storage.sync.set(settings, () => {
            saveSettingsBtn.textContent = 'Paramètres enregistrés!';
            setTimeout(() => {
                saveSettingsBtn.textContent = 'Enregistrer les paramètres';
            }, 2000);
        });
    }

    // Les fonctions findMediaFiles et getImageDimensions sont maintenant
    // définies dans contentScript.js et injectées dans la page web
});