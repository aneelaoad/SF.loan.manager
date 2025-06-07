/**
 * @description       : Controller class for managing document templates, assignments, and categories in Salesforce.
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : Document Management
 * @last modified on  : 06-07-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class DocumentTemplateController {
    @AuraEnabled(cacheable=true)
    public static List<Map<String, String>> getActiveUsers() {
        List<User> activeUsers = [
            SELECT Id, FirstName, LastName, Name
            FROM User
            WHERE IsActive = true
            ORDER BY Name
        ];

        List<Map<String, String>> userList = new List<Map<String, String>>();

        for (User u : activeUsers) {
            Map<String, String> userMap = new Map<String, String>();
            userMap.put('id', u.Id);
            userMap.put('firstName', u.FirstName);
            userMap.put('lastName', u.LastName);
            userMap.put('name', u.Name);
            userList.add(userMap);
        }

        return userList;
    }

    // ==================== Section 1: Private Utility Methods ====================

    /**
     * Private method to query Document__c records and populate DocumentItem wrappers.
     * @param docIds Set of Document__c IDs to query
     * @return List of populated DocumentItem wrappers
     */

     private static List<DocumentItem> queryDocumentsAndWrap(Set<Id> docIds) {
    if (docIds == null || docIds.isEmpty()) {
        return new List<DocumentItem>();
    }

    // Query Document_Assignment__c to get IsArchived__c for each Document__c
    Map<Id, Boolean> docIdToArchivedMap = new Map<Id, Boolean>();
    for (Document_Assignment__c da : [
        SELECT Document__c, IsArchived__c
        FROM Document_Assignment__c
        WHERE Document__c IN :docIds
    ]) {
        // If a Document__c has multiple assignments, prioritize unarchived or take the first
        if (!docIdToArchivedMap.containsKey(da.Document__c)) {
            docIdToArchivedMap.put(da.Document__c, da.IsArchived__c);
        }
    }

    // Query Document__c records
    List<Document__c> docs = [
        SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, 
               Assigned_To__r.Name, Assigned_To__r.Email, Owner.Name, OwnerId, 
               Document_Template__c, Category__r.Name,
               Related_Contact__r.Email, Related_Contact__r.Name
        FROM Document__c
        WHERE Id IN :docIds
    ];

    // Transform to DocumentItem wrappers
    List<DocumentItem> wrappedDocs = new List<DocumentItem>();
    for (Document__c d : docs) {
        DocumentItem item = new DocumentItem();
        item.id = d.Id;
        item.name = d.Name;
        item.categoryId = d.Category__c;
        item.status = d.Status__c;
        item.team = d.Team__c;
        item.assignedTo = String.valueOf(d.Assigned_To__r.Name);
        item.ownerId = d.OwnerId;
        item.ownerName = d.Owner.Name;
        item.assignedToEmail = d.Assigned_To__r.Email;
        item.templateId = d.Document_Template__c;
        item.categoryName = d.Category__r != null ? d.Category__r.Name : null;

        // Set archive status if available
        item.isArchived = docIdToArchivedMap.containsKey(d.Id) ? docIdToArchivedMap.get(d.Id) : false;

        wrappedDocs.add(item);
    }

    return wrappedDocs;
}

    // private static List<DocumentItem> queryDocumentsAndWrap(Set<Id> docIds) {
    //     if (docIds == null || docIds.isEmpty()) {
    //         return new List<DocumentItem>();
    //     }

    //     // Query Document__c records with relevant fields
    //     List<Document__c> docs = [
    //         SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, 
    //                Assigned_To__r.Name, Assigned_To__r.Email, Owner.Name, OwnerId, 
    //                Document_Template__c, Category__r.Name,Related_Contact__r.Email,Related_Contact__r.Name
    //         FROM Document__c
    //         WHERE Id IN :docIds
    //     ];

    //     // Transform to DocumentItem wrappers
    //     List<DocumentItem> wrappedDocs = new List<DocumentItem>();
    //     for (Document__c d : docs) {
    //         DocumentItem item = new DocumentItem();
    //         item.id = d.Id;
    //         item.name = d.Name;
    //         item.categoryId = d.Category__c;
    //         item.status = d.Status__c;
    //         item.team = d.Team__c;
    //         // item.assignedTo = String.valueOf(d.Related_Contact__r.Name);
    //         item.assignedTo = String.valueOf(d.Assigned_To__r.Name);
    //         item.ownerId = d.OwnerId;
    //         item.ownerName = d.Owner.Name;
    //         item.assignedToEmail = d.Assigned_To__r.Email;
    //         // item.assignedToEmail = d.Related_Contact__r.Email;

    //         item.templateId = d.Document_Template__c;
    //         item.categoryName = d.Category__r != null ? d.Category__r.Name : null;
    //         wrappedDocs.add(item);
    //     }

    //     return wrappedDocs;
    // }

    // ==================== Section 1: Document Creation and Assignment Methods ====================

    /**
     * 1.1 Creates a new single document based on the provided JSON input.
     * @param inputJson JSON string containing document details (categoryId, name, status, team, type, etc.)
     * @return DocumentItem containing the created document's details
     */
    @AuraEnabled
    public static DocumentItem createDocument(String inputJson) {
        // 1.1.1 Log method entry
        System.debug('--- START createDocument ---');
        System.debug('1.1.2 Serialized Input JSON: ' + inputJson);

        // 1.1.3 Deserialize and validate input
        DocumentInputWrapper input = (DocumentInputWrapper) JSON.deserialize(inputJson, DocumentInputWrapper.class);
        System.debug('1.1.4 Deserialized Input: ' + JSON.serialize(input));

        // 1.1.5 Validate required fields
        if (input == null || input.categoryId == null || String.isBlank(input.name)) {
            throw new AuraHandledException('CategoryId and name are required.');
        }

        // 1.1.6 Create the Document__c record
        Document__c doc = new Document__c(
            Name = input.name,
            Category__c = input.categoryId,
            Status__c = input.status,
            Team__c = input.team,
            Type__c = input.type,
            Assigned_To__c = input.assignedToId
        );
        insert doc;
        System.debug('1.1.7 Inserted Document: ' + doc.Id);

        // 1.1.8 Create Document_Assignment__c junction record based on object type
        if (input.objectName == 'Lead' || input.objectName == 'Opportunity') {
            Document_Assignment__c assignment = new Document_Assignment__c();
            assignment.Document__c = doc.Id;

            if (input.objectName == 'Lead') {
                assignment.Lead__c = input.relatedTo;
                System.debug('1.1.9 Assigned to Lead: ' + input.relatedTo);
            } else if (input.objectName == 'Opportunity') {
                assignment.Loan__c = input.relatedTo;
                System.debug('1.1.10 Assigned to Loan: ' + input.relatedTo);
            }

            insert assignment;
            System.debug('1.1.11 Inserted Assignment: ' + assignment.Id);
        } else {
            throw new AuraHandledException('Invalid objectName. Must be "Lead" or "Loan".');
        }

        // 1.1.12 Fetch and wrap document details
        List<DocumentItem> items = queryDocumentsAndWrap(new Set<Id>{doc.Id});
        return items.isEmpty() ? new DocumentItem() : items[0];
    }

    /**
     * 1.2 Assigns a document to a specific record (Lead or Opportunity).
     * @param documentId The ID of the document to assign
     * @param recordId The ID of the record to assign the document to
     * @param objectName The object type ('Lead' or 'Opportunity')
     * @return DocumentItem containing the assigned document's details
     */
    @AuraEnabled
    public static DocumentItem assignDocumentToRecord(Id documentId, Id recordId, String objectName) {
        // 1.2.1 Validate input parameters
        if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
            throw new AuraHandledException('Missing required parameters.');
        }

        // 1.2.2 Check for existing assignments
        List<Document_Assignment__c> existingAssignments = [
            SELECT Id FROM Document_Assignment__c
            WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId) AND IsArchived__c = FALSE
            LIMIT 1
        ];

        if (!existingAssignments.isEmpty()) {
            throw new AuraHandledException('This document is already assigned to the selected record.');
        }

        // 1.2.3 Create new assignment record
        Document_Assignment__c assignment = new Document_Assignment__c();
        assignment.Document__c = documentId;

        if (objectName == 'Lead') {
            assignment.Lead__c = recordId;
        } else if (objectName == 'Opportunity') {
            assignment.Loan__c = recordId;
        } else {
            throw new AuraHandledException('Unsupported object: ' + objectName);
        }

        insert assignment;

        // 1.2.4 Fetch and wrap document details
        List<DocumentItem> items = queryDocumentsAndWrap(new Set<Id>{documentId});
        System.Debug('1.2.5 Result: ' + items);
        return items.isEmpty() ? new DocumentItem() : items[0];
    }

    /**
     * 1.3 Deletes a document assignment for a specific record (Lead or Opportunity).
     * @param documentId The ID of the document to delete
     * @param recordId The ID of the record to remove the document from
     * @param objectName The object type ('Lead' or 'Opportunity')
     */
    @AuraEnabled
    public static void deleteDocumentAssignmentFromRecord(Id documentId, Id recordId, String objectName) {
        // 1.3.1 Validate input parameters
        if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
            throw new AuraHandledException('Missing required parameters.');
        }

        // 1.3.2 Query assignments to delete
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

        // 1.3.3 Delete assignments if found
        if (!assignmentsToDelete.isEmpty()) {
            delete assignmentsToDelete;
        } else {
            throw new AuraHandledException('No matching document assignment found to delete.');
        }
    }

    /**
     * 1.5 Deletes multiple archived document assignments.
     * @param documentIds List of document IDs to delete
     * @param recordId The ID of the record (Lead or Opportunity)
     */
    @AuraEnabled
    public static void deleteArchivedAssignments(List<Id> documentIds, Id recordId) {
        // 1.5.1 Validate input
        if (documentIds == null || documentIds.isEmpty()) {
            throw new AuraHandledException('No documents to delete.');
        }

        // 1.5.2 Query archived assignments
        List<Document_Assignment__c> toDelete = [
            SELECT Id
            FROM Document_Assignment__c
            WHERE Document__c IN :documentIds
            AND (Lead__c = :recordId OR Loan__c = :recordId)
            AND IsArchived__c = true
        ];

        // 1.5.3 Delete assignments
        delete toDelete;
    }

    /**
     * 1.6 Retrieves archived documents for a specific record.
     * @param recordId The ID of the record (Lead or Opportunity)
     * @return List of DocumentItem wrappers for archived documents
     */
    @AuraEnabled(cacheable=true)
    public static List<DocumentItem> getArchivedDocuments(Id recordId) {
        // 1.6.1 Query archived assignments
        List<Document_Assignment__c> archived = [
            SELECT Id, Document__c, Lead__c, Loan__c, IsArchived__c,
                   Document__r.Name, Document__r.Status__c
            FROM Document_Assignment__c
            WHERE (Lead__c = :recordId OR Loan__c = :recordId)
            AND IsArchived__c = TRUE
        ];

        // 1.6.2 Collect document IDs
        Set<Id> docIds = new Set<Id>();
        for (Document_Assignment__c da : archived) {
            docIds.add(da.Document__c);
        }

        // 1.6.3 Fetch and wrap document details
        return queryDocumentsAndWrap(docIds);
    }

    /**
     * 1.7 Archives a document assignment.
     * @param documentId The ID of the document
     * @param recordId The ID of the record (Lead or Opportunity)
     */
    @AuraEnabled
    public static void archiveDocumentAssignment(Id documentId, Id recordId) {
        // 1.7.1 Query assignment
        Document_Assignment__c assignment = [
            SELECT Id, IsArchived__c
            FROM Document_Assignment__c
            WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId)
            LIMIT 1
        ];
        // 1.7.2 Mark as archived
        assignment.IsArchived__c = true;
        update assignment;
    }

    /**
     * 1.8 Restores a single archived document assignment.
     * @param documentId The ID of the document
     * @param recordId The ID of the record (Lead or Opportunity)
     */
    @AuraEnabled
    public static void restoreArchivedAssignment(Id documentId, Id recordId) {
        // 1.8.1 Query archived assignment
        List<Document_Assignment__c> matches = [
            SELECT Id, IsArchived__c 
            FROM Document_Assignment__c 
            WHERE Document__c = :documentId 
            AND (Lead__c = :recordId OR Loan__c = :recordId)
            AND IsArchived__c = true
            LIMIT 1
        ];
        
        // 1.8.2 Restore if found
        if (!matches.isEmpty()) {
            Document_Assignment__c item = matches[0];
            item.IsArchived__c = false;
            update item;
        }
    }

    /**
     * 1.9 Restores multiple archived document assignments and returns associated DocumentItems.
     * @param documentIds List of document IDs to restore
     * @param recordId The ID of the record (Lead or Opportunity)
     * @return List of DocumentItem wrappers for restored documents
     */
    @AuraEnabled
    public static List<DocumentItem> restoreArchivedAssignments(List<Id> documentIds, Id recordId) {
        // 1.9.1 Validate input
        if (documentIds == null || documentIds.isEmpty()) {
            throw new AuraHandledException('No documents to restore.');
        }

        // 1.9.2 Query archived assignments
        List<Document_Assignment__c> toUpdate = [
            SELECT Id, Document__c, IsArchived__c
            FROM Document_Assignment__c
            WHERE Document__c IN :documentIds
            AND (Lead__c = :recordId OR Loan__c = :recordId)
            AND IsArchived__c = true
        ];

        if (toUpdate.isEmpty()) {
            throw new AuraHandledException('No matching archived assignments found.');
        }

        // 1.9.3 Mark as unarchived
        for (Document_Assignment__c assignment : toUpdate) {
            assignment.IsArchived__c = false;
        }

        update toUpdate;

        // 1.9.4 Get unique document IDs and fetch details
        Set<Id> restoredDocIds = new Set<Id>();
        for (Document_Assignment__c assignment : toUpdate) {
            restoredDocIds.add(assignment.Document__c);
        }

        // 1.9.5 Fetch and wrap document details
        List<DocumentItem> wrappedDocs = queryDocumentsAndWrap(restoredDocIds);
        System.Debug('wrappedDocs: '+wrappedDocs);
        return wrappedDocs;
    }

    // ==================== Section 2: Document Retrieval Methods ====================
