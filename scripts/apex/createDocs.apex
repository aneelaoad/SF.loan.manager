/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-05-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
 List<Document__c> documents = new List<Document__c>();
        
        // Create 10 document records with Type = Document only
        documents.add(new Document__c(
            Name = 'Annual Report 2023',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Company Policies Handbook',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Project Charter - Phoenix Initiative',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Meeting Minutes - Board Q2',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Product Requirements v2.1',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Security Audit Findings',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Employee Onboarding Guide',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Budget Proposal FY2024',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Client Contract - ABC Corp',
            Type__c = 'Document'
        ));
        
        documents.add(new Document__c(
            Name = 'Technical Specifications - X500',
            Type__c = 'Document'
        ));
        
        try {
            insert documents;
            System.debug('Successfully created ' + documents.size() + ' document records with Type = Document.');
        } catch(DmlException e) {
            System.debug('Error creating document records: ' + e.getMessage());
        }