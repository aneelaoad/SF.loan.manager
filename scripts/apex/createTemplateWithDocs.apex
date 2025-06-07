/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-07-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
// 1. Create Categories
List<Doc_Category__c> allCategories = new List<Doc_Category__c>{
    // Template-only categories
    new Doc_Category__c(Name = 'Standard', Type__c = 'Template'),
    new Doc_Category__c(Name = 'Required', Type__c = 'Template'),

    // Document-only categories
    new Doc_Category__c(Name = 'Income', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Credit', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Assets', Type__c = 'Document'),
    new Doc_Category__c(Name = 'Finance', Type__c = 'Document')

   
};
insert allCategories;

// Organize category references
Map<String, Id> templateCatMap = new Map<String, Id>();
Map<String, Id> documentCatMap = new Map<String, Id>();
Id bothCategoryId;

for (Doc_Category__c cat : allCategories) {
    if (cat.Type__c == 'Template') {
        templateCatMap.put(cat.Name, cat.Id);
    } else if (cat.Type__c == 'Document') {
        documentCatMap.put(cat.Name, cat.Id);
    } else if (cat.Type__c == 'Both') {
        bothCategoryId = cat.Id;
    }
}

// 2. Create Templates (name must match category name per Rule 1)
List<Doc_Template__c> templates = new List<Doc_Template__c>{
    new Doc_Template__c(Name = 'Standard', Category__c = templateCatMap.get('Standard'), Order__c = 1),
    new Doc_Template__c(Name = 'Required', Category__c = templateCatMap.get('Required'), Order__c = 2),

};
insert templates;

// Map template names to IDs
Map<String, Id> templateMap = new Map<String, Id>();
for (Doc_Template__c t : templates) {
    templateMap.put(t.Name, t.Id);
}

// 3. Create Documents (with categories = Document type only; Rule 2, 3, 5)
List<Document__c> documents = new List<Document__c>{
    // Documents under StandardIncome Template
    new Document__c(Name = 'Pay Stub', Type__c = 'Document', Status__c = 'Upcoming', Category__c = documentCatMap.get('Income'), Document_Template__c = templateMap.get('StandardIncome')),
    new Document__c(Name = 'Employer Letter', Type__c = 'Task', Status__c = 'Ready to Send', Category__c = documentCatMap.get('Income'), Document_Template__c = templateMap.get('StandardIncome')),

    // Documents under StandardCredit Template
    new Document__c(Name = 'Credit Report', Type__c = 'Document', Status__c = 'Submitted', Category__c = documentCatMap.get('Credit'), Document_Template__c = templateMap.get('StandardCredit')),
    new Document__c(Name = 'Credit Explanation Task', Type__c = 'Task', Status__c = 'Pending Review', Category__c = documentCatMap.get('Credit'), Document_Template__c = templateMap.get('StandardCredit')),

    // Documents under Combined Template (in category type = Both)
    new Document__c(Name = 'Assets Overview', Type__c = 'Document', Status__c = 'Upcoming', Category__c = documentCatMap.get('Assets'), Document_Template__c = templateMap.get('CombinedTemplate')),
    new Document__c(Name = 'Finance Summary', Type__c = 'Document', Status__c = 'Ready to Send', Category__c = documentCatMap.get('Finance'), Document_Template__c = templateMap.get('CombinedTemplate')),

    // Standalone documents in category type = Document (not part of template)
    new Document__c(Name = 'Tax Returns', Type__c = 'Document', Status__c = 'Ready to Send', Category__c = documentCatMap.get('Finance')),
    new Document__c(Name = 'Bank Statement', Type__c = 'Document', Status__c = 'Upcoming', Category__c = documentCatMap.get('Assets')),
    new Document__c(Name = 'Insurance Proof', Type__c = 'Document', Status__c = 'Submitted', Category__c = documentCatMap.get('Finance')),
    new Document__c(Name = 'Appraisal Task', Type__c = 'Task', Status__c = 'Pending Review', Category__c = documentCatMap.get('Assets')),

    
};
insert documents;

System.debug('✔ Templates and Documents created according to the specified 5 rules.');
