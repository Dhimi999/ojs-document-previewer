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

use PKP\plugins\GenericPlugin;
use PKP\plugins\Hook;
use PKP\core\PKPApplication;
use PKP\template\PKPTemplateManager;
use PKP\core\JSONMessage;
use PKP\security\Validation;
use PKP\security\Role;
use APP\core\Application;

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
        $template = $args[1];

        // Inject only on backend workflow and dashboard views
        $request = Application::get()->getRequest();
        $page = $request->getRequestedPage();

        if (in_array($page, ['workflow', 'dashboard', 'submissions'])) {
            $baseUrl = $request->getBaseUrl() . '/' . $this->getPluginPath();

            // Inject CSS stylesheet
            $templateMgr->addStyleSheet(
                'editorialDocumentPreviewerCss',
                $baseUrl . '/css/editorial-document-previewer.css',
                ['contexts' => ['backend']]
            );

            // Inject JavaScript client logic
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
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['error' => __('plugins.generic.editorialDocumentPreviewer.unauthorized')]);
            exit;
        }

        $submissionId = (int) $request->getUserVar('submissionId');
        $submissionFileId = (int) $request->getUserVar('fileId');

        if (!$submissionId || !$submissionFileId) {
            header('HTTP/1.1 400 Bad Request');
            echo json_encode(['error' => 'Invalid parameters']);
            exit;
        }

        // 2. Authorization check (User must have editorial access to the submission)
        if (!$this->isAuthorizedForSubmission($user, $submissionId)) {
            header('HTTP/1.1 403 Forbidden');
            echo json_encode(['error' => __('plugins.generic.editorialDocumentPreviewer.unauthorized')]);
            exit;
        }

        // 3. Delegate to PKP submission file stream service with inline disposition
        // Implementation will fetch submission file entity and output with Content-Disposition: inline
        // to be expanded in Phase 2
    }

    /**
     * Check if user is authorized to view submission files
     */
    protected function isAuthorizedForSubmission($user, int $submissionId): bool
    {
        if (Validation::isSiteAdmin()) {
            return true;
        }

        $userId = $user->getId();
        $context = Application::get()->getRequest()->getContext();
        $contextId = $context ? $context->getId() : 0;

        // Check if user is a Journal Manager, Editor, or Section Editor
        $userGroupDao = \PKP\db\DAORegistry::getDAO('UserGroupDAO');
        $userGroups = $userGroupDao->getByUserId($userId, $contextId);

        while ($userGroup = $userGroups->next()) {
            if (in_array($userGroup->getRoleId(), [Role::ROLE_ID_MANAGER, Role::ROLE_ID_SUB_EDITOR])) {
                return true;
            }
        }

        return false;
    }
}
