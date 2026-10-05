<?php

/**
 * @file plugins/generic/editorialDocumentPreviewer/EditorialDocumentPreviewerPlugin.php
 *
 * Copyright (c) 2026 Dhimas Rizky H / JRTN
 * Distributed under the GNU GPL v3. For full terms see the file LICENSE.
 *
 * @class EditorialDocumentPreviewerPlugin
 * @ingroup plugins_generic_editorialDocumentPreviewer
 *
 * @brief Enables instant in-browser modal document previews across all editorial stages.
 */

namespace APP\plugins\generic\editorialDocumentPreviewer;

use APP\core\Application;
use PKP\config\Config;
use PKP\core\PKPApplication;
use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;
use PKP\security\Role;
use PKP\security\Validation;

class EditorialDocumentPreviewerPlugin extends GenericPlugin
{
    /**
     * Register the plugin
     */
    public function register($category, $path, $mainContextId = null): bool
    {
        $success = parent::register($category, $path, $mainContextId);
        if ($success && $this->getEnabled($mainContextId)) {
            // Hook into template display to inject JS and CSS on backend workflow pages
            Hook::add('TemplateManager::display', [$this, 'handleTemplateDisplay']);

            // Register backend page handler for secure inline file streaming
            Hook::add('LoadHandler', [$this, 'handleLoadHandler']);
        }

        return $success;
    }

    /**
     * Provide localized plugin display name
     */
    public function getDisplayName(): string
    {
        return __('plugins.generic.editorialDocumentPreviewer.name');
    }

    /**
     * Provide localized plugin description
     */
    public function getDescription(): string
    {
        return __('plugins.generic.editorialDocumentPreviewer.description');
    }

    /**
     * Hook callback: inject assets on editorial dashboard and workflow views
     */
    public function handleTemplateDisplay(string $hookName, array $args): bool
    {
        $templateMgr = $args[0];

        $request = Application::get()->getRequest();
        $page = $request->getRequestedPage();

        // Inject assets on workflow, dashboard, and editorial review pages
        if (in_array($page, ['workflow', 'dashboard', 'submissions', 'authorDashboard', 'reviewer'])) {
            $baseUrl = $request->getBaseUrl() . '/' . $this->getPluginPath();
            $dispatcher = $request->getDispatcher();

            // Construct secure inline streaming endpoint URL
            $streamEndpointUrl = $dispatcher->url(
                $request,
                PKPApplication::ROUTE_PAGE,
                null,
                'editorialPreview',
                'stream'
            );

            // 1. Inject runtime configuration with localized UI strings
            $configPayload = [
                'streamUrl' => $streamEndpointUrl,
                'pluginPath' => $baseUrl,
                'locale' => [
                    'previewButton' => __('plugins.generic.editorialDocumentPreviewer.previewButton'),
                    'previewTitle' => __('plugins.generic.editorialDocumentPreviewer.previewTitle'),
                    'downloadFile' => __('plugins.generic.editorialDocumentPreviewer.downloadFile'),
                    'closePreview' => __('plugins.generic.editorialDocumentPreviewer.closePreview'),
                    'loading' => __('plugins.generic.editorialDocumentPreviewer.loading'),
                    'unsupportedFormat' => __('plugins.generic.editorialDocumentPreviewer.unsupportedFormat'),
                    'unauthorized' => __('plugins.generic.editorialDocumentPreviewer.unauthorized'),
                    'openInNewTab' => __('plugins.generic.editorialDocumentPreviewer.openInNewTab'),
                    'zoomIn' => __('plugins.generic.editorialDocumentPreviewer.zoomIn'),
                    'zoomOut' => __('plugins.generic.editorialDocumentPreviewer.zoomOut'),
                    'resetZoom' => __('plugins.generic.editorialDocumentPreviewer.resetZoom'),
                    'fitWidth' => __('plugins.generic.editorialDocumentPreviewer.fitWidth'),
                    'fullScreen' => __('plugins.generic.editorialDocumentPreviewer.fullScreen'),
                    'exitFullScreen' => __('plugins.generic.editorialDocumentPreviewer.exitFullScreen'),
                ],
            ];

            $templateMgr->addJavaScript(
                'editorialDocumentPreviewerConfig',
                'window.edpConfig = ' . json_encode($configPayload) . ';',
                [
                    'inline' => true,
                    'contexts' => ['backend'],
                ]
            );

            // 2. Inject client-side vendor libraries (JSZip + docx-preview)
            $templateMgr->addJavaScript(
                'edpJszip',
                $baseUrl . '/js/vendor/jszip.min.js',
                ['contexts' => ['backend']]
            );

            $templateMgr->addJavaScript(
                'edpDocxPreview',
                $baseUrl . '/js/vendor/docx-preview.min.js',
                ['contexts' => ['backend']]
            );

            // 3. Inject CSS stylesheet
            $templateMgr->addStyleSheet(
                'editorialDocumentPreviewerCss',
                $baseUrl . '/css/editorial-document-previewer.css',
                ['contexts' => ['backend']]
            );

            // 4. Inject main previewer JavaScript controller
            $templateMgr->addJavaScript(
                'editorialDocumentPreviewerJs',
                $baseUrl . '/js/editorial-document-previewer.js',
                ['contexts' => ['backend']]
            );
        }

        return false;
    }

