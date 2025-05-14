public class MilestoneRecipientDTO {
    @AuraEnabled public Id Id { get; set; }
    @AuraEnabled public String name { get; set; }
    @AuraEnabled public String email { get; set; }
    @AuraEnabled public String type { get; set; }
    @AuraEnabled public String channel { get; set; }
    @AuraEnabled public Id loan { get; set; }
}