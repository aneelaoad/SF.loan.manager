/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-09-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
// 1. Create categories
List<Doc_Category__c> allCategories = new List<Doc_Category__c>{
    new Doc_Category__c(Name = 'Standard', Type__c = 'Template'),
    new Doc_Category__c(Name = 'Required', Type__c = 'Template'),
    new Doc_Category__c(Name = 'Income', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Credit', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Assets', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Finance', Type__c = 'Document')
};
insert allCategories;

// 2. Categorize
Map<String, Id> templateCatMap = new Map<String, Id>();
Map<String, Id> documentCatMap = new Map<String, Id>();

for (Doc_Category__c cat : allCategories) {
    if (cat.Type__c == 'Template') {
        templateCatMap.put(cat.Name, cat.Id);
    } else if (cat.Type__c == 'Document') {
        documentCatMap.put(cat.Name, cat.Id);
    }
}

// 3. Create templates
List<Doc_Template__c> templates = new List<Doc_Template__c>{
    new Doc_Template__c(Name = 'StandardIncome', Category__c = templateCatMap.get('Standard'), Order__c = 1),
    new Doc_Template__c(Name = 'StandardCredit', Category__c = templateCatMap.get('Standard'), Order__c = 2),
    new Doc_Template__c(Name = 'Required', Category__c = templateCatMap.get('Required'), Order__c = 3)
};
insert templates;

// 4. Map templates
Map<String, Id> templateMap = new Map<String, Id>();
for (Doc_Template__c t : templates) {
    templateMap.put(t.Name, t.Id);
}

// 5. Create documents
List<Document__c> documents = new List<Document__c>{
    // StandardIncome
    new Document__c(Name = 'Pay Stub', Type__c = 'Document', Status__c = 'Upcoming', Category__c = documentCatMap.get('Income'), Document_Template__c = templateMap.get('StandardIncome')),
    new Document__c(Name = 'Employer Letter', Type__c = 'Task', Status__c = 'Ready to Send', Category__c = documentCatMap.get('Income'), Document_Template__c = templateMap.get('StandardIncome')),

    // StandardCredit
    new Document__c(Name = 'Credit Report', Type__c = 'Document', Status__c = 'Submitted', Category__c = documentCatMap.get('Credit'), Document_Template__c = templateMap.get('StandardCredit')),
    new Document__c(Name = 'Credit Explanation Task', Type__c = 'Task', Status__c = 'Pending Review', Category__c = documentCatMap.get('Credit'), Document_Template__c = templateMap.get('StandardCredit')),

    // Standalone (no template)
    new Document__c(Name = 'Tax Returns', Type__c = 'Document', Status__c = 'Ready to Send', Category__c = documentCatMap.get('Finance')),
    new Document__c(Name = 'Bank Statement', Type__c = 'Document', Status__c = 'Upcoming', Category__c = documentCatMap.get('Assets')),
    new Document__c(Name = 'Insurance Proof', Type__c = 'Document', Status__c = 'Submitted', Category__c = documentCatMap.get('Finance')),
    new Document__c(Name = 'Appraisal Task', Type__c = 'Task', Status__c = 'Pending Review', Category__c = documentCatMap.get('Assets'))
};
insert documents;

System.debug('✔ Templates and Documents created according to the specified rules.');
