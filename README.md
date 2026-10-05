# Editorial Document Previewer

An Open Journal Systems (OJS) generic plugin that enables instant in-browser modal previews for submitted documents, manuscripts, and supplementary files across all editorial workflow stages without requiring manual downloads.

---

## Overview

In the standard OJS editorial workflow, files uploaded by authors, reviewers, and editors (such as `.docx`, `.pdf`, `.xlsx`, and images) are delivered with HTTP `Content-Disposition: attachment` headers. Consequently, editors and section reviewers are forced to download every file to their local machine before inspecting it. Over an editorial term, this clutters local download directories, leads to version confusion between revisions, and slows down initial desk evaluation.

**Editorial Document Previewer** integrates a lightweight, responsive document previewer directly into the OJS dashboard across all editorial stages:
1. **Submission Stage**: Initial author submissions, title pages, cover letters, and supplementary files.
2. **Review Stage**: Blinded manuscripts, review attachments, and reviewer forms.
3. **Copyediting Stage**: Draft files, copyedited files, and author queries.
4. **Production Stage**: Production-ready files, galleys, and proofreading files.

---

## Key Features

- **Multi-Stage Workflow Coverage**: Hooks into file lists across Submission, Review, Copyediting, and Production stages.
- **Multi-Format In-Browser Rendering**:
  - **Microsoft Word (`.docx`)**: Client-side rendering preserving document formatting, tables, headings, and images.
  - **PDF Documents (`.pdf`)**: Native browser embed with zoom, page navigation, and text search.
  - **Graphics & Figures (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`)**: High-resolution image view with pan and fit controls.
  - **Spreadsheets (`.xlsx`, `.xls`, `.csv`)**: Tabular data preview for supplementary data sets.
- **Privacy & Ethical Integrity**: All document rendering executes entirely within the user's browser runtime. Files are never transmitted to external third-party rendering clouds (e.g., Google Docs Viewer or Office Online), ensuring full compliance with double-blind review protocols and unpublished manuscript confidentiality.
- **Non-Destructive Access**: The native download option remains available via a dedicated button inside the preview toolbar.
- **Role-Based Authorization**: Respects OJS permissions—only authenticated users with legitimate editorial access to a submission can stream preview content.

---

## System Requirements

- **Application**: Open Journal Systems (OJS) 3.3.0+, 3.4.0+, or 3.5.0+
- **PHP**: 8.0, 8.1, 8.2, or 8.3
- **Modern Web Browser**: Chrome, Firefox, Edge, Safari (supporting ES6+ and modern CSS flexbox/grid)

---

## Installation

### Method 1: Upload via Plugin Gallery (Recommended once published)
1. Log in as Journal Manager or Site Administrator.
2. Navigate to **Settings > Website > Plugins > Plugin Gallery**.
3. Locate **Editorial Document Previewer** and click **Install**.

### Method 2: Manual Installation from Release Archive
1. Download the latest `editorialDocumentPreviewer-vX.X.X.tar.gz` release package.
2. In OJS, navigate to **Settings > Website > Plugins > Installed Plugins**.
3. Under the **Upload A New Plugin** section, upload the `.tar.gz` archive.
4. Enable the plugin under the **Generic Plugins** category.

### Method 3: Direct Git Checkout
Clone this repository into your OJS plugins directory:
```bash
cd /path/to/ojs/plugins/generic
git clone https://github.com/Dhimi999/ojs-editorial-document-previewer.git editorialDocumentPreviewer
```

---

## Usage

1. Open any submission in the OJS Editorial Dashboard (`Workflow`).
2. In any file list (e.g., *Submission Files*, *Review Files*, *Copyedited Files*), click the **Preview** icon next to the file name.
3. The preview modal will display the document contents immediately.
4. Use the toolbar to zoom, toggle full screen, or download the original file if editing is needed.

---

## Contributing

Contributions, bug reports, and suggestions are welcome. Please open an issue or pull request on GitHub.

---

## License

This project is licensed under the terms of the **GNU General Public License v3.0** (GPL-3.0). See the [LICENSE](LICENSE) file for full details.
