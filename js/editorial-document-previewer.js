/**
 * Editorial Document Previewer Client Script
 *
 * Copyright (c) 2026 Dhimas Rizky H / JRTN
 * Distributed under the GNU GPL v3. For full terms see the file LICENSE.
 */

(function () {
    'use strict';

    class EditorialDocumentPreviewer {
        constructor() {
            this.config = window.edpConfig || {};
            this.modal = null;
            this.modalDialog = null;
            this.modalTitle = null;
            this.formatBadge = null;
            this.viewerControls = null;
            this.btnNewTab = null;
            this.btnDownload = null;
            this.btnFullscreen = null;
            this.modalBody = null;

            // Viewer state
            this.currentScale = 1.0;
            this.currentFileType = null;
            this.currentFileUrl = null;
            this.currentStreamUrl = null;
            this.currentFileName = null;
            this.isFullscreen = false;
            this.debounceTimer = null;

            this.init();
        }

        init() {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => this.boot());
            } else {
                this.boot();
            }
        }

        boot() {
            this.createModal();
            this.attachMutationObserver();
            this.scanAndInjectButtons();
        }

        t(key, fallback) {
            if (this.config.locale && this.config.locale[key]) {
                return this.config.locale[key];
            }
            return fallback;
        }

        createModal() {
            if (document.getElementById('edp-previewer-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'edp-previewer-overlay';
            overlay.className = 'edp-modal-overlay';
            overlay.innerHTML = `
                <div class="edp-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="edp-modal-title">
                    <div class="edp-modal-header">
                        <div class="edp-modal-title-group">
                            <svg class="edp-modal-file-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                            <div class="edp-modal-title-wrapper">
                                <h3 id="edp-modal-title" class="edp-modal-title">${this.t('previewTitle', 'Document Preview')}</h3>
                                <span id="edp-format-badge" class="edp-format-badge" style="display:none;"></span>
                            </div>
                        </div>
                        <div class="edp-modal-actions">
                            <div id="edp-viewer-controls" class="edp-viewer-controls" style="display:none;"></div>
                            <a id="edp-btn-newtab" href="#" class="edp-btn edp-btn-newtab" target="_blank" rel="noopener" style="display:none;" title="${this.t('openInNewTab', 'Open in New Tab')}">
                                <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                                <span>${this.t('openInNewTab', 'Open in New Tab')}</span>
                            </a>
                            <a id="edp-btn-download" href="#" class="edp-btn edp-btn-download" target="_blank" rel="noopener" title="${this.t('downloadFile', 'Download Original')}">
                                <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                                <span>${this.t('downloadFile', 'Download')}</span>
                            </a>
                            <button id="edp-btn-fullscreen" type="button" class="edp-btn edp-btn-fullscreen" title="${this.t('fullScreen', 'Full Screen')}">
                                <svg viewBox="0 0 24 24"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
                            </button>
                            <button id="edp-btn-close" type="button" class="edp-btn edp-btn-close" title="${this.t('closePreview', 'Close Preview')}">
                                <span>${this.t('closePreview', 'Close')}</span>
                            </button>
                        </div>
                    </div>
                    <div id="edp-modal-body" class="edp-modal-body">
                        <div class="edp-loading-indicator">
                            <div class="edp-spinner"></div>
                            <span>${this.t('loading', 'Loading document preview...')}</span>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            this.modal = overlay;
            this.modalDialog = overlay.querySelector('.edp-modal-dialog');
            this.modalTitle = overlay.querySelector('#edp-modal-title');
            this.formatBadge = overlay.querySelector('#edp-format-badge');
            this.viewerControls = overlay.querySelector('#edp-viewer-controls');
            this.btnNewTab = overlay.querySelector('#edp-btn-newtab');
            this.btnDownload = overlay.querySelector('#edp-btn-download');
            this.btnFullscreen = overlay.querySelector('#edp-btn-fullscreen');
            this.modalBody = overlay.querySelector('#edp-modal-body');

            // Event bindings
            overlay.querySelector('#edp-btn-close').addEventListener('click', () => this.close());
            this.btnFullscreen.addEventListener('click', () => this.toggleFullscreen());

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal.classList.contains('edp-active')) {
                    this.close();
                }
            });
        }

        toggleFullscreen() {
            this.isFullscreen = !this.isFullscreen;
            if (this.isFullscreen) {
                this.modalDialog.classList.add('edp-fullscreen');
                this.btnFullscreen.setAttribute('title', this.t('exitFullScreen', 'Exit Full Screen'));
            } else {
                this.modalDialog.classList.remove('edp-fullscreen');
                this.btnFullscreen.setAttribute('title', this.t('fullScreen', 'Full Screen'));
            }
        }

        scanAndInjectButtons() {
            // Find all file download links in OJS workflow grids and tables
            const fileLinks = document.querySelectorAll(
                'a[href*="downloadFile"], a[href*="download-file"], a.download[href*="files"], a[href*="/files/"][href*="/download"], a[href*="submissionFileId"]'
            );

            fileLinks.forEach((link) => {
                if (link.dataset.edpBound) return;
                link.dataset.edpBound = 'true';

                const fileName = this.extractFileName(link);
                const fileUrl = link.href;

                // Resolve secure streaming endpoint URL if parameters are detectable
                const streamUrl = this.resolveStreamUrl(fileUrl, link);

                // Create Quick Preview button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'edp-preview-trigger';
                btn.setAttribute('title', `${this.t('previewButton', 'Preview')} ${fileName}`);
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    <span>${this.t('previewButton', 'Preview')}</span>
                `;

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.open(fileName, fileUrl, streamUrl);
                });

                // Insert preview button immediately following the file link
                if (link.nextSibling) {
                    link.parentNode.insertBefore(btn, link.nextSibling);
                } else {
                    link.parentNode.appendChild(btn);
                }
            });
        }

        extractFileName(linkElement) {
            let name = linkElement.textContent.trim();
            if (name && name.includes('.')) {
                return name;
            }

            // Check title attribute
            const title = linkElement.getAttribute('title');
            if (title && title.includes('.')) {
                return title.trim();
            }

            // Check adjacent grid cell or parent row
            const row = linkElement.closest('tr');
            if (row) {
                const nameCell = row.querySelector('.gridCell:first-child, .first_column, .pkp_helpers_align_left');
                if (nameCell && nameCell.textContent.trim().includes('.')) {
                    return nameCell.textContent.trim();
                }
            }

            // Check query param
            try {
                const url = new URL(linkElement.href, window.location.origin);
                const fileParam = url.searchParams.get('fileName') || url.searchParams.get('name');
                if (fileParam) return fileParam;
            } catch (e) {}

            return name || 'Document';
        }

        resolveStreamUrl(originalUrl, linkElement) {
            if (!this.config.streamUrl) {
                return originalUrl;
            }

            let submissionId = null;
            let fileId = null;

            // 1. Try URL search parameters
            try {
                const parsedUrl = new URL(originalUrl, window.location.origin);
                submissionId = parsedUrl.searchParams.get('submissionId');
                fileId = parsedUrl.searchParams.get('submissionFileId') || parsedUrl.searchParams.get('fileId');
            } catch (e) {}

            // 2. Try REST API URL pattern: /submissions/{submissionId}/files/{fileId}
            if (!fileId || !submissionId) {
                const restMatch = originalUrl.match(/\/submissions\/(\d+)\/files\/(\d+)/i);
                if (restMatch) {
                    submissionId = restMatch[1];
                    fileId = restMatch[2];
                }
            }

            // 3. Fallback: extract submissionId from current window URL (/workflow/access/{submissionId})
            if (!submissionId) {
                const pageMatch = window.location.href.match(/\/workflow\/(?:access|index)\/(\d+)/i);
                if (pageMatch) {
                    submissionId = pageMatch[1];
                }
            }

            // 4. Fallback: extract fileId from grid row DOM attribute
            if (!fileId && linkElement) {
                const row = linkElement.closest('tr[id*="submissionFilesGrid-row-"], tr.gridRow');
                if (row && row.id) {
                    const rowMatch = row.id.match(/row-(\d+)/i);
                    if (rowMatch) {
                        fileId = rowMatch[1];
                    }
                }
            }

            if (submissionId && fileId) {
                const sep = this.config.streamUrl.includes('?') ? '&' : '?';
                return `${this.config.streamUrl}${sep}submissionId=${encodeURIComponent(submissionId)}&fileId=${encodeURIComponent(fileId)}`;
            }

            return originalUrl;
        }

        attachMutationObserver() {
            const observer = new MutationObserver(() => {
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.scanAndInjectButtons();
                }, 150);
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
            });
        }

        open(fileName, fileUrl, streamUrl) {
            this.currentFileName = fileName || 'Document Preview';
            this.currentFileUrl = fileUrl;
            this.currentStreamUrl = streamUrl || fileUrl;
            this.currentScale = 1.0;

            this.modalTitle.textContent = this.currentFileName;
            this.btnDownload.href = this.currentFileUrl;
            this.btnNewTab.href = this.currentStreamUrl;

            const ext = (this.currentFileName.split('.').pop() || '').toLowerCase();
            this.currentFileType = ext;

            // Configure header badge
            this.updateFormatBadge(ext);

            // Open overlay
            this.modal.classList.add('edp-active');

            // Render viewport
            this.renderContent(this.currentStreamUrl, ext);
        }

        updateFormatBadge(ext) {
            this.formatBadge.style.display = 'inline-block';
            this.formatBadge.textContent = ext.toUpperCase();
            this.formatBadge.className = 'edp-format-badge';

            if (ext === 'docx' || ext === 'doc') {
                this.formatBadge.classList.add('docx');
            } else if (ext === 'pdf') {
                this.formatBadge.classList.add('pdf');
            } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
                this.formatBadge.classList.add('img');
            } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
                this.formatBadge.classList.add('xlsx');
            }
        }

        renderContent(streamUrl, ext) {
            // Reset toolbar controls
            this.viewerControls.style.display = 'none';
            this.viewerControls.innerHTML = '';
            this.btnNewTab.style.display = 'none';

            this.modalBody.innerHTML = `
                <div class="edp-loading-indicator">
                    <div class="edp-spinner"></div>
                    <span>${this.t('loading', 'Loading document preview...')}</span>
                </div>
            `;

            if (ext === 'docx') {
                this.renderDocx(streamUrl);
            } else if (ext === 'pdf') {
                this.renderPdf(streamUrl);
            } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
                this.renderImage(streamUrl);
            } else {
                this.renderUnsupported(ext);
            }
        }

        /* -----------------------------------------------------------------
           DOCX RENDERING ENGINE (100% Client-Side via docx-preview)
           ----------------------------------------------------------------- */
        renderDocx(streamUrl) {
            if (typeof window.docx === 'undefined' || !window.docx.renderAsync) {
                this.renderError(
                    'DOCX engine error',
                    'The Word rendering engine (docx-preview) could not be loaded.'
                );
                return;
            }

            fetch(streamUrl, { credentials: 'same-origin' })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.arrayBuffer();
                })
                .then((arrayBuffer) => {
                    this.modalBody.innerHTML = `
                        <div class="edp-viewport-docx">
                            <div class="edp-docx-scale-container" id="edp-docx-content"></div>
                        </div>
                    `;

                    const contentContainer = document.getElementById('edp-docx-content');

                    window.docx.renderAsync(arrayBuffer, contentContainer, null, {
                        className: 'docx',
                        inWrapper: true,
                        ignoreWidth: false,
                        ignoreHeight: false,
                        ignoreFonts: false,
                        breakPages: true,
                        trimXmlDeclaration: true,
                    }).then(() => {
                        this.setupDocxControls(contentContainer);
                    }).catch((err) => {
                        this.renderError('Unable to render DOCX preview', err.message);
                    });
                })
                .catch((err) => {
                    this.renderError('Failed to fetch document', err.message);
                });
        }

        setupDocxControls(container) {
            this.viewerControls.style.display = 'inline-flex';
            this.viewerControls.innerHTML = `
                <button type="button" class="edp-ctrl-btn" id="edp-docx-zoom-out" title="${this.t('zoomOut', 'Zoom Out')}">-</button>
                <span class="edp-zoom-level" id="edp-docx-zoom-label">100%</span>
                <button type="button" class="edp-ctrl-btn" id="edp-docx-zoom-in" title="${this.t('zoomIn', 'Zoom In')}">+</button>
                <button type="button" class="edp-ctrl-btn" id="edp-docx-fit" title="${this.t('fitWidth', 'Fit Width')}" style="width:auto; padding:0 6px; font-size:11px;">Fit</button>
            `;

            const zoomInBtn = document.getElementById('edp-docx-zoom-in');
            const zoomOutBtn = document.getElementById('edp-docx-zoom-out');
            const zoomLabel = document.getElementById('edp-docx-zoom-label');
            const fitBtn = document.getElementById('edp-docx-fit');

            const applyZoom = (scale) => {
                this.currentScale = Math.min(Math.max(scale, 0.4), 2.0);
                container.style.transform = `scale(${this.currentScale})`;
                zoomLabel.textContent = `${Math.round(this.currentScale * 100)}%`;
            };

            zoomInBtn.addEventListener('click', () => applyZoom(this.currentScale + 0.1));
            zoomOutBtn.addEventListener('click', () => applyZoom(this.currentScale - 0.1));
            fitBtn.addEventListener('click', () => applyZoom(1.0));
        }

        /* -----------------------------------------------------------------
           PDF RENDERING ENGINE (In-Browser Native Embed)
           ----------------------------------------------------------------- */
        renderPdf(streamUrl) {
            this.btnNewTab.style.display = 'inline-flex';
            this.modalBody.innerHTML = `
                <iframe class="edp-viewport-pdf" src="${streamUrl}#toolbar=1&navpanes=1" title="${this.currentFileName}"></iframe>
            `;
        }

        /* -----------------------------------------------------------------
           IMAGE RENDERING ENGINE (Client-Side Figures & Graphics)
           ----------------------------------------------------------------- */
        renderImage(streamUrl) {
            this.btnNewTab.style.display = 'inline-flex';

            this.modalBody.innerHTML = `
                <div class="edp-viewport-image-wrapper" id="edp-img-wrapper">
                    <img class="edp-viewport-image" id="edp-preview-img" src="${streamUrl}" alt="${this.currentFileName}">
                    <div class="edp-image-meta-badge" id="edp-img-badge" style="display:none;"></div>
                </div>
            `;

            const img = document.getElementById('edp-preview-img');
            const badge = document.getElementById('edp-img-badge');
            const wrapper = document.getElementById('edp-img-wrapper');

            img.addEventListener('load', () => {
                badge.textContent = `${img.naturalWidth} × ${img.naturalHeight} px`;
                badge.style.display = 'inline-block';
                this.setupImageControls(img, badge);
            });

            img.addEventListener('error', () => {
                this.renderError('Failed to load image', 'The image preview could not be displayed.');
            });
        }

        setupImageControls(img, badge) {
            this.viewerControls.style.display = 'inline-flex';
            this.viewerControls.innerHTML = `
                <button type="button" class="edp-ctrl-btn" id="edp-img-zoom-out" title="${this.t('zoomOut', 'Zoom Out')}">-</button>
                <span class="edp-zoom-level" id="edp-img-zoom-label">100%</span>
                <button type="button" class="edp-ctrl-btn" id="edp-img-zoom-in" title="${this.t('zoomIn', 'Zoom In')}">+</button>
                <button type="button" class="edp-ctrl-btn" id="edp-img-reset" title="${this.t('resetZoom', 'Reset')}" style="width:auto; padding:0 6px; font-size:11px;">Reset</button>
            `;

            const zoomInBtn = document.getElementById('edp-img-zoom-in');
            const zoomOutBtn = document.getElementById('edp-img-zoom-out');
            const zoomLabel = document.getElementById('edp-img-zoom-label');
            const resetBtn = document.getElementById('edp-img-reset');

            const applyZoom = (scale) => {
                this.currentScale = Math.min(Math.max(scale, 0.25), 4.0);
                if (this.currentScale !== 1.0) {
                    img.classList.add('edp-zoomed');
                } else {
                    img.classList.remove('edp-zoomed');
                }
                img.style.transform = `scale(${this.currentScale})`;
                zoomLabel.textContent = `${Math.round(this.currentScale * 100)}%`;
                badge.textContent = `${img.naturalWidth} × ${img.naturalHeight} px (${Math.round(this.currentScale * 100)}%)`;
            };

            zoomInBtn.addEventListener('click', () => applyZoom(this.currentScale + 0.25));
            zoomOutBtn.addEventListener('click', () => applyZoom(this.currentScale - 0.25));
            resetBtn.addEventListener('click', () => applyZoom(1.0));

            // Click-to-zoom toggle
            img.addEventListener('click', () => {
                applyZoom(this.currentScale === 1.0 ? 2.0 : 1.0);
            });
        }

        /* -----------------------------------------------------------------
           FALLBACK AND ERROR VIEWS
           ----------------------------------------------------------------- */
        renderUnsupported(ext) {
            this.modalBody.innerHTML = `
                <div class="edp-fallback-card">
                    <svg class="edp-fallback-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                    <h4 class="edp-fallback-title">.${ext.toUpperCase()} ${this.t('previewTitle', 'Document Preview')}</h4>
                    <p class="edp-fallback-desc">${this.t('unsupportedFormat', 'Preview is not directly available for this file format. Please use the download button to inspect the document locally.')}</p>
                    <a href="${this.currentFileUrl}" class="edp-btn edp-btn-download" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>${this.t('downloadFile', 'Download Original File')}</span>
                    </a>
                </div>
            `;
        }

        renderError(title, message) {
            this.modalBody.innerHTML = `
                <div class="edp-fallback-card">
                    <svg class="edp-fallback-icon" style="color: #ef4444;" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                    </svg>
                    <h4 class="edp-fallback-title">${title}</h4>
                    <p class="edp-fallback-desc">${message}</p>
                    <a href="${this.currentFileUrl}" class="edp-btn edp-btn-download" target="_blank" rel="noopener">
                        <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                        <span>${this.t('downloadFile', 'Download Original File')}</span>
                    </a>
                </div>
            `;
        }

        close() {
            this.modal.classList.remove('edp-active');
            if (this.isFullscreen) {
                this.toggleFullscreen();
            }
            this.modalBody.innerHTML = '';
            this.viewerControls.style.display = 'none';
            this.viewerControls.innerHTML = '';
            this.btnNewTab.style.display = 'none';
            this.formatBadge.style.display = 'none';
        }
    }

    new EditorialDocumentPreviewer();
})();
