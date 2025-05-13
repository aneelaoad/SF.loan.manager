/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-12-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class MilestoneMarkerController {
    public MilestoneMarkerController() {

    }
      
    @AuraEnabled(cacheable=true)
    public static List<Milestone_Maker__c> getMilestones(Id loanId) {
        return [
            SELECT Id, Name, Order__c
            FROM Milestone_Maker__c
            WHERE Loan__c = :loanId
            ORDER BY Order__c ASC
        ];
    }

    @AuraEnabled(cacheable=true)
    public static List<Milestone_Recipient__c> getRecipients(Id loanId) {
        return [
            SELECT Id, Name, Email__c, Type__c, Channel__c
            FROM Milestone_Recipient__c
            WHERE Loan__c = :loanId
        ];
    }

    @AuraEnabled
    public static Milestone_Recipient__c addRecipient(Milestone_Recipient__c recipient) {
        insert recipient;
        return recipient;
    }
}