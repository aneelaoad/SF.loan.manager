public with sharing class DocumentTemplateController {

   
    // Fetch allowed categories from metadata
    @AuraEnabled(cacheable=true)
    public static List<CategoryMetadataWrapper> getAllowedCategories() {
        System.debug('Fetching allowed categories from metadata...');

        List<Allowed_Document_Category__mdt> categoryMetadata = [
            SELECT MasterLabel, Description__c, Icon__c, ColorClass__c
            FROM Allowed_Document_Category__mdt
            ORDER BY MasterLabel
        ];

        List<CategoryMetadataWrapper> result = new List<CategoryMetadataWrapper>();
        for (Allowed_Document_Category__mdt cat : categoryMetadata) {
            CategoryMetadataWrapper wrapper = new CategoryMetadataWrapper();
            wrapper.label = cat.MasterLabel;
            wrapper.description = cat.Description__c;
            wrapper.icon = cat.Icon__c;
            wrapper.colorClass = cat.ColorClass__c;
            result.add(wrapper);
        }

        System.debug('Returning category metadata: ' + result);
        return result;
    }

    // Wrapper class to return metadata information
    public class CategoryMetadataWrapper {
        @AuraEnabled public String label;
        @AuraEnabled public String description;
        @AuraEnabled public String icon;
        @AuraEnabled public String colorClass;
    }

    // Fetch templates by category
    @AuraEnabled(cacheable=true)
    public static List<Document_Template__c> getTemplatesByCategory(String category) {
        System.debug('Fetching templates for category: ' + category);

        List<Document_Template__c> templates = [
            SELECT Id, Name, Description__c, Applies_To__c
            FROM Document_Template__c
            WHERE Category__c = :category
            AND Is_Active__c = TRUE
            ORDER BY Name
        ];

        System.debug('Fetched templates: ' + templates);
        return templates;
    }

    // Create a new template
    @AuraEnabled
    public static Document_Template__c createTemplate(String name, String category, String appliesTo) {
        System.debug('Creating template with name: ' + name + ', category: ' + category + ', appliesTo: ' + appliesTo);

        Document_Template__c newTemplate = new Document_Template__c(
            Name = name,
            Category__c = category,
            Applies_To__c = appliesTo,
            Is_Active__c = true
        );

        try {
            insert newTemplate;
            System.debug('Template created successfully: ' + newTemplate);
        } catch (DmlException e) {
            System.debug('Error creating template: ' + e.getMessage());
            throw new AuraHandledException('Error creating template: ' + e.getMessage());
        }

        return newTemplate;
    }

    // Fetch template items for a given template
    @AuraEnabled(cacheable=true)
    public static List<TemplateItemWrapper> getTemplateItems(Id templateId) {
        System.debug('Fetching template items for template Id: ' + templateId);

        List<Document_Template_Item__c> items = [
            SELECT Id, Name, Status__c, Assigned_To__r.Name, Team__c,
                   Document_Template__r.Category__c
            FROM Document_Template_Item__c
            WHERE Document_Template__c = :templateId
            ORDER BY Order__c
        ];

        List<TemplateItemWrapper> wrappers = new List<TemplateItemWrapper>();
        for (Document_Template_Item__c item : items) {
            TemplateItemWrapper wrapper = new TemplateItemWrapper();
            wrapper.id = item.Id;
            wrapper.name = item.Name;
            wrapper.status = item.Status__c;
            wrapper.owner = item.Assigned_To__r != null ? item.Assigned_To__r.Name : null;
            wrapper.team = item.Team__c;
            wrapper.category = item.Document_Template__r.Category__c;
            wrappers.add(wrapper);
        }

        System.debug('Returning wrapped items: ' + wrappers);
        return wrappers;
    }

    // Wrapper class for Template Items
    public class TemplateItemWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String status;
        @AuraEnabled public String owner;
        @AuraEnabled public String team;
        @AuraEnabled public String category;
    }

    // Create Record Documents based on template
    @AuraEnabled
    public static void createRecordDocumentsFromTemplate(Id templateId, Id recordId, String recordType) {
        System.debug('Creating record documents from template Id: ' + templateId + ', recordId: ' + recordId + ', recordType: ' + recordType);

        List<Document_Template_Item__c> items = [
            SELECT Id, Name, Status__c, Assigned_To__c, Team__c
            FROM Document_Template_Item__c
            WHERE Document_Template__c = :templateId
        ];

        System.debug('Fetched template items for record documents: ' + items);

        List<Record_Document__c> recordDocs = new List<Record_Document__c>();

        for (Document_Template_Item__c item : items) {
            System.debug('Processing item: ' + item);

            Record_Document__c doc = new Record_Document__c(
                Document_Template_Item__c = item.Id,
                Status__c = item.Status__c,
                Assigned_To__c = item.Assigned_To__c,
                Team__c = item.Team__c,
                Is_Completed__c = false
            );

            if (recordType == 'Lead') {
                doc.Lead__c = recordId;
            } else if (recordType == 'Opportunity') {
                doc.Loan__c = recordId;
            }

            recordDocs.add(doc);
        }

        try {
            insert recordDocs;
            System.debug('Record documents created successfully: ' + recordDocs);
        } catch (DmlException e) {
            System.debug('Error creating record documents: ' + e.getMessage());
            throw new AuraHandledException('Error creating documents: ' + e.getMessage());
        }
    }

