/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-03-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class DocumentTemplateController {

    // ==================== Document Creation and Assignment Methods ====================

    /**
     * Creates a new single document based on the provided JSON input.
     * @param inputJson JSON string containing document details
     * @return DocumentItem containing the created document's details
     */
    @AuraEnabled
    public static DocumentItem createDocument(String inputJson) {
        System.debug('--- START createDocument ---');
        System.debug('Serialized Input JSON: ' + inputJson);

        try {
            // Deserialize input
            DocumentInputWrapper input = (DocumentInputWrapper) JSON.deserialize(inputJson, DocumentInputWrapper.class);
            System.debug('Deserialized Input: ' + JSON.serialize(input));

            if (input == null || input.categoryId == null || String.isBlank(input.name)) {
                throw new AuraHandledException('CategoryId and name are required.');
            }

            // Create the Document__c record
            Document__c doc = new Document__c(
                Name = input.name,
                Category__c = input.categoryId,
                Status__c = input.status,
                Team__c = input.team,
                Type__c = input.type,
                Assigned_To__c = input.assignedToId
            );
            insert doc;
            System.debug('Inserted Document: ' + doc.Id);

            // Create the Document_Assignment__c junction record
            if (input.objectName == 'Lead' || input.objectName == 'Opportunity') {
                Document_Assignment__c assignment = new Document_Assignment__c();
                assignment.Document__c = doc.Id;

                if (input.objectName == 'Lead') {
                    assignment.Lead__c = input.relatedTo;
                    System.debug('Assigned to Lead: ' + input.assignedToId);
                } else if (input.objectName == 'Opportunity') {
                    assignment.Loan__c = input.relatedTo;
                    System.debug('Assigned to Loan: ' + input.assignedToId);
                }

                insert assignment;
                System.debug('Inserted Assignment: ' + assignment.Id);
            } else {
                throw new AuraHandledException('Invalid objectName. Must be "Lead" or "Loan".');
            }

            // Return enriched DocumentItem
            Document__c fullDoc = [
                SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c,
                       Category__r.Name
                FROM Document__c
                WHERE Id = :doc.Id LIMIT 1
            ];

            DocumentItem item = new DocumentItem();
            item.id = fullDoc.Id;
            item.name = fullDoc.Name;
            item.categoryId = fullDoc.Category__c;
            item.status = fullDoc.Status__c;
            item.team = fullDoc.Team__c;
            item.assignedTo = String.valueOf(fullDoc.Assigned_To__c);
            item.ownerId = fullDoc.OwnerId;
            item.templateId = fullDoc.Document_Template__c;
            item.categoryName = fullDoc.Category__r != null ? fullDoc.Category__r.Name : null;

            return item;

        } catch (Exception e) {
            System.debug('ERROR in createDocument: ' + e.getMessage());
            throw new AuraHandledException('Failed to create document: ' + e.getMessage());
        } finally {
            System.debug('--- END createDocument ---');
        }
    }

    /**
     * Assigns a document to a specific record (Lead or Opportunity).
     * @param documentId The ID of the document to assign
     * @param recordId The ID of the record to assign the document to
     * @param objectName The object type ('Lead' or 'Opportunity')
     * @return DocumentItem containing the assigned document's details
     */
    @AuraEnabled
    public static DocumentItem assignDocumentToRecord(Id documentId, Id recordId, String objectName) {
        if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
            throw new AuraHandledException('Missing required parameters.');
        }

        // Check if this document is already assigned to this record ID (Lead or Loan)
        List<Document_Assignment__c> existingAssignments = [
            SELECT Id FROM Document_Assignment__c
            WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId)  AND IsArchived__c = FALSE
            LIMIT 1
        ];

        if (!existingAssignments.isEmpty()) {
            throw new AuraHandledException('This document is already assigned to the selected record.');
        }

        Document_Assignment__c assignment = new Document_Assignment__c();
        assignment.Document__c = documentId;

        if (objectName == 'Lead') {
            assignment.Lead__c = recordId;
        } else if (objectName == 'Opportunity') {
            assignment.Loan__c = recordId; // assuming Loan__c relates to Opportunity
        } else {
            throw new AuraHandledException('Unsupported object: ' + objectName);
        }

        insert assignment;

        // Fetch full document and related info for return
        Document__c doc = [
            SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c,
                   Category__r.Name
            FROM Document__c
            WHERE Id = :documentId
            LIMIT 1
        ];

        DocumentItem result = new DocumentItem();
        result.id = doc.Id;
        result.name = doc.Name;
        result.categoryId = doc.Category__c;
        result.status = doc.Status__c;
        result.team = doc.Team__c;
        result.assignedTo = String.valueOf(doc.Assigned_To__c);
        result.ownerId = doc.OwnerId;
        result.templateId = doc.Document_Template__c;
        result.categoryName = doc.Category__r != null ? doc.Category__r.Name : null;

        System.Debug('result '+result);
        return result;
    }
  /**
     * Deletes a document to a specific record (Lead or Opportunity).
     * @param documentId The ID of the document to delete
     * @param recordId The ID of the record to assign the document to
     * @param objectName The object type ('Lead' or 'Opportunity')
     * @return DocumentItem containing the deleted document's details
     */
