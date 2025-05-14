/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-14-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class MilestoneMarkerController {

    public MilestoneMarkerController() {}

    // Wrapper for Recipients
    public class RecipientWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public String email { get; set; }
        @AuraEnabled public String type { get; set; }
        @AuraEnabled public String channel { get; set; }

        public RecipientWrapper(Cust_Milestone_Recipient__c rec) {
            this.id = rec.Id;
            this.name = rec.Name;
            this.email = rec.Email__c;
            this.type = rec.Type__c;
            this.channel = rec.Channel__c;
        }
    }

    // Wrapper for Milestone with nested recipients
    public class MilestoneWrapper {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Decimal order { get; set; }
        @AuraEnabled public List<RecipientWrapper> recipients { get; set; }

        public MilestoneWrapper(Cust_Milestone_Marker__c marker) {
            this.id = marker.Id;
            this.name = marker.Name;
            this.order = marker.Order__c;
            this.recipients = new List<RecipientWrapper>();
            for (Cust_RecipientMarkerAssociation__c assoc : marker.Recipient_Marker_Associations__r) {
                Cust_Milestone_Recipient__c rec = assoc.Milestone_Recipient__r;
                this.recipients.add(new RecipientWrapper(rec));
            }
        }
    }

    // ✅ Get Milestones
    @AuraEnabled(cacheable=true)
    public static List<Cust_Milestone_Marker__c> getMilestones(Id loanId) {
        return [
            SELECT Id, Name, Order__c
            FROM Cust_Milestone_Marker__c
            WHERE Loan__c = :loanId
            ORDER BY Order__c ASC
        ];
    }

    // ✅ Get Recipients (wrapped)
    @AuraEnabled(cacheable=true)
    public static List<RecipientWrapper> getRecipients(Id loanId) {
        List<Cust_Milestone_Recipient__c> rawRecipients = [
            SELECT Id, Name, Email__c, Type__c, Channel__c
            FROM Cust_Milestone_Recipient__c
            // WHERE Loan__c = :loanId
        ];

        List<RecipientWrapper> result = new List<RecipientWrapper>();
        for (Cust_Milestone_Recipient__c rec : rawRecipients) {
            result.add(new RecipientWrapper(rec));
        }
        return result;
    }

    // ✅ Add Recipient
    @AuraEnabled
    public static RecipientWrapper addRecipient(String jsonData) {
        try {
            Map<String, Object> dto = (Map<String, Object>) JSON.deserializeUntyped(jsonData);

            String name = (String) dto.get('name');
            String email = (String) dto.get('email');
            String type = (String) dto.get('type');
            String channel = (String) dto.get('channel');
            Id loanId = (Id) dto.get('loan');

            if (String.isBlank(name) || String.isBlank(email) || loanId == null) {
                throw new AuraHandledException('Missing required fields: name, email, or loan.');
            }

            Cust_Milestone_Recipient__c recipient = new Cust_Milestone_Recipient__c(
                Name = name,
                Email__c = email,
                Type__c = type,
                Channel__c = channel
            );
            insert recipient;

            List<Cust_Milestone_Marker__c> markers = [
                SELECT Id FROM Cust_Milestone_Marker__c
                WHERE Loan__c = :loanId
            ];

            List<Cust_RecipientMarkerAssociation__c> associations = new List<Cust_RecipientMarkerAssociation__c>();
            for (Cust_Milestone_Marker__c marker : markers) {
                associations.add(new Cust_RecipientMarkerAssociation__c(
                    Milestone_Recipient__c = recipient.Id,
                    Milestone_Marker__c = marker.Id
                ));
            }
            insert associations;

            return new RecipientWrapper(recipient);
        } catch (Exception e) {
            throw new AuraHandledException('Error adding recipient: ' + e.getMessage());
        }
    }

    // ✅ Get Milestones With Recipients (wrapped)
    @AuraEnabled(cacheable=true)
    public static List<MilestoneWrapper> getMilestonesWithRecipients(Id loanId) {
        List<Cust_Milestone_Marker__c> markers = [
            SELECT Id, Name, Order__c,
                (SELECT Id, Milestone_Recipient__r.Name, Milestone_Recipient__r.Email__c,
                        Milestone_Recipient__r.Type__c, Milestone_Recipient__r.Channel__c
                 FROM Recipient_Marker_Associations__r)
            FROM Cust_Milestone_Marker__c
            WHERE Loan__c = :loanId
            ORDER BY Order__c
        ];

        List<MilestoneWrapper> result = new List<MilestoneWrapper>();
        for (Cust_Milestone_Marker__c marker : markers) {
            result.add(new MilestoneWrapper(marker));
        }
        return result;
    }

    // ✅ Get Grid Data (wrapped)
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getMilestoneGridData(Id loanId) {
        List<MilestoneWrapper> milestones = getMilestonesWithRecipients(loanId);
        List<RecipientWrapper> recipients = getRecipients(loanId);
        System.Debug('milestones: '+milestones);
        System.Debug('recipients: '+recipients);
        return new Map<String, Object>{
            'milestones' => milestones,
            'recipients' => recipients
        };
    }

  // ✅ Update Recipient
