public with sharing class DocumentTemplateController {

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

    // Wrapper class to return document-related results
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

    // Generic wrapper for all string responses (status, errors)
    public class GenericResponseWrapper {
        @AuraEnabled public Boolean success;
        @AuraEnabled public String message;

        public GenericResponseWrapper(Boolean success, String message) {
            this.success = success;
            this.message = message;
        }
    }

    public class TemplateInputWrapper {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String templateName;
        @AuraEnabled public List<Document__c> documents;
    }

    public class DocumentInputWrapper {
        @AuraEnabled public Id categoryId;
        @AuraEnabled public String name;
        @AuraEnabled public String status;
        @AuraEnabled public String team;
        @AuraEnabled public String objectName;
        @AuraEnabled public Id assignedToId;
        @AuraEnabled public Id relatedTo;

    }

    /**
     * Create or update a document template and sync documents.
     */
    @AuraEnabled
    public static GenericResponseWrapper createOrUpdateTemplate(TemplateInputWrapper input) {
        System.debug('--- START createOrUpdateTemplate ---');
        System.debug('Input: ' + JSON.serialize(input));

        try {
            if (input == null || input.categoryId == null || String.isBlank(input.templateName)) {
                throw new AuraHandledException('Category and template name are required.');
            }

            Doc_Template__c template;
            Boolean isUpdate = false;

            // Check if template already exists
            List<Doc_Template__c> existingTemplates = [
                SELECT Id FROM Doc_Template__c
                WHERE Category__c = :input.categoryId AND Name = :input.templateName
                LIMIT 1
            ];

            if (!existingTemplates.isEmpty()) {
                template = existingTemplates[0];
                isUpdate = true;
                System.debug('Updating existing template: ' + template.Id);
            } else {
                template = new Doc_Template__c(Name = input.templateName, Category__c = input.categoryId);
                insert template;
                System.debug('Created new template: ' + template.Id);
            }

            // Fetch documents under this template
            List<Document__c> existingDocs = [
                SELECT Id, Name FROM Document__c
                WHERE Document_Template__c = :template.Id
            ];

            Map<String, Document__c> existingMap = new Map<String, Document__c>();
            for (Document__c doc : existingDocs) {
                existingMap.put(doc.Name, doc);
            }

            List<Document__c> toUpsert = new List<Document__c>();
            Set<String> incomingNames = new Set<String>();

            for (Document__c incoming : input.documents) {
                incomingNames.add(incoming.Name);
                Document__c existing = existingMap.get(incoming.Name);
                if (existing != null) {
                    existing.Status__c = incoming.Status__c;
                    existing.Team__c = incoming.Team__c;
                    existing.Assigned_To__c = incoming.Assigned_To__c;
                    toUpsert.add(existing);
                    System.debug('Updating document: ' + existing.Name);
                } else {
                    Document__c newDoc = new Document__c(
                        Name = incoming.Name,
                        Document_Template__c = template.Id,
                        Category__c = input.categoryId,
                        Status__c = incoming.Status__c,
                        Team__c = incoming.Team__c,
                        Assigned_To__c = incoming.Assigned_To__c
                    );
                    toUpsert.add(newDoc);
                    System.debug('Adding new document: ' + incoming.Name);
                }
            }

            List<Document__c> toDelete = new List<Document__c>();
            for (Document__c doc : existingDocs) {
                if (!incomingNames.contains(doc.Name)) {
                    toDelete.add(doc);
                    System.debug('Deleting document: ' + doc.Name);
                }
            }

            if (!toDelete.isEmpty()) delete toDelete;
            if (!toUpsert.isEmpty()) upsert toUpsert;

            System.debug('--- END createOrUpdateTemplate ---');
            return new GenericResponseWrapper(true, isUpdate ? 'Template updated successfully.' : 'Template created successfully.');
        } catch (Exception e) {
            System.debug('ERROR in createOrUpdateTemplate: ' + e.getMessage());
            return new GenericResponseWrapper(false, 'Error: ' + e.getMessage());
        }
    }

    /**
     * Create a new single document.
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
            Assigned_To__c = input.assignedToId
        );
        insert doc;
        System.debug('Inserted Document: ' + doc.Id);

        // Create the Document_Assignment__c junction record
        if (input.objectName == 'Lead' || input.objectName == 'Opportunity') {
            Document_Assignment__c assignment = new Document_Assignment__c();
            assignment.Document__c = doc.Id;

            if (input.objectName == 'Lead') {
                assignment.Lead__c = input.assignedToId;
                System.debug('Assigned to Lead: ' + input.assignedToId);
            } else if (input.objectName == 'Loan') {
                assignment.Loan__c = input.assignedToId;
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
 * Fetch documents by category, using template or direct mapping.
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

    // ================= Helper Category/Template Methods =====================

    /**
     * Fetch all categories with Type = 'Template'
     */
   // Simplified wrapper class for single-template scenario
public class TemplateCategory {
    @AuraEnabled public String id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public TemplateInfo template { get; set; } // Single template instead of list
}

// Template info wrapper remains the same
public class TemplateInfo {
    @AuraEnabled public String id { get; set; }
    @AuraEnabled public String name { get; set; }
}

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

    

   public class DocumentCategory {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

    /**
     * Fetch all Doc_Category__c records where Type__c = 'Document'
     * and return them with camelCase fields.
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

    // Wrapper for templates
    public class TemplateItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String name { get; set; }
    }

   

    /**
     * Fetch all templates under a given category.
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

    /**
     * Fetch all documents for a specific template.
     */
    @AuraEnabled(cacheable=true)
    public static List<DocumentItem> getDocumentsByTemplate(Id templateId) {
        if (String.isBlank(templateId)) {
            throw new AuraHandledException('Template Id is required.');
        }

        System.debug('Fetching documents for template: ' + templateId);

        List<Document__c> rawDocs = [
            SELECT Id, Name, Category__c, Status__c,Category__r.Name, Team__c, Assigned_To__c, OwnerId, Document_Template__c 
            FROM Document__c 
            WHERE Document_Template__c = :templateId 
            ORDER BY Name
        ];
        System.debug('rawDocs: ' + rawDocs);

        List<DocumentItem> result = new List<DocumentItem>();
        for (Document__c d : rawDocs) {
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
        }
        System.debug('result: ' + result);

        return result;
    }
/**
 * Fetch all documents and return them wrapped in DocumentItem.
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

public class TemplateWrapper {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    @AuraEnabled public List<DocumentItem> documents;
}


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

    // === 1. Update Template Name ===
    Doc_Template__c templateToUpdate = [SELECT Id, Name, Category__r.Id, Category__r.Name  FROM Doc_Template__c WHERE Id = :templateId LIMIT 1];

// Fetch the template and its parent category


// Update parent category's name if it exists
if (templateToUpdate.Category__r != null) {
    Doc_Category__c parentCategory = new Doc_Category__c(
        Id = templateToUpdate.Category__r.Id,
        Name = newTemplateName
    );
    update parentCategory;
}

    if (String.isNotBlank(newTemplateName) && newTemplateName != templateToUpdate.Name) {
        templateToUpdate.Name = newTemplateName;
        update templateToUpdate;
    }
    System.Debug('templateToUpdate: '+templateToUpdate);
    // === 2. Add New Documents to Template ===
    if (!newItemIds.isEmpty()) {
        List<Document__c> docsToUpdate = [
            SELECT Id, Document_Template__c FROM Document__c WHERE Id IN :newItemIds
        ];
        for (Document__c doc : docsToUpdate) {
            doc.Document_Template__c = templateId;
        }
    System.Debug('docsToUpdate: '+docsToUpdate);

        update docsToUpdate;
    }

    // === 3. Remove Documents from Template ===
    if (!deletedItemIds.isEmpty()) {
        List<Document__c> docsToClear = [
            SELECT Id, Document_Template__c FROM Document__c WHERE Id IN :deletedItemIds
        ];
        for (Document__c doc : docsToClear) {
            doc.Document_Template__c = null;
        }
        update docsToClear;
    System.Debug('docsToClear: '+docsToClear);

    }

    // === 4. Return Updated Template Wrapper ===
    TemplateWrapper updatedWrapper = new TemplateWrapper();
    updatedWrapper.id = templateToUpdate.Id;
    updatedWrapper.name = templateToUpdate.Name;
    updatedWrapper.documents = getDocumentsByTemplate(templateToUpdate.Id);
    return updatedWrapper;
}
// @AuraEnabled
// public static TemplateWrapper createTemplateWithDocuments(
//     String templateName,
   
//     List<Id> documentIds
// ) {
//     if (String.isBlank(templateName)) {
//         throw new AuraHandledException('Template name is required.');
//     }
  

//     // === 1. Create New Template ===
//     Doc_Template__c newTemplate = new Doc_Template__c(
//         Name = templateName
        
//     );
//     insert newTemplate;
//     System.debug('newTemplate: '+newTemplate);

//     // === 2. Assign Documents to New Template ===
//     if (documentIds != null && !documentIds.isEmpty()) {
//         List<Document__c> docsToAssign = [
//             SELECT Id, Document_Template__c
//             FROM Document__c
//             WHERE Id IN :documentIds
//         ];
//         for (Document__c doc : docsToAssign) {
//             doc.Document_Template__c = newTemplate.Id;
//         }
//         update docsToAssign;
//     }

//     // === 3. Return New Template Wrapper ===
//     TemplateWrapper wrapper = new TemplateWrapper();
//     wrapper.id = newTemplate.Id;
//     wrapper.name = newTemplate.Name;
//     wrapper.documents = getDocumentsByTemplate(newTemplate.Id);
//     System.debug('wrapper: '+wrapper);
//     return wrapper;
// }

@AuraEnabled
public static TemplateWrapper createTemplateWithDocuments(
    String templateName,
    List<Id> documentIds
) {
    if (String.isBlank(templateName)) {
        throw new AuraHandledException('Template name is required.');
    }

    // === 1. Create Category__c Record ===
    Doc_Category__c newCategory = new Doc_Category__c(
        Name = templateName,
        Type__c = 'Template'
    );
    insert newCategory;

    // === 2. Create New Doc_Template__c Record ===
    Doc_Template__c newTemplate = new Doc_Template__c(
        Name = templateName,
        Category__c = newCategory.Id
    );
    insert newTemplate;

    // === 3. Assign Documents to New Template ===
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

    // === 4. Return New Template Wrapper ===
    TemplateWrapper wrapper = new TemplateWrapper();
    wrapper.id = newTemplate.Id;
    wrapper.name = newTemplate.Name;
    wrapper.documents = getDocumentsByTemplate(newTemplate.Id);
    return wrapper;
}

@AuraEnabled
public static DocumentItem assignDocumentToRecord(Id documentId, Id recordId, String objectName) {
    if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
        throw new AuraHandledException('Missing required parameters.');
    }
// Check if this document is already assigned to this record ID (Lead or Loan)
    List<Document_Assignment__c> existingAssignments = [
        SELECT Id FROM Document_Assignment__c
        WHERE Document__c = :documentId AND (Lead__c = :recordId OR Loan__c = :recordId)
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


// @AuraEnabled
// public static void assignDocumentToRecord(Id documentId, Id recordId, String objectName) {
//     if (String.isBlank(documentId) || String.isBlank(recordId) || String.isBlank(objectName)) {
//         throw new AuraHandledException('Missing required parameters.');
//     }

//     Document_Assignment__c assignment = new Document_Assignment__c();
//     assignment.Document__c = documentId;

//     if (objectName == 'Lead') {
//         assignment.Lead__c = recordId;
//     } else if (objectName == 'Opportunity') {
//         assignment.Loan__c = recordId; // assuming Loan__c is the custom field referring to Opportunity
//     } else {
//         throw new AuraHandledException('Unsupported object: ' + objectName);
//     }

//     insert assignment;
// }

	
    /**
     * Get all documents assigned to a specific record
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
                // item.assignedTo = assignment.Document__r.Assigned_To__r.Name;
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
}