@AuraEnabled
public static void deleteDocumentAssignmentFromRecord(Id documentId, Id recordId, String objectName) {
    if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
        throw new AuraHandledException('Missing required parameters.');
    }

    List<Document_Assignment__c> assignmentsToDelete;

    if (objectName == 'Lead') {
        assignmentsToDelete = [
            SELECT Id FROM Document_Assignment__c
            WHERE Document__c = :documentId AND Lead__c = :recordId
        ];
    } else if (objectName == 'Opportunity') {
        assignmentsToDelete = [
            SELECT Id FROM Document_Assignment__c
            WHERE Document__c = :documentId AND Loan__c = :recordId
        ];
    } else {
        throw new AuraHandledException('Unsupported object: ' + objectName);
    }

    if (!assignmentsToDelete.isEmpty()) {
        delete assignmentsToDelete;
    } else {
        throw new AuraHandledException('No matching document assignment found to delete.');
    }
}

@AuraEnabled
public static void deleteDocumentAssignment(Id documentId, Id recordId) {
    if (documentId == null || recordId == null) {
        throw new AuraHandledException('Missing documentId or recordId.');
    }

    List<Document_Assignment__c> toDelete = [
        SELECT Id 
        FROM Document_Assignment__c 
        WHERE Document__c = :documentId 
        AND (Lead__c = :recordId OR Loan__c = :recordId)
        LIMIT 1
    ];

    if (toDelete.isEmpty()) {
        throw new AuraHandledException('Document assignment not found.');
    }

    delete toDelete;
}


@AuraEnabled
public static void deleteArchivedAssignments(List<Id> documentIds, Id recordId) {
    if (documentIds == null || documentIds.isEmpty()) {
        throw new AuraHandledException('No documents to delete.');
    }

    List<Document_Assignment__c> toDelete = [
        SELECT Id
        FROM Document_Assignment__c
        WHERE Document__c IN :documentIds
        AND (Lead__c = :recordId OR Loan__c = :recordId)
        AND IsArchived__c = true
    ];

    delete toDelete;
}


@AuraEnabled(cacheable=true)
public static List<DocumentItem> getArchivedDocuments(Id recordId) {
    List<Document_Assignment__c> archived = [
        SELECT Id, Document__c, Lead__c, Loan__c, IsArchived__c,
               Document__r.Name, Document__r.Status__c
        FROM Document_Assignment__c
        WHERE (Lead__c = :recordId OR Loan__c = :recordId)
        AND IsArchived__c = TRUE
    ];

    List<DocumentItem> result = new List<DocumentItem>();
    for (Document_Assignment__c da : archived) {
        DocumentItem item = new DocumentItem();
        item.id = da.Document__c;
        item.name = da.Document__r.Name;
        item.status = da.Document__r.Status__c;
        result.add(item);
    }
    return result;
}

@AuraEnabled
public static void archiveDocumentAssignment(Id documentId, Id recordId) {
    Document_Assignment__c assignment = [
        SELECT Id, IsArchived__c
        FROM Document_Assignment__c
        WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId)
        LIMIT 1
    ];
    assignment.IsArchived__c = true;
    update assignment;
}

