// Cette fonction est injectée dans la page web pour trouver tous les fichiers médias
window.findMediaFiles = function (fileTypes) {
    const mediaFiles = [];
    const urlSet = new Set(); // Pour éviter les doublons

    // Fonction pour obtenir l'extension d'une URL
    function getExtension(url) {
        try {
            // Enlever les paramètres de requête et obtenir le nom du fichier
            const fileName = url.split('?')[0].split('/').pop();
            // Obtenir l'extension
            return fileName.split('.').pop().toLowerCase();
        } catch (e) {
            return '';
        }
    }

    // Fonction pour vérifier si une URL est valide
    function isValidUrl(url) {
        try {
            const parsedUrl = new URL(url);
            return ['http:', 'https:'].includes(parsedUrl.protocol);
        } catch (e) {
            return false;
        }
    }

    // Fonction pour résoudre les URL relatives
    function resolveUrl(url) {
        try {
            return new URL(url, window.location.href).href;
        } catch (e) {
            return null;
        }
    }

    // Définir les types de fichiers à rechercher
    const extensions = {
        images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff'],
        pdf: ['pdf'],
        video: ['mp4', 'webm', 'avi', 'mov', 'wmv', 'flv', 'mkv'],
        audio: ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']
    };

    // Filtrer les extensions en fonction de la sélection de l'utilisateur
    const selectedExtensions = [];
    for (const type in fileTypes) {
        if (fileTypes[type] && extensions[type]) {
            selectedExtensions.push(...extensions[type]);
        }
    }

    // Rechercher les images
    if (fileTypes.images) {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            if (img.src && isValidUrl(img.src) && !urlSet.has(img.src)) {
                const ext = getExtension(img.src);
                if (extensions.images.includes(ext) || img.src.includes('data:image/')) {
                    mediaFiles.push({ url: img.src, type: 'image' });
                    urlSet.add(img.src);
                }
            }
        });
    }

    // Rechercher tous les liens
    const links = document.querySelectorAll('a');
    links.forEach(link => {
        if (link.href && isValidUrl(link.href) && !urlSet.has(link.href)) {
            const ext = getExtension(link.href);
            if (selectedExtensions.includes(ext)) {
                let type = '';
                if (extensions.images.includes(ext)) type = 'image';
                else if (extensions.pdf.includes(ext)) type = 'pdf';
                else if (extensions.video.includes(ext)) type = 'video';
                else if (extensions.audio.includes(ext)) type = 'audio';

                mediaFiles.push({ url: link.href, type });
                urlSet.add(link.href);
            }
        }
    });

    // Rechercher les éléments vidéo et audio
    if (fileTypes.video) {
        const videos = document.querySelectorAll('video, source[type^="video"]');
        videos.forEach(video => {
            const src = video.src || video.currentSrc;
            if (src && isValidUrl(src) && !urlSet.has(src)) {
                mediaFiles.push({ url: src, type: 'video' });
                urlSet.add(src);
            }
        });
    }

    if (fileTypes.audio) {
        const audios = document.querySelectorAll('audio, source[type^="audio"]');
        audios.forEach(audio => {
            const src = audio.src || audio.currentSrc;
            if (src && isValidUrl(src) && !urlSet.has(src)) {
                mediaFiles.push({ url: src, type: 'audio' });
                urlSet.add(src);
            }
        });
    }

    // Rechercher les images en arrière-plan dans le CSS
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        if (fileTypes.images) {
            const style = window.getComputedStyle(el);
            const backgroundImage = style.backgroundImage;

            if (backgroundImage && backgroundImage !== 'none') {
                const matches = Array.from(backgroundImage.matchAll(/url\(['"]?(.*?)['"]?\)/g));
                for (const match of matches) {
                    if (match && match[1]) {
                        const url = resolveUrl(match[1]);
                        if (url && !urlSet.has(url)) {
                            const ext = getExtension(url);
                            if (extensions.images.includes(ext)) {
                                mediaFiles.push({ url, type: 'image' });
                                urlSet.add(url);
                            }
                        }
                    }
                }
            }
        }
    });

    // Rechercher les PDF et autres médias dans le code source de la page
    if (document.documentElement.outerHTML) {
        const html = document.documentElement.outerHTML;
        const urlRegex = /https?:\/\/[^\s"'<>()]+(\.(?:pdf|png|jpg|jpeg|gif|mp4|mp3|webp|svg|webm|wav|ogg|flac|avi|mov|wmv|bmp|tiff|ico|aac|m4a|flv|mkv))\b/ig;

        let match;
        while ((match = urlRegex.exec(html)) !== null) {
            const url = match[0];
            const ext = getExtension(url);

            if (selectedExtensions.includes(ext) && !urlSet.has(url)) {
                let type = '';
                if (extensions.images.includes(ext)) type = 'image';
                else if (extensions.pdf.includes(ext)) type = 'pdf';
                else if (extensions.video.includes(ext)) type = 'video';
                else if (extensions.audio.includes(ext)) type = 'audio';

                mediaFiles.push({ url, type });
                urlSet.add(url);
            }
        }
    }

    // Rechercher les images Instagram
    if (fileTypes.images && window.location.hostname.includes('instagram.com')) {
        document.querySelectorAll('article img').forEach(img => {
            if (img.src && isValidUrl(img.src) && !urlSet.has(img.src)) {
                mediaFiles.push({ url: img.src, type: 'image' });
                urlSet.add(img.src);
            }
        });
    }

    // Rechercher les images Facebook
    if (fileTypes.images && window.location.hostname.includes('facebook.com')) {
        document.querySelectorAll('a[role="link"] img').forEach(img => {
            if (img.src && isValidUrl(img.src) && !urlSet.has(img.src)) {
                mediaFiles.push({ url: img.src, type: 'image' });
                urlSet.add(img.src);
            }
        });
    }

    // Rechercher les images Pinterest
    if (fileTypes.images && window.location.hostname.includes('pinterest.com')) {
        document.querySelectorAll('[data-test-id="pinrep-image"] img').forEach(img => {
            if (img.src && isValidUrl(img.src) && !urlSet.has(img.src)) {
                mediaFiles.push({ url: img.src, type: 'image' });
                urlSet.add(img.src);
            }
        });
    }

    return mediaFiles;
}

// Cette fonction est injectée dans la page web pour obtenir les dimensions des images
window.getImageDimensions = function (imageUrls) {
    return new Promise(async (resolve) => {
        const dimensions = {};
        let completedCount = 0;

        for (const url of imageUrls) {
            try {
                // Créer un élément image
                const img = new Image();

                // Définir les gestionnaires de chargement et d'erreur
                img.onload = function () {
                    dimensions[url] = {
                        width: this.width,
                        height: this.height,
                        size: this.fileSize
                    };

                    completedCount++;
                    if (completedCount === imageUrls.length) {
                        resolve(dimensions);
                    }
                };

                img.onerror = function () {
                    completedCount++;
                    if (completedCount === imageUrls.length) {
                        resolve(dimensions);
                    }
                };

                // Définir un délai pour éviter les blocages sur des images problématiques
                setTimeout(() => {
                    if (img.complete === false) {
                        img.src = '';
                        completedCount++;
                        if (completedCount === imageUrls.length) {
                            resolve(dimensions);
                        }
                    }
                }, 3000);

                // Commencer à charger l'image
                img.src = url;

                // Essayer d'obtenir la taille du fichier à partir des en-têtes
                try {
                    const response = await fetch(url, { method: 'HEAD' });
                    const contentLength = response.headers.get('content-length');
                    if (contentLength) {
                        const size = parseInt(contentLength);
                        if (size > 0) {
                            let sizeText;
                            if (size > 1024 * 1024) {
                                sizeText = `${(size / (1024 * 1024)).toFixed(1)} MB`;
                            } else if (size > 1024) {
                                sizeText = `${(size / 1024).toFixed(1)} KB`;
                            } else {
                                sizeText = `${size} B`;
                            }

                            if (dimensions[url]) {
                                dimensions[url].size = sizeText;
                            } else {
                                dimensions[url] = { size: sizeText };
                            }
                        }
                    }
                } catch (e) {
                    // Ignorer les erreurs lors de la récupération de la taille du fichier
                }
            } catch (error) {
                completedCount++;
                if (completedCount === imageUrls.length) {
                    resolve(dimensions);
                }
            }
        }

        // S'il n'y a pas d'URL d'image, résoudre immédiatement
        if (imageUrls.length === 0) {
            resolve(dimensions);
        }
    });
}