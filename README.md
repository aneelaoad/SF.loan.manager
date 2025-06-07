# Salesforce Document Management Data Model

Document Object (Document__c)
Description: Central object for managing documents in the system with tracking of status, type, and related entities.

Fields
Field Name	API Name	Data Type	Description	Values/Options
Name	Name	Text(80)	Name of the document	
Type	Type__c	Picklist	Classification of document	Document, Task
Status	Status__c	Picklist	Current state of document	Upcoming, Pending Review, Completed, Sent, Ready to Send, Submitted
Assigned To	Assigned_To__c	Lookup(User)	User responsible for the document	
Category	Category__c	Lookup(Category__c)	Document category	
Created By	CreatedById	Lookup(User)	User who created (system)	
Last Modified By	LastModifiedById	Lookup(User)	User who last edited (system)	
Document Template	Document_Template__c	Lookup(Template__c)	Template used	
Loan	Loan__c	Lookup(Opportunity)	Related loan opportunity	
Owner	OwnerId	Lookup(User)	Record owner	
Related Contact	Related_Contact__c	Lookup(Contact)	Associated contact	
Team	Team__c	Text(255)	Team association