public class DocumentTypeWrapper {
    @AuraEnabled public List<DocumentItem> documents { get; set; }
    @AuraEnabled public List<DocumentItem> tasks { get; set; }
    
    public DocumentTypeWrapper(List<DocumentItem> documents, List<DocumentItem> tasks) {
        this.documents = documents;
        this.tasks = tasks;
    }
}

    /**
     * 2.1 Fetches all documents and returns them wrapped in DocumentItem.
     * @return List of DocumentItem wrappers
     */

     @AuraEnabled(cacheable=true)
public static DocumentTypeWrapper getAllDocuments() {
    System.debug('--- START getAllDocuments ---');

    try {
        // Fetch all documents with needed fields
        List<Document__c> allDocs = [
            SELECT Id, Name, Category__r.Name, Status__c, Team__c, Assigned_To__c, Type__c, OwnerId, Document_Template__c
            FROM Document__c
            WHERE Type__c IN ('Document', 'Task')
            ORDER BY Name
        ];

        // Split IDs by type
        Set<Id> docIds = new Set<Id>();
        Set<Id> taskIds = new Set<Id>();

        for (Document__c doc : allDocs) {
            if (doc.Type__c == 'Document') {
                docIds.add(doc.Id);
            } else if (doc.Type__c == 'Task') {
                taskIds.add(doc.Id);
            }
        }

        // Wrap documents
        List<DocumentItem> documentItems = queryDocumentsAndWrap(docIds);
        List<DocumentItem> taskItems = queryDocumentsAndWrap(taskIds);

        System.debug('Documents: ' + documentItems.size());
        System.debug('Tasks: ' + taskItems.size());
        DocumentTypeWrapper res = new DocumentTypeWrapper(documentItems, taskItems);
        System.debug('res: '+ res);

        return res; 

    } catch (Exception e) {
        System.debug('Error in getAllDocuments: ' + e.getMessage());
        throw new AuraHandledException('Failed to fetch document data: ' + e.getMessage());
    }
}

    // @AuraEnabled(cacheable=true)
    // public static List<DocumentItem> getAllDocuments() {
    //     // 2.1.1 Log method entry
    //     System.debug('--- START getAllDocuments ---');

    //     try {
    //         // 2.1.2 Query all documents
    //         List<Document__c> allDocs = [
    //             SELECT Id, Name, Category__r.Name, Status__c, Team__c, Assigned_To__c,Type__c, OwnerId, Document_Template__c
    //             FROM Document__c
    //             ORDER BY Name
    //         ];

    //         // 2.1.3 Fetch and wrap document details
    //         Set<Id> docIds = new Set<Id>();
    //         for (Document__c d : allDocs) {
    //             docIds.add(d.Id);
    //         }

    //         // 2.1.4 Log results
    //         List<DocumentItem> wrappedDocs = queryDocumentsAndWrap(docIds);
    //         System.debug('2.1.5 Total documents wrapped: ' + wrappedDocs.size());
    //         System.debug('2.1.6 Total documents: ' + wrappedDocs);
    //         return wrappedDocs;
    //     } catch (Exception e) {
    //         System.debug('2.1.7 ERROR in getAllDocuments: ' + e.getMessage());
    //         throw new AuraHandledException('Failed to fetch all documents: ' + e.getMessage());
    //     }
    // }

    /**
     * 2.2 Fetches documents by category, using template or direct mapping.
     * @param categoryId The ID of the category
     * @return DocumentResultWrapper containing document details
     */
    @AuraEnabled(cacheable=true)
    public static DocumentResultWrapper getDocumentsByCategory(Id categoryId) {
        // 2.2.1 Log method entry
        System.debug('--- START getDocumentsByCategory ---');
        System.debug('2.2.2 Category Id: ' + categoryId);

        // 2.2.3 Validate input
        if (String.isBlank(categoryId)) {
            throw new AuraHandledException('Category Id is required.');
        }

        // 2.2.4 Fetch category details
        Doc_Category__c category = [
            SELECT Id, Name, Type__c FROM Doc_Category__c
            WHERE Id = :categoryId
            LIMIT 1
        ];
        System.debug('2.2.5 Fetched category: ' + category.Name + ', Type: ' + category.Type__c);

        List<DocumentItem> docs = new List<DocumentItem>();

        if (category.Type__c == 'Template') {
            // 2.2.6 Handle Template-based category
            System.debug('2.2.7 Path = Template');
            List<Doc_Template__c> templates = [
                SELECT Id FROM Doc_Template__c
                WHERE Category__c = :categoryId AND Name = :category.Name
                LIMIT 1
            ];
            if (templates.isEmpty()) {
                System.debug('2.2.8 No matching template found.');
                return new DocumentResultWrapper('Template', category.Name, null, docs);
            }

            Id templateId = templates[0].Id;

            // 2.2.9 Fetch documents for template
            List<Document__c> rawDocs = [
                SELECT Id, Name, Category__c, Category__r.Name, Status__c, Team__c,Assigned_To__r.Name, Assigned_To__r.Email, Owner.Name, Assigned_To__c, OwnerId, Document_Template__c
                FROM Document__c WHERE Document_Template__c = :templateId
            ];

            // 2.2.10 Fetch and wrap document details
            Set<Id> docIds = new Set<Id>();
            for (Document__c d : rawDocs) {
                docIds.add(d.Id);
            }
            docs = queryDocumentsAndWrap(docIds);

            // 2.2.11 Return template-based result
            System.debug('2.2.12 Fetched documents: ' + docs.size());
            return new DocumentResultWrapper('Template', category.Name, templateId, docs);

        } else if (category.Type__c == 'Document') {
            // 2.2.13 Handle Document-based category
            System.debug('2.2.14 Path = Document');

            // 2.2.15 Fetch documents for category
            List<Document__c> rawDocs = [
                SELECT Id, Name, Category__c, Status__c, Team__c, Assigned_To__c, OwnerId, Document_Template__c
                FROM Document__c WHERE Category__c = :categoryId
            ];

            // 2.2.16 Fetch and wrap document details
            Set<Id> docIds = new Set<Id>();
            for (Document__c d : rawDocs) {
                docIds.add(d.Id);
            }
            docs = queryDocumentsAndWrap(docIds);

            // 2.2.17 Return document-based result
            System.debug('2.2.18 Fetched documents: ' + docs.size());
            System.debug('2.2.19 documents: ' + docs);
            return new DocumentResultWrapper('Document', category.Name, null, docs);

        } else {
            // 2.2.20 Handle unsupported category type
            System.debug('2.2.21 Unsupported category type: ' + category.Type__c);
            throw new AuraHandledException('Unsupported category type: ' + category.Type__c);
        }
    }

    /**
     * 2.3 Fetches all documents for a specific template and assigns them to a record.
     * @param templateId The ID of the template
     * @param recordId The ID of the record to assign documents to
     * @param objectName The object type ('Lead' or 'Opportunity')
     * @return List of DocumentItem wrappers for assigned documents
     */
    @AuraEnabled
    public static List<DocumentItem> getDocumentsByTemplate(Id templateId, Id recordId, String objectName) {
        // 2.3.1 Validate input
        if (String.isBlank(templateId)) {
            System.debug('2.3.2 ERROR: Template Id is blank.');
            throw new AuraHandledException('Template Id is required.');
        }

        // 2.3.3 Log method details
        System.debug('2.3.4 Fetching documents for template: ' + templateId + ', recordId: ' + recordId + ', objectName: ' + objectName);

        // 2.3.5 Query documents for template
        List<Document__c> rawDocs = [
            SELECT Id, Name, Category__c, Status__c, Assigned_To__r.Name, Assigned_To__r.Email, Owner.Name,Category__r.Name, Team__c, Assigned_To__c, OwnerId, Document_Template__c
            FROM Document__c
            WHERE Document_Template__c = :templateId
            ORDER BY Name
        ];
        System.debug('2.3.6 Fetched rawDocs: ' + rawDocs);

        List<DocumentItem> result = new List<DocumentItem>();
        Boolean shouldAssign = !String.isBlank(recordId);
        System.debug('2.3.7 Should assign documents? ' + shouldAssign);
        
        Set<Id> assignedDocIds = new Set<Id>();
        List<Document_Assignment__c> assignmentsToInsert = new List<Document_Assignment__c>();

        if (shouldAssign) {
            // 2.3.8 Check for existing assignments
            System.debug('2.3.9 Looking for existing assignments for record: ' + recordId);

            Set<Id> documentIds = new Set<Id>();
            for (Document__c doc : rawDocs) {
                documentIds.add(doc.Id);
            }
            System.debug('2.3.10 Documents to check for existing assignments: ' + documentIds);

            List<Document_Assignment__c> existingAssignments = [
                SELECT Document__c
                FROM Document_Assignment__c
                WHERE Document__c IN :documentIds AND (Lead__c = :recordId OR Loan__c = :recordId)
            ];

            System.debug('2.3.11 Found existing assignments: ' + existingAssignments);

            for (Document_Assignment__c assignment : existingAssignments) {
                assignedDocIds.add(assignment.Document__c);
            }
        }

        Set<Id> docIds = new Set<Id>();
        for (Document__c d : rawDocs) {
            // 2.3.12 Process each document
            System.debug('2.3.13 Processing document: ' + d.Id + ', name: ' + d.Name);

            if (shouldAssign && assignedDocIds.contains(d.Id)) {
                System.debug('2.3.14 Document ' + d.Id + ' already assigned to record ' + recordId + ', skipping assignment.');
                continue;
            }

            // 2.3.15 Create assignment if needed
            if (shouldAssign) {
                Document_Assignment__c assignment = new Document_Assignment__c();
                assignment.Document__c = d.Id;

                if (objectName == 'Lead') {
                    assignment.Lead__c = recordId;
                    System.debug('2.3.16 Assigning document ' + d.Id + ' to Lead with ID: ' + recordId);
                } else if (objectName == 'Opportunity') {
                    assignment.Loan__c = recordId;
                    System.debug('2.3.17 Assigning document ' + d.Name + ' to Opportunity with ID: ' + recordId);
                } else {
                    System.debug('2.3.18 Unknown objectName: ' + objectName);
                }
                
                assignmentsToInsert.add(assignment);
            }

            docIds.add(d.Id);
        }

        // 2.3.19 Fetch and wrap document details
        result = queryDocumentsAndWrap(docIds);

        // 2.3.20 Insert assignments if any
        if (!assignmentsToInsert.isEmpty()) {
            insert assignmentsToInsert;
            System.debug('2.3.21 Inserted ' + assignmentsToInsert.size() + ' document assignments.');
        } else {
            System.debug('2.3.22 No assignments to insert.');
        }

        return result;
    }

    /**
     * 2.4 Fetches all documents assigned to a specific record.
     * @param recordId The ID of the record (Lead, Account, etc.)
     * @return List of DocumentItem wrappers
     */
    // @AuraEnabled(cacheable=true)
    // public static List<DocumentItem> getAssignedDocuments(Id recordId) {
    //     // 2.4.1 Log input
    //     System.debug('2.4.2 recordId: ' + recordId);

    //     // 2.4.3 Validate input
    //     if (recordId == null) {
    //         throw new AuraHandledException('Record ID is required');
    //     }

    //     // 2.4.4 Query document assignments
    //     List<Document_Assignment__c> assignments = [
    //         SELECT Id, Document__c, Document__r.Name, Document__r.Category__c, 
    //                Document__r.Status__c, Document__r.Team__c, Document__r.Assigned_To__c,Document__r.Assigned_To__r.Name,
    //                Document__r.OwnerId,Document__r.Related_Contact__r.Email, Document__r.Document_Template__c,Document__r.Owner.Name,Document__r.Assigned_To__r.Email,
    //                Document__r.Category__r.Name
    //         FROM Document_Assignment__c
    //         WHERE Loan__c = :recordId
    //     ];
    //     System.debug('2.4.5 assignments: ' + assignments);

    //     // 2.4.6 Collect document IDs
    //     Set<Id> docIds = new Set<Id>();
    //     for (Document_Assignment__c assignment : assignments) {
    //         docIds.add(assignment.Document__c);
    //     }

    //     // 2.4.7 Fetch and wrap document details
    //     List<DocumentItem> documentItems = queryDocumentsAndWrap(docIds);
    //     System.debug('2.4.8 documentItems: ' + documentItems);
    //     return documentItems;
    // }

    @AuraEnabled(cacheable=true)
