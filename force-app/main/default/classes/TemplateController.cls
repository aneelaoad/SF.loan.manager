/**
* @File Name : TemplateController.cls
* @Description :
* @Author :
* @Last Modified By :
* @Last Modified On : May 23, 2025
* @Modification Log :
*==============================================================================
* Ver | Date | Author | Modification
*==============================================================================
* 1.0 | May 23, 2025 |   | Initial Version
**/

public class TemplateController {

  @AuraEnabled(cacheable=true)
    public static List<Template__c> getTemplatesByCategory(String category) {
        return [
            SELECT Id, Name, Category__c 
            FROM Template__c 
            WHERE Category__c = :category 
            ORDER BY Name
        ];
    }

@AuraEnabled
public static Template__c createTemplate(String name, String category, String status) {
    if (String.isBlank(name) || String.isBlank(category)) {
        throw new AuraHandledException('Template Name and Category are required.');
    }

    Template__c newTemplate = new Template__c(
        Name = name,
        Category__c = category,
        Status__c = status
    );
    insert newTemplate;

    return newTemplate;
}

}