    /**
     * Hook callback: handle inline file streaming request
     */
    public function handleLoadHandler(string $hookName, array $args): bool
    {
        $page = $args[0];
        $op = $args[1];

        if ($page === 'editorialPreview' && $op === 'stream') {
            $this->streamFileInline();
            return true;
        }

        return false;
    }

    /**
     * Stream requested submission file with Content-Disposition: inline
     */
    protected function streamFileInline(): void
    {
        $request = Application::get()->getRequest();
        $user = $request->getUser();

        // 1. Authentication check
        if (!$user) {
            $this->sendHttpError(403, __('plugins.generic.editorialDocumentPreviewer.unauthorized'));
        }

        $submissionId = (int) $request->getUserVar('submissionId');
        $submissionFileId = (int) ($request->getUserVar('fileId') ?: $request->getUserVar('submissionFileId'));

        if (!$submissionId || !$submissionFileId) {
            $this->sendHttpError(400, 'Invalid submission or file parameters.');
        }

        // 2. Authorization check (User must have verified editorial access to the submission)
        if (!$this->isAuthorizedForSubmission($user, $submissionId, $submissionFileId)) {
            $this->sendHttpError(403, __('plugins.generic.editorialDocumentPreviewer.unauthorized'));
        }

        // 3. Retrieve submission file entity
        $submissionFile = $this->getSubmissionFile($submissionFileId);
        if (!$submissionFile) {
            $this->sendHttpError(404, 'Requested document was not found.');
        }

        // Verify file belongs strictly to the requested submission (IDOR protection)
        if ((int) $submissionFile->getData('submissionId') !== $submissionId) {
            $this->sendHttpError(403, __('plugins.generic.editorialDocumentPreviewer.unauthorized'));
        }

        // 4. Resolve filename and mime type
        $filename = $submissionFile->getLocalizedData('name')
            ?: $submissionFile->getData('name')
            ?: ('submission-' . $submissionId . '-file-' . $submissionFileId);

        $mimetype = $submissionFile->getData('mimetype');
        if (!$mimetype && method_exists($submissionFile, 'getFileType')) {
            $mimetype = $submissionFile->getFileType();
        }

        if (!$mimetype) {
            $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
            $mimetypes = [
                'pdf' => 'application/pdf',
                'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'doc' => 'application/msword',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'xls' => 'application/vnd.ms-excel',
                'png' => 'image/png',
                'jpg' => 'image/jpeg',
                'jpeg' => 'image/jpeg',
                'webp' => 'image/webp',
                'gif' => 'image/gif',
                'svg' => 'image/svg+xml',
            ];
            $mimetype = $mimetypes[$extension] ?? 'application/octet-stream';
        }

        // 5. Open file stream via Flysystem file service or physical disk path
        $stream = null;
        $fileSize = 0;
        $filePath = $submissionFile->getData('path');

        if (class_exists('\APP\core\Services') && \APP\core\Services::has('file')) {
            $fileService = \APP\core\Services::get('file');
            if ($filePath && isset($fileService->fs) && $fileService->fs->has($filePath)) {
                $stream = $fileService->fs->readStream($filePath);
                $fileSize = (int) $fileService->fs->getSize($filePath);
            }
        }

        if (!$stream && $filePath) {
            $filesDir = Config::getVar('files', 'files_dir');
            $fullPath = rtrim($filesDir, '/\\') . DIRECTORY_SEPARATOR . $filePath;
            if (file_exists($fullPath) && is_readable($fullPath)) {
                $stream = fopen($fullPath, 'rb');
                $fileSize = (int) filesize($fullPath);
            }
        }

        if (!$stream && method_exists($submissionFile, 'getFilePath')) {
            $fullPath = $submissionFile->getFilePath();
            if ($fullPath && file_exists($fullPath) && is_readable($fullPath)) {
                $stream = fopen($fullPath, 'rb');
                $fileSize = (int) filesize($fullPath);
            }
        }

        if (!$stream) {
            $this->sendHttpError(404, 'File storage stream could not be established.');
        }

        // 6. Deliver file with Content-Disposition: inline
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        header('Content-Type: ' . $mimetype);
        header('Content-Disposition: inline; filename="' . rawurlencode($filename) . '"; filename*=UTF-8\'\'' . rawurlencode($filename));
        if ($fileSize > 0) {
            header('Content-Length: ' . $fileSize);
        }
        header('Cache-Control: private, no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
        header('X-Content-Type-Options: nosniff');

        if (is_resource($stream)) {
            fpassthru($stream);
            fclose($stream);
        }

        exit;
    }

    /**
     * Check if user is authorized to preview submission files
     */
    protected function isAuthorizedForSubmission($user, int $submissionId, ?int $fileId = null): bool
    {
        if (!$user) {
            return false;
        }

        // 1. Site Admin has system-wide access
        if (Validation::isSiteAdmin()) {
            return true;
        }

        $userId = (int) $user->getId();
        $request = Application::get()->getRequest();
        $context = $request->getContext();
        $contextId = $context ? (int) $context->getId() : 0;

        // 2. Retrieve submission and ensure journal context integrity
        $submission = $this->getSubmission($submissionId);
        if (!$submission) {
            return false;
        }

        if ($contextId && (int) $submission->getData('contextId') !== $contextId) {
            return false;
        }

        // 3. Verify file entity belongs to this submission if fileId provided
        if ($fileId) {
            $submissionFile = $this->getSubmissionFile($fileId);
            if (!$submissionFile || (int) $submissionFile->getData('submissionId') !== $submissionId) {
                return false;
            }
        }

        // 4. Journal Managers have access to all submissions in their journal
        $userGroupDao = \PKP\db\DAORegistry::getDAO('UserGroupDAO');
        if ($userGroupDao && method_exists($userGroupDao, 'getByUserId')) {
            $userGroups = $userGroupDao->getByUserId($userId, $contextId);
            while ($userGroup = $userGroups->next()) {
                if ((int) $userGroup->getRoleId() === Role::ROLE_ID_MANAGER) {
                    return true;
                }
            }
        }

        // 5. Check if user is assigned as Sub-Editor, Section Editor, or Assistant
        if (class_exists('APP\facades\Repo') && method_exists(\APP\facades\Repo::class, 'stageAssignment')) {
            $assignedCount = \APP\facades\Repo::stageAssignment()
                ->getCollector()
                ->filterBySubmissionIds([$submissionId])
                ->filterByUserId($userId)
                ->getCount();
            if ($assignedCount > 0) {
                return true;
            }
        } else {
            $stageAssignmentDao = \PKP\db\DAORegistry::getDAO('StageAssignmentDAO');
            if ($stageAssignmentDao && method_exists($stageAssignmentDao, 'getBySubmissionAndStageId')) {
                $assignments = $stageAssignmentDao->getBySubmissionAndStageId($submissionId, null, null, $userId);
                if ($assignments && $assignments->getCount() > 0) {
                    return true;
                }
            }
        }

        // 6. Check if user is an assigned Reviewer on this submission
        if (class_exists('APP\facades\Repo') && method_exists(\APP\facades\Repo::class, 'reviewAssignment')) {
            $reviewCount = \APP\facades\Repo::reviewAssignment()
                ->getCollector()
                ->filterBySubmissionIds([$submissionId])
                ->filterByReviewerId($userId)
                ->getCount();
            if ($reviewCount > 0) {
                return true;
            }
        } else {
            $reviewAssignmentDao = \PKP\db\DAORegistry::getDAO('ReviewAssignmentDAO');
            if ($reviewAssignmentDao && method_exists($reviewAssignmentDao, 'getBySubmissionId')) {
                $reviewAssignments = $reviewAssignmentDao->getBySubmissionId($submissionId);
                foreach ($reviewAssignments as $assignment) {
                    if ((int) $assignment->getReviewerId() === $userId) {
                        return true;
                    }
                }
            }
        }

        // 7. Check if user is the Submitter / Author of this submission
        $submitterId = (int) $submission->getData('userId');
        if ($submitterId && $submitterId === $userId) {
            return true;
        }

        return false;
    }

    /**
     * Retrieve Submission entity across OJS 3.5, 3.4, and 3.3
     */
    protected function getSubmission(int $submissionId)
    {
        if (class_exists('APP\facades\Repo')) {
            return \APP\facades\Repo::submission()->get($submissionId);
        } elseif (class_exists('PKP\facades\Repo')) {
            return \PKP\facades\Repo::submission()->get($submissionId);
        } else {
            $submissionDao = \PKP\db\DAORegistry::getDAO('SubmissionDAO');
            if ($submissionDao) {
                return $submissionDao->getById($submissionId);
            }
        }

        return null;
    }

    /**
     * Retrieve SubmissionFile entity across OJS 3.5, 3.4, and 3.3
     */
    protected function getSubmissionFile(int $fileId)
    {
        if (class_exists('APP\facades\Repo')) {
            return \APP\facades\Repo::submissionFile()->get($fileId);
        } elseif (class_exists('PKP\facades\Repo')) {
            return \PKP\facades\Repo::submissionFile()->get($fileId);
        } else {
            $submissionFileDao = \PKP\db\DAORegistry::getDAO('SubmissionFileDAO');
            if ($submissionFileDao) {
                if (method_exists($submissionFileDao, 'getLatestRevision')) {
                    return $submissionFileDao->getLatestRevision($fileId);
                } elseif (method_exists($submissionFileDao, 'getRevision')) {
                    return $submissionFileDao->getRevision($fileId);
                }
            }
        }

        return null;
    }

    /**
     * Send standard JSON error response and exit
     */
    protected function sendHttpError(int $statusCode, string $message): void
    {
        while (ob_get_level() > 0) {
            ob_end_clean();
        }

        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode([
            'status' => 'error',
            'code' => $statusCode,
            'message' => $message,
        ]);
        exit;
    }
}