@AuraEnabled
public static RecipientWrapper updateRecipient(Id recipientId, String jsonData) {
    System.debug('jsonData: ' + jsonData);

    if (recipientId == null) {
        throw new AuraHandledException('Recipient ID cannot be null.');
    }

    // Deserialize incoming JSON data into a Map
    Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(jsonData);
    System.debug('data: ' + data);

    // Query the recipient record based on the given recipientId
    Cust_Milestone_Recipient__c rec = [SELECT Id, Name, Email__c, Type__c, Channel__c 
                                       FROM Cust_Milestone_Recipient__c 
                                       WHERE Id = :recipientId LIMIT 1];

    // Update the fields if present in the incoming data
    if (data.containsKey('name')) rec.Name = (String) data.get('name');
    if (data.containsKey('email')) rec.Email__c = (String) data.get('email');
    if (data.containsKey('type')) rec.Type__c = (String) data.get('type');
    if (data.containsKey('channel')) rec.Channel__c = (String) data.get('channel');

    try {
        // Perform the DML update
        update rec;
    } catch (DmlException e) {
        throw new AuraHandledException('Error updating recipient: ' + e.getMessage());
    }

    // Return the updated recipient wrapped in a RecipientWrapper
    return new RecipientWrapper(rec);
}


    // ✅ Delete Recipient
    @AuraEnabled
    public static void deleteRecipient(Id recipientId) {
        List<Cust_RecipientMarkerAssociation__c> associationsToDelete = [
            SELECT Id FROM Cust_RecipientMarkerAssociation__c
            WHERE Milestone_Recipient__c = :recipientId
        ];
        delete associationsToDelete;

        delete [SELECT Id FROM Cust_Milestone_Recipient__c WHERE Id = :recipientId];
    }

    // ✅ Send Email
    @AuraEnabled
    public static void sendMilestoneEmail(Id milestoneId, Id recipientId) {
        Cust_Milestone_Marker__c milestone = [
            SELECT Name FROM Cust_Milestone_Marker__c WHERE Id = :milestoneId
        ];
        Cust_Milestone_Recipient__c recipient = [
            SELECT Email__c FROM Cust_Milestone_Recipient__c WHERE Id = :recipientId
        ];

        Messaging.SingleEmailMessage email = new Messaging.SingleEmailMessage();
        email.setToAddresses(new String[] { recipient.Email__c });
        email.setSubject('Milestone Reached: ' + milestone.Name);
        email.setPlainTextBody('The milestone "' + milestone.Name + '" has been reached.');
        Messaging.sendEmail(new Messaging.SingleEmailMessage[] { email });
    }
}