public static List<DocumentItem> getAssignedDocuments(Id recordId, String objectName) {
    // Log input
    System.debug('recordId: ' + recordId);
    System.debug('objectName: ' + objectName);

    // Validate input
    if (recordId == null || objectName == null) {
        throw new AuraHandledException('Record ID and object name are required');
    }

    // Initialize the base query
    String baseQuery = 'SELECT Id, Document__c, Document__r.Name, Document__r.Category__c, ' +
                       'Document__r.Status__c, Document__r.Team__c, Document__r.Assigned_To__c, ' +
                       'Document__r.Assigned_To__r.Name, Document__r.OwnerId, ' +
                       'Document__r.Related_Contact__r.Email, Document__r.Document_Template__c, ' +
                       'Document__r.Owner.Name, Document__r.Assigned_To__r.Email, ' +
                       'Document__r.Category__r.Name ';

    // Add the WHERE clause dynamically based on the objectName
    String whereClause = '';
    if (objectName == 'Lead') {
        whereClause = 'WHERE Lead__c = :recordId';  // Assuming 'Lead__c' is the relationship field to Lead
    } else if (objectName == 'Opportunity') {
        whereClause = 'WHERE Loan__c = :recordId';  // Assuming 'Loan__c' is the relationship field to Opportunity/Loan
    } else {
        throw new AuraHandledException('Invalid object name. Supported values are "Lead" or "Opportunity".');
    }

    // Combine base query and where clause
    String query = baseQuery + ' FROM Document_Assignment__c ' + whereClause;

    // Log the dynamic query for debugging
    System.debug('Dynamic Query: ' + query);

    // Execute the dynamic query
    List<Document_Assignment__c> assignments = Database.query(query);

    // Log assignments for debugging
    System.debug('Assignments: ' + assignments);

    // Collect document IDs from the assignments
    Set<Id> docIds = new Set<Id>();
    for (Document_Assignment__c assignment : assignments) {
        docIds.add(assignment.Document__c);
    }

    // Fetch and wrap document details
    List<DocumentItem> documentItems = queryDocumentsAndWrap(docIds);

    // Log document items for debugging
    System.debug('Document Items: ' + documentItems);

    return documentItems;
}

    // ==================== Section 3: Template Management Methods ====================

    /**
     * 3.1 Creates a new template with associated documents.
     * @param templateName The name of the template
     * @param documentIds List of document IDs to associate
     * @return TemplateWrapper containing the created template's details
     */
    @AuraEnabled
    public static TemplateWrapper createTemplateWithDocuments(String templateName, List<Id> documentIds) {
        // 3.1.1 Validate input
        if (String.isBlank(templateName)) {
            throw new AuraHandledException('Template name is required.');
        }

        // 3.1.2 Create Category__c record
        Doc_Category__c newCategory = new Doc_Category__c(
            Name = templateName,
            Type__c = 'Template'
        );
        insert newCategory;

        // 3.1.3 Create Doc_Template__c record
        Doc_Template__c newTemplate = new Doc_Template__c(
            Name = templateName,
            Category__c = newCategory.Id
        );
        insert newTemplate;

        // 3.1.4 Assign documents to template
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

        // 3.1.5 Populate TemplateWrapper
        TemplateWrapper wrapper = new TemplateWrapper();
        wrapper.id = newTemplate.Id;
        wrapper.name = newTemplate.Name;
        wrapper.documents = getDocumentsByTemplate(newTemplate.Id, null, null);
        System.Debug('3.1.6 wrapper: ' + wrapper);
        return wrapper;
    }

    /**
     * 3.2 Updates an existing template with new name and document assignments.
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
        // 3.2.1 Validate input
        if (templateId == null) {
            throw new AuraHandledException('Template ID is required.');
        }

        // 3.2.2 Fetch template and category
        Doc_Template__c templateToUpdate = [
            SELECT Id, Name, Category__r.Id, Category__r.Name 
            FROM Doc_Template__c 
            WHERE Id = :templateId 
            LIMIT 1
        ];

        // 3.2.3 Update category name
        if (templateToUpdate.Category__r != null) {
            Doc_Category__c parentCategory = new Doc_Category__c(
                Id = templateToUpdate.Category__r.Id,
                Name = newTemplateName
            );
            update parentCategory;
        }

        // 3.2.4 Update template name
        if (String.isNotBlank(newTemplateName) && newTemplateName != templateToUpdate.Name) {
            templateToUpdate.Name = newTemplateName;
            update templateToUpdate;
        }
        System.Debug('3.2.5 templateToUpdate: ' + templateToUpdate);

        // 3.2.6 Add new documents
        if (!newItemIds.isEmpty()) {
            List<Document__c> docsToUpdate = [
                SELECT Id, Document_Template__c 
                FROM Document__c 
                WHERE Id IN :newItemIds
            ];
            for (Document__c doc : docsToUpdate) {
                doc.Document_Template__c = templateId;
            }
            System.Debug('3.2.7 docsToUpdate: ' + docsToUpdate);
            update docsToUpdate;
        }

        // 3.2.8 Remove documents
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
            System.Debug('3.2.9 docsToClear: ' + docsToClear);
        }

        // 3.2.10 Populate updated TemplateWrapper
        TemplateWrapper updatedWrapper = new TemplateWrapper();
        updatedWrapper.id = templateToUpdate.Id;
        updatedWrapper.name = templateToUpdate.Name;
        updatedWrapper.documents = getDocumentsByTemplate(templateToUpdate.Id, null, null);
        return updatedWrapper;
    }

    // ==================== Section 4: Category and Template Retrieval Methods ====================

    /**
     * Creates a new Document Category.
     * @param name The name of the category to create
     * @return The created DocumentCategory wrapper
     */
    @AuraEnabled
    public static DocumentCategory createDocumentCategory(String name) {
        if (String.isBlank(name)) {
            throw new AuraHandledException('Category name cannot be empty.');
        }

        try {
            // Create new category record
            Doc_Category__c newCategory = new Doc_Category__c(
                Name = name,
                Type__c = 'Document' // Assuming you want to hardcode this as in your query
            );

            insert newCategory;

            // Wrap the created record and return
            DocumentCategory result = new DocumentCategory();
            result.id = newCategory.Id;
            result.name = newCategory.Name;

            return result;
        } catch (Exception ex) {
            System.debug('Error creating document category: ' + ex.getMessage());
            throw new AuraHandledException('Failed to create document category: ' + ex.getMessage());
        }
    }

    /**
     * 4.1 Fetches all categories with Type = 'Document' and returns them with camelCase fields.
     * @return List of DocumentCategory wrappers
     */
    @AuraEnabled(cacheable=false)
    public static List<DocumentCategory> getDocumentCategories() {
        try {
            // 4.1.1 Log method entry
            System.debug('4.1.2 Fetching document categories...');
            // 4.1.3 Query document categories
            List<Doc_Category__c> rawCategories = [
                SELECT Id, Name 
                FROM Doc_Category__c 
                WHERE Type__c = 'Document' 
                ORDER BY Name
            ];

            // 4.1.4 Transform to DocumentCategory wrappers
            List<DocumentCategory> formatted = new List<DocumentCategory>();
            for (Doc_Category__c cat : rawCategories) {
                DocumentCategory wrapper = new DocumentCategory();
                wrapper.id = cat.Id;
                wrapper.name = cat.Name;
                formatted.add(wrapper);
            }

            return formatted;
        } catch (Exception ex) {
            System.debug('4.1.5 Error fetching document categories: ' + ex.getMessage());
            throw new AuraHandledException('Unable to fetch document categories at this time.');
        }
    }
   
    /**
     * 4.2 Fetches all categories with Type = 'Template' and their associated single template.
     * @return List of TemplateCategory wrappers
     */
    @AuraEnabled(cacheable=false)
    public static List<TemplateCategory> getTemplateCategories() {
        try {
            // 4.2.1 Log method entry
            System.debug('4.2.2 Fetching template categories with their single template...');
            
            // 4.2.3 Query template categories
            List<Doc_Category__c> categories = [
                SELECT Id, Name, 
                       (SELECT Id, Name FROM Templates__r LIMIT 1)
                FROM Doc_Category__c 
                WHERE Type__c = 'Template' 
                ORDER BY Name
            ];

            // 4.2.4 Transform to TemplateCategory wrappers
            List<TemplateCategory> result = new List<TemplateCategory>();
            for (Doc_Category__c cat : categories) {
                TemplateCategory wrapper = new TemplateCategory();
                wrapper.id = cat.Id;
                wrapper.name = cat.Name;
                
                // 4.2.5 Add single template if exists
                if (cat.Templates__r != null && !cat.Templates__r.isEmpty()) {
                    wrapper.template = new TemplateInfo();
                    wrapper.template.id = cat.Templates__r[0].Id;
                    wrapper.template.name = cat.Templates__r[0].Name;
                }
                
                result.add(wrapper);
            }

            // 4.2.6 Log results
            System.debug('4.2.7 Fetched ' + result.size() + ' template categories');
            return result;
        } catch (Exception ex) {
            System.debug('4.2.8 Error fetching template categories: ' + ex.getMessage() + 
                        '\nStack Trace: ' + ex.getStackTraceString());
            throw new AuraHandledException('Unable to fetch template categories: ' + ex.getMessage());
        }
    }

    /**
     * 4.3 Fetches all templates under a given category.
     * @param categoryId The ID of the category
     * @return List of TemplateItem wrappers
     */
    @AuraEnabled(cacheable=true)
    public static List<TemplateItem> getTemplatesByCategory(Id categoryId) {
        // 4.3.1 Validate input
        if (String.isBlank(categoryId)) {
            throw new AuraHandledException('Category Id is required.');
        }

        // 4.3.2 Log method entry
        System.debug('4.3.3 Fetching templates for category: ' + categoryId);

        // 4.3.4 Query templates
        List<Doc_Template__c> rawTemplates = [
            SELECT Id, Name 
            FROM Doc_Template__c 
            WHERE Category__c = :categoryId 
            ORDER BY Name
        ];

        // 4.3.5 Transform to TemplateItem wrappers
        List<TemplateItem> result = new List<TemplateItem>();
        for (Doc_Template__c t : rawTemplates) {
            TemplateItem item = new TemplateItem();
            item.id = t.Id;
            item.name = t.Name;
            result.add(item);
        }

        return result;
    }

    // ==================== Section 5: Email Sending Methods ====================

    @AuraEnabled
    public static GenericResponseWrapper sendReadyToSendDocuments(List<Id> documentIds, Id recordId, String objectName) {
        System.debug('objectName: '+objectName);
        System.debug('recordId: '+recordId);
        if (documentIds == null || documentIds.isEmpty()) {
            return new GenericResponseWrapper(false, 'No document IDs provided.');
        }
        if (String.isBlank(recordId)) {
            return new GenericResponseWrapper(false, 'Record ID is required.');
        }

        try {
            // Query documents with 'Ready to Send' status
            List<Document__c> documents = [
                SELECT Id, Name, Status__c
                FROM Document__c
                WHERE Id IN :documentIds AND Status__c = 'Ready to Send'
            ];

            if (documents.isEmpty()) {
                return new GenericResponseWrapper(false, 'No documents with status "Ready to Send" found.');
            }

            // Get record owner and recipient email based on object type
            String recipientEmail;
            String recipientName;
            Id ownerId;

            if (objectName == 'Lead') {
                Lead leadRecord = [
                    SELECT Id, Email, Name, OwnerId
                    FROM Lead
                    WHERE Id = :recordId
                    LIMIT 1
                ];
                System.debug('leadRecord: '+leadRecord);
                recipientEmail = leadRecord.Email;
                recipientName = leadRecord.Name;
                ownerId = leadRecord.OwnerId;
            } else if (objectName == 'Opportunity') {

                Opportunity oppRecord = [
                    SELECT Id, Cust_Borrower_Email__c, Name, OwnerId
                    FROM Opportunity
                    WHERE Id = :recordId
                    LIMIT 1
                ];
                System.debug('oppRecord: '+oppRecord);
                recipientEmail = oppRecord.Cust_Borrower_Email__c;
                recipientName = oppRecord.Name;
                ownerId = oppRecord.OwnerId;
            } else {
                return new GenericResponseWrapper(false, 'Unsupported object type: ' + objectName);
            }

            // Query owner details
            User recordOwner = [
                SELECT Id, Name, Email
                FROM User
                WHERE Id = :ownerId
                LIMIT 1
            ];

            if (String.isBlank(recipientEmail)) {
                return new GenericResponseWrapper(false, 'Recipient email address not found on the record.');
            }
        System.debug('recipientEmail: '+recipientEmail);

            // Build email content
            String greeting = String.isNotBlank(recipientName) ? 'Dear ' + recipientName + ',' : 'Dear Customer,';

            String htmlBody = '';
            htmlBody += '<html><body style="font-family:Segoe UI, sans-serif; background-color:#f4fdfc; padding:20px;">';
            htmlBody += '<div style="max-width:700px; margin:auto; background:#ffffff; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.08); padding:30px;">';

            // Greeting
            htmlBody += '<p style="font-size:16px; color:#333;">' + greeting + '</p>';
            htmlBody += '<p style="font-size:16px; color:#333;">The following document(s) are ready for your review:</p>';

            // Document Table
            htmlBody += '<table style="width:100%; border-collapse:collapse; margin-top:20px;">';
            htmlBody += '<thead><tr>';
            htmlBody += '<th style="background:#28c7c7; color:#fff; text-align:left; padding:10px; border-radius:6px 6px 0 0;">Item Name/s</th>';
            htmlBody += '</tr></thead><tbody>';
            for (Document__c doc : documents) {
                htmlBody += '<tr>';
                htmlBody += '<td style="padding:10px; border-bottom:1px solid #e0e0e0; color:#333;">' + doc.Name.escapeHtml4() + '</td>';
                htmlBody += '</tr>';
            }
            htmlBody += '</tbody></table>';

            // Signature Section
            htmlBody += '<div style="margin-top:40px; text-align:center; color:#333;">';
            htmlBody += '<p style="margin:0; font-weight:bold; font-size:16px;">' + recordOwner.Name + '</p>';
            htmlBody += '<p style="margin:0; font-size:14px;">Record Owner</p>';
            htmlBody += '<p style="font-size:14px; margin-top:10px; line-height:1.6;">';
            htmlBody += '<a href="mailto:' + recordOwner.Email + '" style="color:#32b2e0;">Email Me</a>';
            htmlBody += '</p></div>';

            htmlBody += '</div></body></html>';

            // Create and send email
            Messaging.SingleEmailMessage emailMsg = new Messaging.SingleEmailMessage();
            emailMsg.setToAddresses(new List<String>{recipientEmail});
            emailMsg.setSubject('Your Document(s) are Ready to Review');
            emailMsg.setHtmlBody(htmlBody);
            emailMsg.setSaveAsActivity(true);
            emailMsg.setOrgWideEmailAddressId(getOrgWideEmailAddress()); // Optional: Use org-wide email address
            
            Messaging.SendEmailResult[] results = Messaging.sendEmail(new List<Messaging.SingleEmailMessage>{emailMsg}, false);
            
            if (results[0].isSuccess()) {
                return new GenericResponseWrapper(true, 'Email sent successfully to ' + recipientEmail);
            } else {
                return new GenericResponseWrapper(false, 'Failed to send email: ' + results[0].getErrors()[0].getMessage());
            }
        } catch (Exception ex) {
            return new GenericResponseWrapper(false, 'Error sending email: ' + ex.getMessage());
        }
    }

    // Helper method to get org-wide email address ID (optional)
    private static Id getOrgWideEmailAddress() {
        List<OrgWideEmailAddress> orgWideEmails = [
            SELECT Id FROM OrgWideEmailAddress 
            WHERE IsAllowAllProfiles = true 
            LIMIT 1
        ];
        return !orgWideEmails.isEmpty() ? orgWideEmails[0].Id : null;
    }

    // ==================== Section 6: Wrapper Classes ====================

    /**
     * 6.1 Wrapper class for document details.
     */
    public class DocumentItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String categoryId { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String team { get; set; }
        @AuraEnabled public String assignedTo { get; set; }
        @AuraEnabled public String ownerId { get; set; }
        @AuraEnabled public String ownerName { get; set; }
        @AuraEnabled public String templateId { get; set; }
        @AuraEnabled public String categoryName { get; set; }
        @AuraEnabled public String assignedToEmail  { get; set; }
        @AuraEnabled public Boolean isArchived  { get; set; }
        
    }

    /**
     * 6.2 Wrapper class for input parameters when creating a document.
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
     * 6.3 Wrapper class to return document-related results.
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
     * 6.4 Wrapper class for document categories.
     */
    public class DocumentCategory {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * 6.5 Wrapper class for template details.
     */
    public class TemplateItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * 6.6 Wrapper class for template information.
     */
    public class TemplateInfo {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * 6.7 Wrapper class for template categories with a single template.
     */
    public class TemplateCategory {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public TemplateInfo template { get; set; }
    }

    /**
     * 6.8 Wrapper class for input parameters when creating a template.
     */
    public class TemplateInputWrapper {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String templateName;
        @AuraEnabled public List<Document__c> documents;
    }

    /**
     * 6.9 Wrapper class for template details with associated documents.
     */
    public class TemplateWrapper {
        @AuraEnabled public Id id;
        @AuraEnabled public String name;
        @AuraEnabled public List<DocumentItem> documents;
    }

    /**
     * 6.10 Generic wrapper for all string responses (status, errors).
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