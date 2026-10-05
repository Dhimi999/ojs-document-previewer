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
            this.modal = null;
            this.modalTitle = null;
            this.modalBody = null;
            this.downloadBtn = null;
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

        createModal() {
            if (document.getElementById('edp-previewer-overlay')) return;

            const overlay = document.createElement('div');
            overlay.id = 'edp-previewer-overlay';
            overlay.className = 'edp-modal-overlay';
            overlay.innerHTML = `
                <div class="edp-modal-dialog" role="dialog" aria-modal="true">
                    <div class="edp-modal-header">
                        <div class="edp-modal-title-group">
                            <svg class="edp-modal-file-icon" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                            </svg>
                            <h3 id="edp-modal-title" class="edp-modal-title">Document Preview</h3>
                        </div>
                        <div class="edp-modal-actions">
                            <a id="edp-btn-download" href="#" class="edp-btn edp-btn-download" target="_blank" rel="noopener">Download</a>
                            <button id="edp-btn-close" type="button" class="edp-btn edp-btn-close">Close</button>
                        </div>
                    </div>
                    <div id="edp-modal-body" class="edp-modal-body">
                        <div class="edp-loading-indicator">
                            <div class="edp-spinner"></div>
                            <span>Loading preview...</span>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            this.modal = overlay;
            this.modalTitle = overlay.querySelector('#edp-modal-title');
            this.modalBody = overlay.querySelector('#edp-modal-body');
            this.downloadBtn = overlay.querySelector('#edp-btn-download');

            // Close bindings
            overlay.querySelector('#edp-btn-close').addEventListener('click', () => this.close());
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.close();
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.modal.classList.contains('edp-active')) {
                    this.close();
                }
            });
        }

        scanAndInjectButtons() {
            // Find all file links in OJS workflow grids (Submission, Review, Copyediting, Production)
            const fileLinks = document.querySelectorAll(
                'a[href*="downloadFile"], a[href*="download-file"], a.download[href*="files"]'
            );

            fileLinks.forEach((link) => {
                if (link.dataset.edpBound) return;
                link.dataset.edpBound = 'true';

                const fileName = link.textContent.trim();
                const fileUrl = link.href;

                // Create Quick Preview button
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'edp-preview-trigger';
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                    <span>Preview</span>
                `;

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.open(fileName, fileUrl);
                });

                link.parentNode.insertBefore(btn, link.nextSibling);
            });
        }

        attachMutationObserver() {
            // Re-scan when OJS loads tabs or AJAX grids asynchronously
            const observer = new MutationObserver(() => {
                this.scanAndInjectButtons();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        }

        open(fileName, fileUrl) {
            this.modalTitle.textContent = fileName || 'Document Preview';
            this.downloadBtn.href = fileUrl;
            this.modal.classList.add('edp-active');

            const ext = (fileName.split('.').pop() || '').toLowerCase();
            this.renderContent(fileUrl, ext);
        }

        renderContent(fileUrl, ext) {
            this.modalBody.innerHTML = `
                <div class="edp-loading-indicator">
                    <div class="edp-spinner"></div>
                    <span>Loading ${ext.toUpperCase()} preview...</span>
                </div>
            `;

            if (ext === 'pdf') {
                this.modalBody.innerHTML = `<iframe class="edp-viewport-frame" src="${fileUrl}" title="PDF Preview"></iframe>`;
            } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
                this.modalBody.innerHTML = `<img class="edp-viewport-image" src="${fileUrl}" alt="Figure Preview">`;
            } else if (ext === 'docx') {
                // Client-side docx rendering placeholder (integrated in Phase 2)
                this.modalBody.innerHTML = `
                    <div class="edp-viewport-docx">
                        <div class="docx-wrapper">
                            <p style="color:#ffffff; text-align:center;">Preparing client-side Word rendering engine...</p>
                        </div>
                    </div>
                `;
            } else {
                this.modalBody.innerHTML = `
                    <div style="text-align:center; padding: 40px; color: #475569;">
                        <p style="font-size: 16px; font-weight: 600; margin-bottom: 8px;">Preview not directly available for .${ext} files</p>
                        <p style="font-size: 13px; color: #64748b; margin-bottom: 16px;">Please use the download button to open this document in your desktop software.</p>
                        <a href="${fileUrl}" class="edp-btn edp-btn-download" target="_blank" rel="noopener">Download Original File</a>
                    </div>
                `;
            }
        }

        close() {
            this.modal.classList.remove('edp-active');
            this.modalBody.innerHTML = '';
        }
    }

    new EditorialDocumentPreviewer();
})();
