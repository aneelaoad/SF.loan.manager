public with sharing class DocumentTemplateController {

    public class CategoryWrapper {
        @AuraEnabled public String masterLabel;
        @AuraEnabled public String developerName;
        @AuraEnabled public String description;
        @AuraEnabled public String icon;
        @AuraEnabled public String colorClass;
    }

    public class TemplateCreationResult {
        @AuraEnabled public Id templateId;
        @AuraEnabled public String templateName;
        @AuraEnabled public Id itemId;
        @AuraEnabled public String itemName;
    }

    // 🆕 1. Create a template folder only
    @AuraEnabled
    public static Id createTemplateFolder(String templateName, String category, String appliesTo) {
        System.debug('Creating Template Folder');
        System.debug('Template Name: ' + templateName);
        System.debug('Category: ' + category);
        System.debug('Applies To: ' + appliesTo);

        List<Allowed_Template_Category__mdt> allowedCategories = [
            SELECT MasterLabel FROM Allowed_Template_Category__mdt WHERE MasterLabel = :category
        ];
        System.debug('Allowed Categories Found: ' + allowedCategories.size());

        if (allowedCategories.isEmpty()) {
            System.debug('Invalid template category: ' + category);
            throw new AuraHandledException('Invalid template category');
        }

        Document_Template__c template = new Document_Template__c(
            Name = templateName,
            Category__c = category,
            Applies_To__c = appliesTo,
            Is_Active__c = true
        );
        insert template;

        System.debug('Template Folder Created with ID: ' + template.Id);
        return template.Id;
    }

    // ✅ 2. Create a document item (in a folder)
    @AuraEnabled
    public static TemplateCreationResult createTemplateAndItem(String templateName, String category, String appliesTo, String itemName, String team, String status) {
        System.debug('Creating Template and Item');
        System.debug('Inputs -> Template: ' + templateName + ', Category: ' + category + ', AppliesTo: ' + appliesTo + ', Item: ' + itemName + ', Team: ' + team + ', Status: ' + status);

        Id templateId = createTemplateFolder(templateName, category, appliesTo);
        System.debug('Template Folder ID: ' + templateId);

        Document_Template_Item__c item = new Document_Template_Item__c(
            Name = itemName,
            Document_Template__c = templateId,
            Team__c = team,
            Status__c = status,
            Category__c = category
        );
        insert item;
        System.debug('Document Item Created with ID: ' + item.Id);

        TemplateCreationResult result = new TemplateCreationResult();
        result.templateId = templateId;
        result.templateName = templateName;
        result.itemId = item.Id;
        result.itemName = item.Name;

        return result;
    }

    // ✅ 3. Create a document item directly (without template)
    @AuraEnabled
    public static Id createItemDirectly(String itemName, String category, String team, String status) {
        System.debug('Creating Item Directly');
        System.debug('Inputs -> Item: ' + itemName + ', Category: ' + category + ', Team: ' + team + ', Status: ' + status);

        List<Allowed_Document_Category__mdt> allowedCategories = [
            SELECT MasterLabel FROM Allowed_Document_Category__mdt WHERE MasterLabel = :category
        ];
        System.debug('Allowed Document Categories Found: ' + allowedCategories.size());

        if (allowedCategories.isEmpty()) {
            System.debug('Invalid document category: ' + category);
            throw new AuraHandledException('Invalid document category');
        }

        Document_Template_Item__c item = new Document_Template_Item__c(
            Name = itemName,
            Team__c = team,
            Status__c = status,
            Category__c = category
        );
        insert item;
        System.debug('Item Created with ID: ' + item.Id);
        return item.Id;
    }

    // ✅ 4. Fetch allowed template categories
    @AuraEnabled(cacheable=true)
    public static List<CategoryWrapper> getAllowedTemplateCategories() {
        System.debug('Fetching Allowed Template Categories');
        List<Allowed_Template_Category__mdt> categories = [SELECT MasterLabel, DeveloperName FROM Allowed_Template_Category__mdt];
        System.debug('Total Template Categories Retrieved: ' + categories.size());

        List<CategoryWrapper> results = new List<CategoryWrapper>();
        for (Allowed_Template_Category__mdt cat : categories) {
            CategoryWrapper wrapper = new CategoryWrapper();
            wrapper.masterLabel = cat.MasterLabel;
            wrapper.developerName = cat.DeveloperName;
            results.add(wrapper);
        }
        return results;
    }

    // ✅ 5. Fetch allowed document categories
    @AuraEnabled(cacheable=true)
    public static List<CategoryWrapper> getAllowedDocumentCategories() {
        System.debug('Fetching Allowed Document Categories');
        List<Allowed_Document_Category__mdt> categories = [
            SELECT MasterLabel, DeveloperName, Description__c, Icon__c, ColorClass__c
            FROM Allowed_Document_Category__mdt
        ];
        System.debug('Total Document Categories Retrieved: ' + categories.size());

        List<CategoryWrapper> results = new List<CategoryWrapper>();
        for (Allowed_Document_Category__mdt cat : categories) {
            CategoryWrapper wrapper = new CategoryWrapper();
            wrapper.masterLabel = cat.MasterLabel;
            wrapper.developerName = cat.DeveloperName;
            wrapper.description = cat.Description__c;
            wrapper.icon = cat.Icon__c;
            wrapper.colorClass = cat.ColorClass__c;
            results.add(wrapper);
        }
        return results;
    }

      // ✅ 6. 
    @AuraEnabled(cacheable=true)
public static List<Document_Template_Item__c> getItemsByDocumentCategory(String category) {
    return [
        SELECT Id, Name, Category__c, Status__c, Team__c
        FROM Document_Template_Item__c
        WHERE Category__c = :category AND Document_Template__c = null
        ORDER BY Name
    ];
}
   // ✅ 7. 

@AuraEnabled(cacheable=true)
public static List<Document_Template_Item__c> getItemsByTemplateCategory(String templateCategory) {
    return [
        SELECT Id, Name, Category__c, Status__c, Team__c, Document_Template__c,
               Document_Template__r.Name
        FROM Document_Template_Item__c
        WHERE Document_Template__r.Category__c = :templateCategory
        ORDER BY Document_Template__r.Name, Name
    ];
}

@AuraEnabled(cacheable=true)
public static List<Document_Template_Item__c> getItemsByTemplateId(Id templateId) {
    return [
        SELECT Id, Name, Category__c, Status__c, Team__c
        FROM Document_Template_Item__c
        WHERE Document_Template__c = :templateId
        ORDER BY Name
    ];
}

}