@AuraEnabled
public static void restoreArchivedAssignment(Id documentId, Id recordId) {
    List<Document_Assignment__c> matches = [
        SELECT Id, IsArchived__c 
        FROM Document_Assignment__c 
        WHERE Document__c = :documentId 
        AND (Lead__c = :recordId OR Loan__c = :recordId)
        AND IsArchived__c = true
        LIMIT 1
    ];
    
    if (!matches.isEmpty()) {
        Document_Assignment__c item = matches[0];
        item.IsArchived__c = false;
        update item;
    }
}
@AuraEnabled
public static void restoreArchivedAssignments(List<Id> documentIds, Id recordId) {
    if (documentIds == null || documentIds.isEmpty()) {
        throw new AuraHandledException('No documents to restore.');
    }

    List<Document_Assignment__c> toUpdate = [
        SELECT Id, IsArchived__c
        FROM Document_Assignment__c
        WHERE Document__c IN :documentIds
        AND (Lead__c = :recordId OR Loan__c = :recordId)
        AND IsArchived__c = true
    ];

    for (Document_Assignment__c doc : toUpdate) {
        doc.IsArchived__c = false;
    }

    update toUpdate;
}


// @AuraEnabled
// public static void restoreDocumentAssignment(Id documentId, Id recordId) {
//     Document_Assignment__c assignment = [
//         SELECT Id, IsArchived__c
//         FROM Document_Assignment__c
//         WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId)
//         LIMIT 1
//     ];
//     assignment.IsArchived__c = false;
//     update assignment;
// }


    // ==================== Document Retrieval Methods ====================

    /**
     * Fetches all documents and returns them wrapped in DocumentItem.
     * @return List of DocumentItem wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<DocumentItem> getAllDocuments() {
        System.debug('--- START getAllDocuments ---');

        try {
            List<Document__c> allDocs = [
                SELECT Id, Name, Category__r.Name, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c
                FROM Document__c
                ORDER BY Name
            ];

            List<DocumentItem> wrappedDocs = new List<DocumentItem>();

            for (Document__c d : allDocs) {
                DocumentItem item = new DocumentItem();
                item.id = d.Id;
                item.name = d.Name;
                item.categoryId = d.Category__c;
                item.status = d.Status__c;
                item.team = d.Team__c;
                item.assignedTo = d.Assigned_To__c;
                item.ownerId = d.OwnerId;
                item.templateId = d.Document_Template__c;
                item.categoryName = d.Category__r.Name;
                wrappedDocs.add(item);
            }

            System.debug('Total documents wrapped: ' + wrappedDocs.size());
            System.debug('Total documents: ' + wrappedDocs);
            return wrappedDocs;
        } catch (Exception e) {
            System.debug('ERROR in getAllDocuments: ' + e.getMessage());
            throw new AuraHandledException('Failed to fetch all documents: ' + e.getMessage());
        }
    }

    /**
     * Fetches documents by category, using template or direct mapping.
     * @param categoryId The ID of the category
     * @return DocumentResultWrapper containing document details
     */
    @AuraEnabled(cacheable=true)
    public static DocumentResultWrapper getDocumentsByCategory(Id categoryId) {
        System.debug('--- START getDocumentsByCategory ---');
        System.debug('Category Id: ' + categoryId);

        if (String.isBlank(categoryId)) {
            throw new AuraHandledException('Category Id is required.');
        }

        Doc_Category__c category = [
            SELECT Id, Name, Type__c FROM Doc_Category__c
            WHERE Id = :categoryId
            LIMIT 1
        ];
        System.debug('Fetched category: ' + category.Name + ', Type: ' + category.Type__c);

        List<DocumentItem> docs = new List<DocumentItem>();

        if (category.Type__c == 'Template') {
            System.debug('Path = Template');
            List<Doc_Template__c> templates = [
                SELECT Id FROM Doc_Template__c
                WHERE Category__c = :categoryId AND Name = :category.Name
                LIMIT 1
            ];
            if (templates.isEmpty()) {
                System.debug('No matching template found.');
                return new DocumentResultWrapper('Template', category.Name, null, docs);
            }

            Id templateId = templates[0].Id;

            List<Document__c> rawDocs = [
                SELECT Id, Name, Category__c,Category__r.Name, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c
                FROM Document__c WHERE Document_Template__c = :templateId
            ];

            for (Document__c d : rawDocs) {
                DocumentItem item = new DocumentItem();
                item.id = d.Id;
                item.name = d.Name;
                item.categoryId = d.Category__c;
                item.categoryName = d.Category__r.Name;
                item.status = d.Status__c;
                item.team = d.Team__c;
                item.assignedTo = d.Assigned_To__c;
                item.ownerId = d.OwnerId;
                item.templateId = d.Document_Template__c;
                docs.add(item);
            }

            System.debug('Fetched documents: ' + docs.size());
            return new DocumentResultWrapper('Template', category.Name, templateId, docs);

        } else if (category.Type__c == 'Document') {
            System.debug('Path = Document');

            List<Document__c> rawDocs = [
                SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c
                FROM Document__c WHERE Category__c = :categoryId
            ];

            for (Document__c d : rawDocs) {
                DocumentItem item = new DocumentItem();
                item.id = d.Id;
                item.name = d.Name;
                item.categoryId = d.Category__c;
                item.status = d.Status__c;
                item.team = d.Team__c;
                item.assignedTo = d.Assigned_To__c;
                item.ownerId = d.OwnerId;
                item.templateId = d.Document_Template__c;
                docs.add(item);
            }

            System.debug('Fetched documents: ' + docs.size());
            System.debug('documents: ' + docs);
            return new DocumentResultWrapper('Document', category.Name, null, docs);

        } else {
            System.debug('Unsupported category type: ' + category.Type__c);
            throw new AuraHandledException('Unsupported category type: ' + category.Type__c);
        }
    }

    /**
     * Fetches all documents for a specific template and assigns them to a record.
     * @param templateId The ID of the template
     * @param recordId The ID of the record to assign documents to
     * @param objectName The object type ('Lead' or 'Opportunity')
     * @return List of DocumentItem wrappers for assigned documents
     */
 @AuraEnabled
