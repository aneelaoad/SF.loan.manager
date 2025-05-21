/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-21-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class LoanConditionTemplateController {

    @AuraEnabled
    public static Id createConditionTemplate(
        String itemName,
        String category,
        String comments,
        String defaultStatus
    ) {
        // Validate required fields
        if (String.isBlank(itemName) || String.isBlank(category)) {
            throw new AuraHandledException('Item Name and Category are required.');
        }

        Cust_Loan_Condition_Reference__c template = new Cust_Loan_Condition_Reference__c(
            Item_Name__c = itemName,
            Cust_Condition_Category__c = category,
            Cust_Borrower_Description__c = comments,
            Cust_Type__c = defaultStatus
        );

        insert template;

        return template.Id;
    }
}
