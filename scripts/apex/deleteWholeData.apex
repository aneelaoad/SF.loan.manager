/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-05-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
/ Delete all Doc_Template__c records
List<Doc_Template__c> templatesToDelete = [SELECT Id FROM Doc_Template__c];
delete templatesToDelete;

// Delete all Document__c records
List<Document__c> documentsToDelete = [SELECT Id FROM Document__c];
delete documentsToDelete;

// Delete all Category__c records
List<Doc_Category__c> categoriesToDelete = [SELECT Id FROM Doc_Category__c];
delete categoriesToDelete;
List<Document_Assignment__c> associatesToDelete = [SELECT Id FROM Document_Assignment__c];
delete associatesToDelete;
