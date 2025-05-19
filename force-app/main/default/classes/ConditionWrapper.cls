public class ConditionWrapper {
    public class ConditionDTO {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String status;
        @AuraEnabled public String type;
        @AuraEnabled public String description;
        @AuraEnabled public Date requestedDate;
        @AuraEnabled public DateTime conditionSatisfactionDate;
        @AuraEnabled public String assignedTo;
        @AuraEnabled public Date eta;
        @AuraEnabled public String category;
        @AuraEnabled public Boolean includeInEmail;
        @AuraEnabled public Boolean canBorrowerSee;
        @AuraEnabled public String notes;

        public ConditionDTO(Cust_Loan_Condition__c condition) {
            this.id = condition.Id;
            this.name = condition.Name;
            this.status = condition.Cust_Status__c;
            this.type = condition.Cust_Type__c;
            this.description = condition.Cust_Description__c;
            this.requestedDate = condition.Cust_Requested_Date__c;
            this.conditionSatisfactionDate = condition.Cust_Condition_Satisfaction_Date__c;
            this.assignedTo = condition.Cust_Assigned_To__c;
            this.eta = condition.Cust_ETA__c;
            this.category = condition.Cust_Category__c;
            this.includeInEmail = condition.Cust_Include_In_Email__c;
            this.canBorrowerSee = condition.Cust_Can_Borrower_See__c;
            this.notes = condition.Cust_Notes__c;
        }
    }

    public class ConditionGroupDTO {
        @AuraEnabled public String status;
        @AuraEnabled public List<ConditionDTO> conditions;

        public ConditionGroupDTO(String status, List<ConditionDTO> conditions) {
            this.status = status;
            this.conditions = conditions;
        }
    }

    public class ConditionResponseDTO {
        @AuraEnabled public List<ConditionGroupDTO> groupedConditions;
        @AuraEnabled public String errorMessage;

        public ConditionResponseDTO(List<ConditionGroupDTO> groupedConditions) {
            this.groupedConditions = groupedConditions;
            this.errorMessage = null;
        }

        public ConditionResponseDTO(Exception ex) {
            this.groupedConditions = new List<ConditionGroupDTO>();
            this.errorMessage = ex.getMessage();
        }
    }
}