//     @AuraEnabled(cacheable=true)
//     public static List<Document_Template_Category__c> getActiveCategories() {
//         System.debug('Fetching active categories...');
        
//         List<Document_Template_Category__c> categories = [
//             SELECT Id, Name, Description__c
//             FROM Document_Template_Category__c
//             WHERE Is_Active__c = TRUE
//             ORDER BY Name
//         ];
        
//         System.debug('Fetched categories: ' + categories);
//         return categories;
//     }

//     @AuraEnabled(cacheable=true)
//     public static List<Document_Template__c> getTemplatesByCategory(Id categoryId) {
//         System.debug('Fetching templates for category Id: ' + categoryId);
        
//         List<Document_Template__c> templates = [
//             SELECT Id, Name, Description__c, Applies_To__c
//             FROM Document_Template__c
//             WHERE Category__c = :categoryId
//             AND Is_Active__c = TRUE
//             ORDER BY Name
//         ];
        
//         System.debug('Fetched templates: ' + templates);
//         return templates;
//     }

//     @AuraEnabled
//     public static Document_Template__c createTemplate(String name, Id categoryId, String appliesTo) {
//         System.debug('Creating template with name: ' + name + ', categoryId: ' + categoryId + ', appliesTo: ' + appliesTo);
        
//         Document_Template__c newTemplate = new Document_Template__c(
//             Name = name,
//             Category__c = categoryId,
//             Applies_To__c = appliesTo,
//             Is_Active__c = true
//         );
        
//         try {
//             insert newTemplate;
//             System.debug('Template created successfully: ' + newTemplate);
//         } catch (DmlException e) {
//             System.debug('Error creating template: ' + e.getMessage());
//         }
        
//         return newTemplate;
//     }

// @AuraEnabled(cacheable=true)
// public static List<TemplateItemWrapper> getTemplateItems(Id templateId) {
//     System.debug('Fetching template items for template Id: ' + templateId);
    
//     List<Document_Template_Item__c> items = [
//         SELECT Id, Name, Status__c, Assigned_To__r.Name, Team__c,
//                Document_Template__r.Category__r.Name
//         FROM Document_Template_Item__c
//         WHERE Document_Template__c = :templateId
//         ORDER BY Order__c
//     ];

//     List<TemplateItemWrapper> wrappers = new List<TemplateItemWrapper>();
//     for (Document_Template_Item__c item : items) {
//         TemplateItemWrapper wrapper = new TemplateItemWrapper();
//         wrapper.id = item.Id;
//         wrapper.name = item.Name;
//         wrapper.status = item.Status__c;
//         wrapper.owner = item.Assigned_To__r != null ? item.Assigned_To__r.Name : null;
//         wrapper.team = item.Team__c;
//         wrapper.category = item.Document_Template__r.Category__r != null ? item.Document_Template__r.Category__r.Name : 'N/A';
//         wrappers.add(wrapper);
//     }

//     System.debug('Returning wrapped items: ' + wrappers);
//     return wrappers;
// }

// public class TemplateItemWrapper {
//     @AuraEnabled public String id;
//     @AuraEnabled public String name;
//     @AuraEnabled public String status;
//     @AuraEnabled public String owner;
//     @AuraEnabled public String team;
//     @AuraEnabled public String category;
// }

//     // @AuraEnabled(cacheable=true)
//     // public static List<Document_Template_Item__c> getTemplateItems(Id templateId) {
//     //     System.debug('Fetching template items for template Id: ' + templateId);
        
//     //     List<Document_Template_Item__c> items = [
//     //         SELECT Id, Name, Status__c, Assigned_To__c, Team__c
//     //         FROM Document_Template_Item__c
//     //         WHERE Document_Template__c = :templateId
//     //         ORDER BY Order__c
//     //     ];
        
//     //     System.debug('Fetched template items: ' + items);
//     //     return items;
//     // }

//     @AuraEnabled
//     public static void createRecordDocumentsFromTemplate(Id templateId, Id recordId, String recordType) {
//         System.debug('Creating record documents from template Id: ' + templateId + ', recordId: ' + recordId + ', recordType: ' + recordType);
        
//         List<Document_Template_Item__c> items = [
//             SELECT Id, Name, Status__c, Assigned_To__c, Team__c
//             FROM Document_Template_Item__c
//             WHERE Document_Template__c = :templateId
//         ];
        
//         System.debug('Fetched template items for record documents: ' + items);
        
//         List<Record_Document__c> recordDocs = new List<Record_Document__c>();
        
//         for (Document_Template_Item__c item : items) {
//             System.debug('Processing item: ' + item);
            
//             Record_Document__c doc = new Record_Document__c(
//                 Document_Template_Item__c = item.Id,
//                 Status__c = item.Status__c,
//                 Assigned_To__c = item.Assigned_To__c,
//                 Team__c = item.Team__c,
//                 Is_Completed__c = false
//             );
            
//             if (recordType == 'Lead') {
//                 doc.Lead__c = recordId;
//             } else if (recordType == 'Opportunity') {
//                 doc.Loan__c = recordId;
//             }

//             recordDocs.add(doc);
//         }
        
//         try {
//             insert recordDocs;
//             System.debug('Record documents created successfully: ' + recordDocs);
//         } catch (DmlException e) {
//             System.debug('Error creating record documents: ' + e.getMessage());
//         }
//     }
}