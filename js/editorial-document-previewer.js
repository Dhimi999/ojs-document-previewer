/**
 * Editorial Document Previewer Client Script
 *
 * PKP / OJS Editorial Standards (GPL v3)
 * Copyright (c) 2026 Dhimas Rizky H / JRTN
 */

(function () {
    'use strict';

    class EditorialDocumentPreviewer {
        constructor() {
            this.config = window.edpConfig || {};

            // Main Modal Elements
            this.modal = null;
            this.modalDialog = null;
            this.modalTitle = null;
            this.formatBadge = null;
            this.viewerControls = null;
            this.btnPrint = null;
            this.btnNewTab = null;
            this.btnDownload = null;
            this.btnFullscreen = null;
            this.modalBody = null;
            this.docxBanner = null;
            this.bannerBtnDownload = null;

            // DOCX Editorial Notice Modal Elements
            this.docxNoticeOverlay = null;
            this.docxNoticeCheckbox = null;
            this.docxNoticeDownloadBtn = null;
            this.docxNoticeContinueBtn = null;
            this.docxNoticeCloseBtn = null;
            this.pendingDocxParams = null;

            // Viewer runtime state
            this.currentScale = 1.0;
            this.currentFileType = null;
            this.currentFileUrl = null;
            this.currentFileName = null;
            this.currentBlobUrl = null;
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
            this.createDocxNoticeModal();
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
                            <button id="edp-btn-print" type="button" class="edp-btn edp-btn-print" style="display:none;" title="${this.t('printPdf', 'Print / Save as PDF')}">
                                <svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                                <span>${this.t('printPdf', 'Print / PDF')}</span>
                            </button>
                            <a id="edp-btn-newtab" href="#" class="edp-btn edp-btn-newtab edp-ignore-link" data-edp-bound="true" data-edp-internal="true" target="_blank" rel="noopener" style="display:none;" title="${this.t('openInNewTab', 'Open in New Tab')}">
                                <svg viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>
                                <span>${this.t('openInNewTab', 'Open in New Tab')}</span>
                            </a>
                            <a id="edp-btn-download" href="#" class="edp-btn edp-btn-download edp-ignore-link" data-edp-bound="true" data-edp-internal="true" target="_blank" rel="noopener" title="${this.t('downloadFile', 'Download Original')}">
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

                    <div id="edp-docx-banner" class="edp-docx-banner" style="display:none;">
                        <div class="edp-docx-banner-content">
                            <svg class="edp-docx-banner-icon" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                            <span class="edp-docx-banner-text">${this.t('docxNoticeBanner', 'Quick in-browser preview. For 100% exact layout fidelity, download the original file or use Print / Save as PDF.')}</span>
                        </div>
                        <div class="edp-docx-banner-actions">
                            <button type="button" id="edp-banner-btn-print" class="edp-docx-banner-btn">
                                <svg viewBox="0 0 24 24"><path d="M19 8H5c-1.66 0-3 1.34-3 3v6h4v4h12v-4h4v-6c0-1.66-1.34-3-3-3zm-3 11H8v-5h8v5zm3-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm-1-9H6v4h12V3z"/></svg>
                                <span>${this.t('printPdf', 'Print / PDF')}</span>
                            </button>
                            <a id="edp-banner-btn-download" href="#" class="edp-docx-banner-btn edp-ignore-link" data-edp-bound="true" data-edp-internal="true" target="_blank" rel="noopener">
                                <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                                <span>${this.t('downloadFile', 'Download')}</span>
                            </a>
                            <button type="button" id="edp-docx-banner-dismiss" class="edp-docx-banner-dismiss" title="Dismiss">&times;</button>
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
            this.btnPrint = overlay.querySelector('#edp-btn-print');
            this.btnNewTab = overlay.querySelector('#edp-btn-newtab');
            this.btnDownload = overlay.querySelector('#edp-btn-download');
            this.btnFullscreen = overlay.querySelector('#edp-btn-fullscreen');
            this.modalBody = overlay.querySelector('#edp-modal-body');
            this.docxBanner = overlay.querySelector('#edp-docx-banner');
            this.bannerBtnDownload = overlay.querySelector('#edp-banner-btn-download');

            // 1. ISOLATE MODAL EVENTS: Stop propagation to prevent OJS background panels from closing
            const stopPropagation = (e) => {
                e.stopPropagation();
            };
            ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel', 'contextmenu'].forEach((evt) => {
                overlay.addEventListener(evt, stopPropagation);
            });

            // 2. Toolbar action bindings
            overlay.querySelector('#edp-btn-close').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.close();
            });

            this.btnPrint.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.printDocx();
            });

            this.btnFullscreen.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.toggleFullscreen();
            });

            // Banner action bindings
            overlay.querySelector('#edp-banner-btn-print').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.printDocx();
            });

            overlay.querySelector('#edp-docx-banner-dismiss').addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.docxBanner.style.display = 'none';
            });

            // Backdrop click closes preview modal without bubbling to OJS
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.close();
                }
            });

            // Capture-phase keydown listener for Escape
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    if (this.docxNoticeOverlay && this.docxNoticeOverlay.classList.contains('edp-active')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        this.closeDocxNotice();
                        return;
                    }
                    if (this.modal && this.modal.classList.contains('edp-active')) {
                        e.preventDefault();
                        e.stopPropagation();
                        e.stopImmediatePropagation();
                        this.close();
                        return;
                    }
                }
            }, true);
        }

        createDocxNoticeModal() {
            if (document.getElementById('edp-docx-notice-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'edp-docx-notice-overlay';
            overlay.className = 'edp-docx-notice-overlay';
            overlay.innerHTML = `
                <div class="edp-docx-notice-dialog" role="dialog" aria-modal="true" aria-labelledby="edp-notice-title">
                    <div class="edp-docx-notice-header">
                        <div class="edp-docx-notice-title-group">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                            <h4 id="edp-notice-title" class="edp-docx-notice-title">${this.t('docxNoticeTitle', 'DOCX Document Preview')}</h4>
                        </div>
                        <button type="button" id="edp-notice-close-btn" class="edp-docx-notice-close" title="${this.t('closePreview', 'Close')}">&times;</button>
                    </div>
                    <div class="edp-docx-notice-body">
                        <div class="edp-docx-notice-callout">
                            ${this.t('docxNoticeDesc', 'This preview is rendered directly in your browser for speed and strict manuscript confidentiality (100% client-side without third-party servers). Complex formatting, pagination, line numbering, or advanced equations may differ slightly from Microsoft Word desktop.')}
                        </div>
                        <label class="edp-docx-notice-checkbox-label">
                            <input type="checkbox" id="edp-docx-remember-checkbox">
                            <span>${this.t('docxNoticeRemember', 'Remember my choice (do not show this again)')}</span>
                        </label>
                    </div>
                    <div class="edp-docx-notice-footer">
                        <a id="edp-notice-download-btn" href="#" class="edp-btn edp-ignore-link" data-edp-bound="true" data-edp-internal="true" target="_blank" rel="noopener">
                            <svg viewBox="0 0 24 24"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                            <span>${this.t('docxNoticeActionDownload', 'Download Original (.docx)')}</span>
                        </a>
                        <button type="button" id="edp-notice-continue-btn" class="edp-btn edp-btn-download">
                            <span>${this.t('docxNoticeActionPreview', 'Continue to Preview')}</span>
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            this.docxNoticeOverlay = overlay;
            this.docxNoticeCheckbox = overlay.querySelector('#edp-docx-remember-checkbox');
            this.docxNoticeDownloadBtn = overlay.querySelector('#edp-notice-download-btn');
            this.docxNoticeContinueBtn = overlay.querySelector('#edp-notice-continue-btn');
            this.docxNoticeCloseBtn = overlay.querySelector('#edp-notice-close-btn');

            // Event isolation
            const stopPropagation = (e) => e.stopPropagation();
            ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'wheel'].forEach((evt) => {
                overlay.addEventListener(evt, stopPropagation);
            });

            this.docxNoticeCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.closeDocxNotice();
            });

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.closeDocxNotice();
                }
            });

            this.docxNoticeContinueBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (this.docxNoticeCheckbox.checked) {
                    try {
                        localStorage.setItem('edp_docx_notice_dismissed', 'true');
                    } catch (err) {}
                }
                const params = this.pendingDocxParams;
                this.closeDocxNotice();
                if (params) {
                    this.open(params.fileName, params.ext, params.fileUrl);
                }
            });

            this.docxNoticeDownloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (this.docxNoticeCheckbox.checked) {
                    try {
                        localStorage.setItem('edp_docx_notice_dismissed', 'true');
                    } catch (err) {}
                }
                this.closeDocxNotice();
            });
        }

        showDocxNotice(fileName, ext, fileUrl) {
            this.pendingDocxParams = { fileName, ext, fileUrl };
            this.docxNoticeDownloadBtn.href = fileUrl;
            this.docxNoticeCheckbox.checked = false;

            document.body.classList.add('edp-lock-scroll');
            this.docxNoticeOverlay.classList.add('edp-active');
        }

        closeDocxNotice() {
            if (this.docxNoticeOverlay) {
                this.docxNoticeOverlay.classList.remove('edp-active');
            }
            if (!this.modal || !this.modal.classList.contains('edp-active')) {
                document.body.classList.remove('edp-lock-scroll');
            }
            this.pendingDocxParams = null;
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

        cleanupBlob() {
            if (this.currentBlobUrl) {
                URL.revokeObjectURL(this.currentBlobUrl);
                this.currentBlobUrl = null;
            }
        }

        detectFileMetadata(linkElement) {
            let fileName = '';
            let extension = '';

            const genericLabels = [
                'download original', 'download-original', 'download file',
                'download', 'unduh berkas', 'unduh berkas asli', 'unduh',
                'view file', 'lihat berkas', 'preview', 'pratinjau'
            ];

            const isGeneric = (text) => {
                if (!text) return true;
                const clean = text.trim().toLowerCase();
                return genericLabels.some((g) => clean === g || clean.startsWith(g));
            };

            const row = linkElement.closest('tr');

            // 1. Inspect PKP FileNameGridColumn span class (.file_extension.<ext>)
            if (row) {
                const extSpan = row.querySelector('.file_extension');
                if (extSpan) {
                    for (const cls of extSpan.classList) {
                        if (cls !== 'file_extension' && cls.length <= 5) {
                            extension = cls.toLowerCase();
                            break;
                        }
                    }
                }
            }

            // 2. Inspect URL search parameters (fileName, filename, or name)
            try {
                const url = new URL(linkElement.href, window.location.origin);
                const fn = url.searchParams.get('fileName') || url.searchParams.get('filename') || url.searchParams.get('name');
                if (fn && !isGeneric(fn)) {
                    fileName = fn;
                    if (fn.includes('.')) {
                        extension = fn.split('.').pop().toLowerCase();
                    }
                }
            } catch (e) {}

            // 3. Inspect adjacent cell text in grid row (filename is commonly in column 1)
            if (row && (!fileName || isGeneric(fileName))) {
                const candidates = row.querySelectorAll('.label, .pkp_helpers_align_left, a.show_extras, td.first_column a, td:first-child a');
                for (const el of candidates) {
                    if (el === linkElement) continue;
                    const text = el.textContent.trim();
                    if (text && !isGeneric(text)) {
                        fileName = text;
                        if (text.includes('.')) {
                            extension = text.split('.').pop().toLowerCase();
                        }
                        break;
                    }
                }

                // If not found in anchors, check column textual lines
                if (!fileName || isGeneric(fileName)) {
                    const firstCol = row.querySelector('td.first_column, td:first-child');
                    if (firstCol) {
                        const colText = firstCol.innerText || firstCol.textContent;
                        const lines = colText.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
                        for (const line of lines) {
                            if (!isGeneric(line) && line.includes('.')) {
                                fileName = line;
                                extension = line.split('.').pop().toLowerCase();
                                break;
                            }
                        }
                    }
                }
            }

            // 4. Check link title or link text
            if (!fileName || isGeneric(fileName)) {
                const linkTitle = linkElement.getAttribute('title');
                if (linkTitle && !isGeneric(linkTitle)) {
                    fileName = linkTitle.trim();
                    if (linkTitle.includes('.')) {
                        extension = linkTitle.split('.').pop().toLowerCase();
                    }
                }
            }

            // 5. Construct fallback name if extension is known
            if (extension && (!fileName || isGeneric(fileName))) {
                fileName = `Document.${extension}`;
            }

            if (!fileName || isGeneric(fileName)) {
                fileName = extension ? `Document.${extension}` : 'Document Preview';
            }

            return { fileName, extension };
        }

        scanAndInjectButtons() {
            // Find all file download links in OJS workflow grids and tables
            const fileLinks = document.querySelectorAll(
                'a[href*="downloadFile"], a[href*="download-file"], a.download[href*="files"], a[href*="/files/"][href*="/download"], a[href*="submissionFileId"]'
            );

            fileLinks.forEach((link) => {
                // GUARD: Strictly ignore links inside the preview modal or marked internal
                if (link.closest('#edp-previewer-overlay') || link.closest('.edp-modal-dialog') || link.closest('#edp-docx-notice-overlay')) return;
                if (link.dataset.edpInternal || link.classList.contains('edp-ignore-link')) return;

                if (link.dataset.edpBound) return;
                link.dataset.edpBound = 'true';

                const meta = this.detectFileMetadata(link);
                const fileUrl = link.href;

                // Create Quick Preview button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'edp-preview-trigger';
                btn.setAttribute('title', `${this.t('previewButton', 'Preview')} ${meta.fileName}`);

                // Bind target file data directly to the button dataset to avoid cross-talk
                btn.dataset.targetFileName = meta.fileName;
                btn.dataset.targetFileExt = meta.extension;
                btn.dataset.targetFileUrl = fileUrl;

                btn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    <span>${this.t('previewButton', 'Preview')}</span>
                `;

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();

                    const fileName = btn.dataset.targetFileName;
                    const ext = (btn.dataset.targetFileExt || '').toLowerCase();
                    const fileUrl = btn.dataset.targetFileUrl;

                    // If file is DOCX, check if user already dismissed fidelity notice
                    if ((ext === 'docx' || ext === 'doc') && localStorage.getItem('edp_docx_notice_dismissed') !== 'true') {
                        this.showDocxNotice(fileName, ext, fileUrl);
                    } else {
                        this.open(fileName, ext, fileUrl);
                    }
                });

                // Insert button BEFORE the link so it is never pushed off by text-overflow ellipsis
                link.parentNode.insertBefore(btn, link);
            });
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

        open(initialFileName, initialExt, fileUrl) {
            this.cleanupBlob();

            this.currentFileName = initialFileName || 'Document Preview';
            this.currentFileType = (initialExt || '').toLowerCase();
            this.currentFileUrl = fileUrl;
            this.currentScale = 1.0;

            this.modalTitle.textContent = this.currentFileName;
            this.btnDownload.href = this.currentFileUrl;
            this.bannerBtnDownload.href = this.currentFileUrl;
            this.updateFormatBadge(this.currentFileType);

            // Lock background body scrolling so OJS layer panels do not scroll or close
            document.body.classList.add('edp-lock-scroll');

            // Open overlay
            this.modal.classList.add('edp-active');

            // Reset controls and display loading state
            this.viewerControls.style.display = 'none';
            this.viewerControls.innerHTML = '';
            this.btnPrint.style.display = 'none';
            this.btnNewTab.style.display = 'none';
            this.docxBanner.style.display = 'none';

            this.modalBody.innerHTML = `
                <div class="edp-loading-indicator">
                    <div class="edp-spinner"></div>
                    <span>${this.t('loading', 'Loading document preview...')}</span>
                </div>
            `;

            // Stream document binary directly from authorized OJS download URL
            fetch(this.currentFileUrl, { credentials: 'same-origin' })
                .then((response) => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }

                    // Inspect response headers to resolve filename and exact MIME type
                    const contentType = (response.headers.get('content-type') || '').toLowerCase();
                    const contentDisp = response.headers.get('content-disposition') || '';

                    // 1. Resolve true filename from Content-Disposition header if available
                    let headerFileName = null;
                    const utf8Match = contentDisp.match(/filename\*=UTF-8''([^;]+)/i);
                    if (utf8Match) {
                        headerFileName = decodeURIComponent(utf8Match[1]);
                    } else {
                        const fnMatch = contentDisp.match(/filename=["']?([^"';]+)["']?/i);
                        if (fnMatch) {
                            headerFileName = fnMatch[1];
                        }
                    }

                    if (headerFileName && (!this.currentFileName || !this.currentFileName.includes('.') || this.currentFileName === 'Document Preview')) {
                        this.currentFileName = headerFileName;
                        this.modalTitle.textContent = headerFileName;
                        const hExt = (headerFileName.split('.').pop() || '').toLowerCase();
                        if (hExt && hExt.length <= 5) {
                            this.currentFileType = hExt;
                        }
                    }

                    // 2. Refine file extension from Content-Type if unknown
                    if (!this.currentFileType || this.currentFileType.length > 5 || this.currentFileType === 'preview') {
                        if (contentType.includes('pdf')) {
                            this.currentFileType = 'pdf';
                        } else if (contentType.includes('wordprocessingml') || contentType.includes('msword')) {
                            this.currentFileType = 'docx';
                        } else if (contentType.includes('image/png')) {
                            this.currentFileType = 'png';
                        } else if (contentType.includes('image/jpeg')) {
                            this.currentFileType = 'jpg';
                        } else if (contentType.includes('image/webp')) {
                            this.currentFileType = 'webp';
                        } else if (contentType.includes('image/gif')) {
                            this.currentFileType = 'gif';
                        } else if (contentType.includes('image/svg')) {
                            this.currentFileType = 'svg';
                        } else if (contentType.includes('spreadsheetml') || contentType.includes('excel') || contentType.includes('csv')) {
                            this.currentFileType = 'xlsx';
                        }
                    }

                    this.updateFormatBadge(this.currentFileType);

                    // 3. Delegate to appropriate rendering engine
                    if (this.currentFileType === 'docx' || this.currentFileType === 'doc') {
                        return response.arrayBuffer().then((buffer) => this.renderDocxBuffer(buffer));
                    } else if (this.currentFileType === 'pdf') {
                        return response.blob().then((blob) => this.renderPdfBlob(blob));
                    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(this.currentFileType)) {
                        return response.blob().then((blob) => this.renderImageBlob(blob));
                    } else {
                        this.renderUnsupported(this.currentFileType);
                    }
                })
                .catch((err) => {
                    this.renderError('Failed to load document preview', err.message);
                });
        }

        updateFormatBadge(ext) {
            if (!ext || ext.length > 5) {
                this.formatBadge.style.display = 'none';
                return;
            }

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

        /* -----------------------------------------------------------------
           DOCX RENDERING ENGINE (100% Client-Side via docx-preview)
           ----------------------------------------------------------------- */
        renderDocxBuffer(arrayBuffer) {
            if (typeof window.docx === 'undefined' || !window.docx.renderAsync) {
                this.renderError(
                    'DOCX engine error',
                    'The Word rendering engine (docx-preview) could not be loaded.'
                );
                return;
            }

            // Display DOCX top info banner and print button
            this.docxBanner.style.display = 'flex';
            this.btnPrint.style.display = 'inline-flex';

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
                ignoreLastRenderedPageBreak: false,
                experimental: true,
                trimXmlDeclaration: true,
                renderHeaders: true,
                renderFooters: true,
                renderFootnotes: true,
                renderEndnotes: true,
            }).then(() => {
                const pages = contentContainer.querySelectorAll('section.docx');
                const pageCount = pages.length;
                pages.forEach((page, idx) => {
                    page.setAttribute('data-page-number', idx + 1);
                });
                this.setupDocxControls(contentContainer, pageCount);
            }).catch((err) => {
                this.renderError('Unable to render DOCX preview', err.message);
            });
        }

        setupDocxControls(container, pageCount) {
            this.viewerControls.style.display = 'inline-flex';
            const pageBadge = pageCount > 1
                ? `<span class="edp-page-count-badge" id="edp-docx-page-count">${pageCount} ${this.t('pages', 'Pages')}</span>`
                : '';

            this.viewerControls.innerHTML = `
                <button type="button" class="edp-ctrl-btn" id="edp-docx-zoom-out" title="${this.t('zoomOut', 'Zoom Out')}">-</button>
                <span class="edp-zoom-level" id="edp-docx-zoom-label">100%</span>
                <button type="button" class="edp-ctrl-btn" id="edp-docx-zoom-in" title="${this.t('zoomIn', 'Zoom In')}">+</button>
                <button type="button" class="edp-ctrl-btn" id="edp-docx-fit" title="${this.t('fitWidth', 'Fit Width')}">Fit</button>
                ${pageBadge}
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

            zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(this.currentScale + 0.1);
            });
            zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(this.currentScale - 0.1);
            });
            fitBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const firstPage = container.querySelector('section.docx');
                if (firstPage && this.modalBody) {
                    const availableWidth = this.modalBody.clientWidth - 48;
                    const pageWidth = firstPage.offsetWidth || 816;
                    if (pageWidth > 0 && availableWidth > 0) {
                        const fitScale = Math.min(Math.max(availableWidth / pageWidth, 0.4), 1.5);
                        applyZoom(Math.round(fitScale * 10) / 10);
                        return;
                    }
                }
                applyZoom(1.0);
            });
        }

        printDocx() {
            const docxContent = document.getElementById('edp-docx-content');
            if (!docxContent) {
                window.print();
                return;
            }

            try {
                const existingFrame = document.getElementById('edp-print-frame');
                if (existingFrame && existingFrame.parentNode) {
                    existingFrame.parentNode.removeChild(existingFrame);
                }

                const iframe = document.createElement('iframe');
                iframe.id = 'edp-print-frame';
                iframe.style.position = 'fixed';
                iframe.style.top = '-10000px';
                iframe.style.left = '-10000px';
                iframe.style.width = '1000px';
                iframe.style.height = '1000px';
                iframe.style.border = '0';
                document.body.appendChild(iframe);

                const frameDoc = iframe.contentWindow.document;
                const safeTitle = (this.currentFileName || 'Document').replace(/"/g, '&quot;');

                frameDoc.open();
                frameDoc.write(`<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>${safeTitle}</title>
    <style>
        @page {
            size: auto;
            margin: 10mm;
        }
        html, body {
            margin: 0;
            padding: 0;
            background: #ffffff;
            color: #000000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            overflow: visible !important;
        }
        .docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
            margin: 0 !important;
            display: block !important;
        }
        section.docx {
            background: #ffffff !important;
            box-shadow: none !important;
            border: none !important;
            box-sizing: border-box !important;
            margin: 0 auto !important;
            page-break-after: always !important;
            break-after: page !important;
        }
        section.docx:last-of-type,
        section.docx:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
        }
        @media print {
            html, body {
                background: #ffffff !important;
            }
            section.docx {
                page-break-after: always !important;
                break-after: page !important;
            }
            section.docx:last-of-type,
            section.docx:last-child {
                page-break-after: avoid !important;
                break-after: avoid !important;
            }
        }
    </style>
