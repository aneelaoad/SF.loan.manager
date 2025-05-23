/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-23-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
 List<Template__c> templatesToInsert = new List<Template__c>();

        // Credit Templates
        templatesToInsert.add(new Template__c(Name = 'Loan Approval Criteria', Category__c = 'Credit'));
        templatesToInsert.add(new Template__c(Name = 'Credit Score Evaluation', Category__c = 'Credit'));
        templatesToInsert.add(new Template__c(Name = 'Interest Rate Calculation', Category__c = 'Credit'));
        templatesToInsert.add(new Template__c(Name = 'Collateral Assessment', Category__c = 'Credit'));
        templatesToInsert.add(new Template__c(Name = 'Debt-to-Income Ratio', Category__c = 'Credit'));

        // Income Templates
        templatesToInsert.add(new Template__c(Name = 'Income Verification', Category__c = 'Income'));
        templatesToInsert.add(new Template__c(Name = 'Tax Return Evaluation', Category__c = 'Income'));
        templatesToInsert.add(new Template__c(Name = 'Salary History Analysis', Category__c = 'Income'));
        templatesToInsert.add(new Template__c(Name = 'Bank Statement Review', Category__c = 'Income'));
        templatesToInsert.add(new Template__c(Name = 'Self-Employment Income Assessment', Category__c = 'Income'));

        // Asset Templates
        templatesToInsert.add(new Template__c(Name = 'Property Valuation', Category__c = 'Asset'));
        templatesToInsert.add(new Template__c(Name = 'Savings Account Verification', Category__c = 'Asset'));
        templatesToInsert.add(new Template__c(Name = 'Investment Portfolio Review', Category__c = 'Asset'));
        templatesToInsert.add(new Template__c(Name = 'Real Estate Asset Assessment', Category__c = 'Asset'));
        templatesToInsert.add(new Template__c(Name = 'Vehicle Asset Evaluation', Category__c = 'Asset'));

        // Disclosure Templates
        templatesToInsert.add(new Template__c(Name = 'Risk Disclosure Statement', Category__c = 'Disclosure'));
        templatesToInsert.add(new Template__c(Name = 'Legal Disclosure Form', Category__c = 'Disclosure'));
        templatesToInsert.add(new Template__c(Name = 'Conflict of Interest Disclosure', Category__c = 'Disclosure'));
        templatesToInsert.add(new Template__c(Name = 'Interest Rate Disclosure', Category__c = 'Disclosure'));
        templatesToInsert.add(new Template__c(Name = 'Privacy and Data Protection Disclosure', Category__c = 'Disclosure'));

        // Insert the templates
        insert templatesToInsert;
    }