public static List<DocumentItem> getDocumentsByTemplate(Id templateId, Id recordId, String objectName) {
    if (String.isBlank(templateId)) {
        System.debug('ERROR: Template Id is blank.');
        throw new AuraHandledException('Template Id is required.');
    }

    System.debug('Fetching documents for template: ' + templateId + ', recordId: ' + recordId + ', objectName: ' + objectName);

    try {
        List<Document__c> rawDocs = [
            SELECT Id, Name, Category__c, Status__c, Category__r.Name, Team__c, Assigned_To__c, OwnerId, Document_Template__c
            FROM Document__c
            WHERE Document_Template__c = :templateId
            ORDER BY Name
        ];
        System.debug('Fetched rawDocs: ' + rawDocs);

        List<DocumentItem> result = new List<DocumentItem>();

        Boolean shouldAssign = !String.isBlank(recordId);
        System.debug('Should assign documents? ' + shouldAssign);
        
        Set<Id> assignedDocIds = new Set<Id>();
        List<Document_Assignment__c> assignmentsToInsert = new List<Document_Assignment__c>();

        if (shouldAssign) {
            System.debug('Looking for existing assignments for record: ' + recordId);

            // Avoid duplicate assignments
            Set<Id> documentIds = new Set<Id>();
            for (Document__c doc : rawDocs) {
                documentIds.add(doc.Id);
            }
            System.debug('Documents to check for existing assignments: ' + documentIds);

            List<Document_Assignment__c> existingAssignments = [
                SELECT Document__c
                FROM Document_Assignment__c
                WHERE Document__c IN :documentIds AND (Lead__c = :recordId OR Loan__c = :recordId)
            ];

            System.debug('Found existing assignments: ' + existingAssignments);

            for (Document_Assignment__c assignment : existingAssignments) {
                assignedDocIds.add(assignment.Document__c);
            }
        }

        for (Document__c d : rawDocs) {
            System.debug('Processing document: ' + d.Id + ', name: ' + d.Name);

            if (shouldAssign && assignedDocIds.contains(d.Id)) {
                System.debug('Document ' + d.Id + ' already assigned to record ' + recordId + ', skipping assignment.');
                continue;
            }

            // Create assignment if recordId exists
            if (shouldAssign) {
                Document_Assignment__c assignment = new Document_Assignment__c();
                assignment.Document__c = d.Id;

                if (objectName == 'Lead') {
                    assignment.Lead__c = recordId;
                    System.debug('Assigning document ' + d.Id + ' to Lead with ID: ' + recordId);
                } else if (objectName == 'Opportunity') {
                    assignment.Loan__c = recordId;
                    System.debug('Assigning document ' + d.Name + ' to Opportunity with ID: ' + recordId);
                } else {
                    System.debug('Unknown objectName: ' + objectName);
                }
                
                assignmentsToInsert.add(assignment);
            }

            // Add document to result
            DocumentItem doc = new DocumentItem();
            doc.id = d.Id;
            doc.name = d.Name;
            doc.categoryId = d.Category__c;
            doc.categoryName = d.Category__r.Name;
            doc.status = d.Status__c;
            doc.team = d.Team__c;
            doc.assignedTo = d.Assigned_To__c;
            doc.ownerId = d.OwnerId;
            doc.templateId = d.Document_Template__c;
            result.add(doc);

            System.debug('Added document ' + d.Id + ' to result.');
        }

        if (!assignmentsToInsert.isEmpty()) {
            insert assignmentsToInsert;
            System.debug('Inserted ' + assignmentsToInsert.size() + ' document assignments.');
        } else {
            System.debug('No assignments to insert.');
        }

        return result;

    } catch (Exception e) {
        System.debug('ERROR in getDocumentsByTemplate: ' + e.getMessage());
        throw new AuraHandledException('Failed to fetch and assign documents: ' + e.getMessage());
    }
}



    /**
     * Fetches all documents assigned to a specific record.
     * @param recordId The ID of the record (Lead, Account, etc.)
     * @return List of DocumentItem wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<DocumentItem> getAssignedDocuments(Id recordId) {
        System.debug('recordId: '+recordId);

        try {
            if (recordId == null) {
                throw new AuraHandledException('Record ID is required');
            }

            // Query document assignments for this record
            List<Document_Assignment__c> assignments = [
                SELECT Id, Document__c, Document__r.Name, Document__r.Category__c, 
                       Document__r.Status__c, Document__r.Team__c, Document__r.Assigned_To__c,
                       Document__r.OwnerId, Document__r.Document_Template__c,
                       Document__r.Category__r.Name
                FROM Document_Assignment__c
                WHERE Loan__c = :recordId
            ];
            System.debug('assignments: '+assignments);

            // Transform to DocumentItem wrappers
            List<DocumentItem> documentItems = new List<DocumentItem>();
            for (Document_Assignment__c assignment : assignments) {
                DocumentItem item = new DocumentItem();
                item.id = assignment.Document__c;
                item.name = assignment.Document__r.Name;
                item.categoryId = assignment.Document__r.Category__c;
                item.status = assignment.Document__r.Status__c;
                item.team = assignment.Document__r.Team__c;
                item.assignedTo = UserInfo.getUserId();
                item.ownerId = assignment.Document__r.OwnerId;
                item.templateId = assignment.Document__r.Document_Template__c;
                item.categoryName = assignment.Document__r.Category__r.Name;
                documentItems.add(item);
            }
            System.debug('documentItems: '+documentItems);
            return documentItems;
        } catch (Exception e) {
            System.debug('Error fetching assigned documents: ' + e.getMessage() + '\n' + e.getStackTraceString());
            throw new AuraHandledException('Error fetching assigned documents: ' + e.getMessage());
        }
    }

    // ==================== Template Management Methods ====================

    /**
     * Creates a new template with associated documents.
     * @param templateName The name of the template
     * @param documentIds List of document IDs to associate
     * @return TemplateWrapper containing the created template's details
     */
    @AuraEnabled
    public static TemplateWrapper createTemplateWithDocuments(String templateName, List<Id> documentIds) {
        if (String.isBlank(templateName)) {
            throw new AuraHandledException('Template name is required.');
        }

        // Create Category__c Record
        Doc_Category__c newCategory = new Doc_Category__c(
            Name = templateName,
            Type__c = 'Template'
        );
        insert newCategory;

        // Create New Doc_Template__c Record
        Doc_Template__c newTemplate = new Doc_Template__c(
            Name = templateName,
            Category__c = newCategory.Id
        );
        insert newTemplate;

        // Assign Documents to New Template
        if (documentIds != null && !documentIds.isEmpty()) {
            List<Document__c> docsToAssign = [
                SELECT Id, Document_Template__c
                FROM Document__c
                WHERE Id IN :documentIds
            ];
            for (Document__c doc : docsToAssign) {
                doc.Document_Template__c = newTemplate.Id;
            }
            update docsToAssign;
        }

        // Return New Template Wrapper
        TemplateWrapper wrapper = new TemplateWrapper();
        wrapper.id = newTemplate.Id;
        wrapper.name = newTemplate.Name;
        wrapper.documents = getDocumentsByTemplate(newTemplate.Id, null, null);
        System.Debug('wrapper: '+wrapper);
        return wrapper;
    }

    /**
     * Updates an existing template with new name and document assignments.
     * @param templateId The ID of the template to update
     * @param newTemplateName The new name for the template
     * @param newItemIds List of document IDs to add
     * @param deletedItemIds List of document IDs to remove
     * @return TemplateWrapper containing the updated template's details
     */
    @AuraEnabled
    public static TemplateWrapper updateTemplateWithDocuments(
        Id templateId,
        String newTemplateName,
        List<Id> newItemIds,
        List<Id> deletedItemIds
    ) {
        if (templateId == null) {
            throw new AuraHandledException('Template ID is required.');
        }

        // Fetch the template and its parent category
        Doc_Template__c templateToUpdate = [
            SELECT Id, Name, Category__r.Id, Category__r.Name 
            FROM Doc_Template__c 
            WHERE Id = :templateId 
            LIMIT 1
        ];

        // Update parent category's name if it exists
        if (templateToUpdate.Category__r != null) {
            Doc_Category__c parentCategory = new Doc_Category__c(
                Id = templateToUpdate.Category__r.Id,
                Name = newTemplateName
            );
            update parentCategory;
        }

        // Update Template Name
        if (String.isNotBlank(newTemplateName) && newTemplateName != templateToUpdate.Name) {
            templateToUpdate.Name = newTemplateName;
            update templateToUpdate;
        }
        System.Debug('templateToUpdate: '+templateToUpdate);

        // Add New Documents to Template
        if (!newItemIds.isEmpty()) {
            List<Document__c> docsToUpdate = [
                SELECT Id, Document_Template__c 
                FROM Document__c 
                WHERE Id IN :newItemIds
            ];
            for (Document__c doc : docsToUpdate) {
                doc.Document_Template__c = templateId;
            }
            System.Debug('docsToUpdate: '+docsToUpdate);
            update docsToUpdate;
        }

        // Remove Documents from Template
        if (!deletedItemIds.isEmpty()) {
            List<Document__c> docsToClear = [
                SELECT Id, Document_Template__c 
                FROM Document__c 
                WHERE Id IN :deletedItemIds
            ];
            for (Document__c doc : docsToClear) {
                doc.Document_Template__c = null;
            }
            update docsToClear;
            System.Debug('docsToClear: '+docsToClear);
        }

        // Return Updated Template Wrapper
        TemplateWrapper updatedWrapper = new TemplateWrapper();
        updatedWrapper.id = templateToUpdate.Id;
        updatedWrapper.name = templateToUpdate.Name;
        updatedWrapper.documents = getDocumentsByTemplate(templateToUpdate.Id, null, null);
        return updatedWrapper;
    }

    // ==================== Category and Template Retrieval Methods ====================

    /**
     * Fetches all categories with Type = 'Document' and returns them with camelCase fields.
     * @return List of DocumentCategory wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<DocumentCategory> getDocumentCategories() {
        try {
            System.debug('Fetching document categories...');
            List<Doc_Category__c> rawCategories = [
                SELECT Id, Name 
                FROM Doc_Category__c 
                WHERE Type__c = 'Document' 
                ORDER BY Name
            ];

            List<DocumentCategory> formatted = new List<DocumentCategory>();
            for (Doc_Category__c cat : rawCategories) {
                DocumentCategory wrapper = new DocumentCategory();
                wrapper.id = cat.Id;
                wrapper.name = cat.Name;
                formatted.add(wrapper);
            }

            return formatted;
        } catch (Exception ex) {
            System.debug('Error fetching document categories: ' + ex.getMessage());
            throw new AuraHandledException('Unable to fetch document categories at this time.');
        }
    }

    /**
     * Fetches all categories with Type = 'Template' and their associated single template.
     * @return List of TemplateCategory wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<TemplateCategory> getTemplateCategories() {
        try {
            System.debug('Fetching template categories with their single template...');
            
            // Query categories with their single template
            List<Doc_Category__c> categories = [
                SELECT Id, Name, 
                       (SELECT Id, Name FROM Templates__r LIMIT 1)
                FROM Doc_Category__c 
                WHERE Type__c = 'Template' 
                ORDER BY Name
            ];

            // Transform results
            List<TemplateCategory> result = new List<TemplateCategory>();
            for (Doc_Category__c cat : categories) {
                TemplateCategory wrapper = new TemplateCategory();
                wrapper.id = cat.Id;
                wrapper.name = cat.Name;
                
                // Add the single template if it exists
                if (cat.Templates__r != null && !cat.Templates__r.isEmpty()) {
                    wrapper.template = new TemplateInfo();
                    wrapper.template.id = cat.Templates__r[0].Id;
                    wrapper.template.name = cat.Templates__r[0].Name;
                }
                
                result.add(wrapper);
            }

            System.debug('Fetched ' + result.size() + ' template categories');
            return result;
        } catch (Exception ex) {
            System.debug('Error fetching template categories: ' + ex.getMessage() + 
                        '\nStack Trace: ' + ex.getStackTraceString());
            throw new AuraHandledException('Unable to fetch template categories: ' + ex.getMessage());
        }
    }

    /**
     * Fetches all templates under a given category.
     * @param categoryId The ID of the category
     * @return List of TemplateItem wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<TemplateItem> getTemplatesByCategory(Id categoryId) {
        if (String.isBlank(categoryId)) {
            throw new AuraHandledException('Category Id is required.');
        }

        System.debug('Fetching templates for category: ' + categoryId);

        List<Doc_Template__c> rawTemplates = [
            SELECT Id, Name 
            FROM Doc_Template__c 
            WHERE Category__c = :categoryId 
            ORDER BY Name
        ];

        List<TemplateItem> result = new List<TemplateItem>();
        for (Doc_Template__c t : rawTemplates) {
            TemplateItem item = new TemplateItem();
            item.id = t.Id;
            item.name = t.Name;
            result.add(item);
        }

        return result;
    }

    // ==================== Wrapper Classes ====================

    /**
     * Wrapper class for document details.
     */
    public class DocumentItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String categoryId { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String team { get; set; }
        @AuraEnabled public String assignedTo { get; set; }
        @AuraEnabled public String ownerId { get; set; }
        @AuraEnabled public String templateId { get; set; }
        @AuraEnabled public String categoryName { get; set; }
    }

    /**
     * Wrapper class for input parameters when creating a document.
     */
    public class DocumentInputWrapper {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String name;
        @AuraEnabled public String type;
        @AuraEnabled public String status;
        @AuraEnabled public String team;
        @AuraEnabled public String objectName;
        @AuraEnabled public Id assignedToId;
        @AuraEnabled public Id relatedTo;
    }

    /**
     * Wrapper class to return document-related results.
     */
    public class DocumentResultWrapper {
        @AuraEnabled public String pathType;        // 'Template' or 'Document'
        @AuraEnabled public String categoryName;
        @AuraEnabled public String templateId;
        @AuraEnabled public List<DocumentItem> documents;

        public DocumentResultWrapper(String pathType, String categoryName, String templateId, List<DocumentItem> documents) {
            this.pathType = pathType;
            this.categoryName = categoryName;
            this.templateId = templateId;
            this.documents = documents;
        }
    }

    /**
     * Wrapper class for document categories.
     */
    public class DocumentCategory {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * Wrapper class for template details.
     */
    public class TemplateItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * Wrapper class for template information.
     */
    public class TemplateInfo {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * Wrapper class for template categories with a single template.
     */
    public class TemplateCategory {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public TemplateInfo template { get; set; } // Single template instead of list
    }

    /**
     * Wrapper class for input parameters when creating a template.
     */
    public class TemplateInputWrapper {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String templateName;
        @AuraEnabled public List<Document__c> documents;
    }

    /**
     * Wrapper class for template details with associated documents.
     */
    public class TemplateWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public List<DocumentItem> documents;
    }

    /**
     * Generic wrapper for all string responses (status, errors).
     */
    public class GenericResponseWrapper {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;

        public GenericResponseWrapper(Boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }
}