</head>
<body>
    ${docxContent.innerHTML}
</body>
</html>`);
                frameDoc.close();

                setTimeout(() => {
                    try {
                        iframe.contentWindow.focus();
                        iframe.contentWindow.print();
                    } catch (err) {
                        console.warn('Iframe print error, falling back to window.print():', err);
                        window.print();
                    } finally {
                        setTimeout(() => {
                            if (iframe.parentNode) {
                                iframe.parentNode.removeChild(iframe);
                            }
                        }, 2000);
                    }
                }, 300);
            } catch (e) {
                console.warn('Iframe creation failed, fallback to window.print():', e);
                window.print();
            }
        }

        /* -----------------------------------------------------------------
           PDF RENDERING ENGINE (In-Browser Native Embed via Blob URL)
           ----------------------------------------------------------------- */
        renderPdfBlob(blob) {
            const pdfBlob = new Blob([blob], { type: 'application/pdf' });
            this.currentBlobUrl = URL.createObjectURL(pdfBlob);

            this.btnNewTab.href = this.currentBlobUrl;
            this.btnNewTab.style.display = 'inline-flex';

            this.modalBody.innerHTML = `
                <iframe class="edp-viewport-pdf" src="${this.currentBlobUrl}#toolbar=1&navpanes=1" title="${this.currentFileName}"></iframe>
            `;
        }

        /* -----------------------------------------------------------------
           IMAGE RENDERING ENGINE (Client-Side Figures & Graphics via Blob URL)
           ----------------------------------------------------------------- */
        renderImageBlob(blob) {
            this.currentBlobUrl = URL.createObjectURL(blob);

            this.btnNewTab.href = this.currentBlobUrl;
            this.btnNewTab.style.display = 'inline-flex';

            this.modalBody.innerHTML = `
                <div class="edp-viewport-image-wrapper" id="edp-img-wrapper">
                    <img class="edp-viewport-image" id="edp-preview-img" src="${this.currentBlobUrl}" alt="${this.currentFileName}">
                    <div class="edp-image-meta-badge" id="edp-img-badge" style="display:none;"></div>
                </div>
            `;

            const img = document.getElementById('edp-preview-img');
            const badge = document.getElementById('edp-img-badge');

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
                <button type="button" class="edp-ctrl-btn" id="edp-img-reset" title="${this.t('resetZoom', 'Reset')}">Reset</button>
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

            zoomInBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(this.currentScale + 0.25);
            });
            zoomOutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(this.currentScale - 0.25);
            });
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(1.0);
            });

            // Click-to-zoom toggle
            img.addEventListener('click', (e) => {
                e.stopPropagation();
                applyZoom(this.currentScale === 1.0 ? 2.0 : 1.0);
            });
        }

        /* -----------------------------------------------------------------
           FALLBACK AND ERROR VIEWS
           ----------------------------------------------------------------- */
        renderUnsupported(ext) {
            const displayExt = ext ? `.${ext.toUpperCase()} ` : '';
            this.modalBody.innerHTML = `
                <div class="edp-fallback-card">
                    <svg class="edp-fallback-icon" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                    </svg>
                    <h4 class="edp-fallback-title">${displayExt}${this.t('previewTitle', 'Document Preview')}</h4>
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
                    <svg class="edp-fallback-icon" style="color: #dc2626;" viewBox="0 0 24 24" fill="currentColor">
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
            this.cleanupBlob();
            this.modal.classList.remove('edp-active');
            if (this.isFullscreen) {
                this.toggleFullscreen();
            }

            // Restore body scroll
            document.body.classList.remove('edp-lock-scroll');

            this.modalBody.innerHTML = '';
            this.viewerControls.style.display = 'none';
            this.viewerControls.innerHTML = '';
            this.btnPrint.style.display = 'none';
            this.btnNewTab.style.display = 'none';
            this.docxBanner.style.display = 'none';
            this.formatBadge.style.display = 'none';
        }
    }

    new EditorialDocumentPreviewer();
})();
