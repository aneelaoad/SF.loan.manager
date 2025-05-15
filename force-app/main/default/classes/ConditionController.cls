public with sharing class ConditionController {
    @AuraEnabled(cacheable=true)
    public static ConditionWrapper.ConditionResponseDTO getConditionsByLoanId(String loanId) {
        try {
            Map<String, List<ConditionWrapper.ConditionDTO>> conditionsByStatus = new Map<String, List<ConditionWrapper.ConditionDTO>>();
            
            for (Cust_Loan_Condition__c condition : [
                SELECT Id, Name, Cust_Status__c, Cust_Type__c, Cust_Description__c,
                       Cust_Requested_Date__c, Cust_Condition_Satisfaction_Date__c,
                       Cust_Assigned_To__c, Cust_Can_Borrower_See__c, Cust_Notes__c
                FROM Cust_Loan_Condition__c
                WHERE Cust_Application__c = :loanId
                ORDER BY Cust_Status__c, Cust_Requested_Date__c
            ]) {
                String status = condition.Cust_Status__c;
                if (!conditionsByStatus.containsKey(status)) {
                    conditionsByStatus.put(status, new List<ConditionWrapper.ConditionDTO>());
                }
                conditionsByStatus.get(status).add(new ConditionWrapper.ConditionDTO(condition));
            }

            List<ConditionWrapper.ConditionGroupDTO> result = new List<ConditionWrapper.ConditionGroupDTO>();
            for (String status : conditionsByStatus.keySet()) {
                result.add(new ConditionWrapper.ConditionGroupDTO(
                    status, 
                    conditionsByStatus.get(status)
                ));
            }

            return new ConditionWrapper.ConditionResponseDTO(result);
        } catch (Exception e) {
            System.debug('Error occurred in getConditionsByLoanId: ' + e.getMessage());
            return new ConditionWrapper.ConditionResponseDTO(e);
        }
    }
	@AuraEnabled
public static ConditionWrapper.ConditionResponseDTO updateConditions(List<Cust_Loan_Condition__c> updatedConditions) {
    try {
        if (updatedConditions == null || updatedConditions.isEmpty()) {
            throw new AuraHandledException('No conditions to update');
        }

        for (Cust_Loan_Condition__c updated : updatedConditions) {
            Cust_Loan_Condition__c existing = [
                SELECT Id, Cust_Status__c 
                FROM Cust_Loan_Condition__c 
                WHERE Id = :updated.Id 
                LIMIT 1
            ];
            if (!isValidStatusTransition(existing.Cust_Status__c, updated.Cust_Status__c)) {
                throw new AuraHandledException('Invalid status transition for ' + updated.Id);
            }
        }

        update updatedConditions;
        return new ConditionWrapper.ConditionResponseDTO(new List<ConditionWrapper.ConditionGroupDTO>());
    } catch (Exception e) {
        return new ConditionWrapper.ConditionResponseDTO(e);
    }
}

    // @AuraEnabled
    // public static ConditionWrapper.ConditionResponseDTO updateCondition(Cust_Loan_Condition__c updatedCondition) {
    //     try {
    //         if (updatedCondition == null || String.isBlank(updatedCondition.Id)) {
    //             throw new AuraHandledException('Condition ID is missing');
    //         }

    //         Cust_Loan_Condition__c oldCondition = [
    //             SELECT Id, Cust_Status__c 
    //             FROM Cust_Loan_Condition__c 
    //             WHERE Id = :updatedCondition.Id
    //             LIMIT 1
    //         ];

    //         if (!isValidStatusTransition(oldCondition.Cust_Status__c, updatedCondition.Cust_Status__c)) {
    //             throw new AuraHandledException('Invalid status transition');
    //         }

    //         update updatedCondition;
    //         return new ConditionWrapper.ConditionResponseDTO(new List<ConditionWrapper.ConditionGroupDTO>());
    //     } catch (Exception e) {
    //         System.debug('Error occurred in updateCondition: ' + e.getMessage());
    //         return new ConditionWrapper.ConditionResponseDTO(e);
    //     }
    // }

    private static Boolean isValidStatusTransition(String oldStatus, String newStatus) {
        if (oldStatus == 'Cleared' && newStatus != 'Cleared') return false;
        if (oldStatus == 'Rejected' && newStatus == 'Pending') return false;
        return true;
    }
}