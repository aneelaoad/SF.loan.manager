public with sharing class ConditionController {

    @AuraEnabled(cacheable=true)
public static ConditionWrapper.ConditionResponseDTO getConditionsByLoanId(String loanId, String statusFilter) {
    System.debug('Entering getConditionsByLoanId method with loanId: ' + loanId + ', statusFilter: ' + statusFilter);

    try {
        Map<String, List<ConditionWrapper.ConditionDTO>> conditionsByStatus = new Map<String, List<ConditionWrapper.ConditionDTO>>();

        // Base query
        List<Cust_Loan_Condition__c> conditions;

        if (String.isNotBlank(statusFilter)) {
            System.debug('Filtering by status: ' + statusFilter);
            conditions = [
                SELECT Id, Name, Cust_Status__c, Cust_Type__c, Cust_Description__c,
                       Cust_Requested_Date__c, Cust_Condition_Satisfaction_Date__c,
                       Cust_Assigned_To__c, Cust_ETA__c, Cust_Category__c,
                       Cust_Include_In_Email__c, Cust_Can_Borrower_See__c, Cust_Notes__c
                FROM Cust_Loan_Condition__c
                WHERE Cust_Application__c = :loanId AND Cust_Status__c = :statusFilter
                ORDER BY Cust_Requested_Date__c
            ];
        } else {
            System.debug('No status filter provided. Querying all conditions.');
            conditions = [
                SELECT Id, Name, Cust_Status__c, Cust_Type__c, Cust_Description__c,
                       Cust_Requested_Date__c, Cust_Condition_Satisfaction_Date__c,
                       Cust_Assigned_To__c, Cust_ETA__c, Cust_Category__c,
                       Cust_Include_In_Email__c, Cust_Can_Borrower_See__c, Cust_Notes__c
                FROM Cust_Loan_Condition__c
                WHERE Cust_Application__c = :loanId
                ORDER BY Cust_Status__c, Cust_Requested_Date__c
            ];
        }

    System.debug('conditions: ' +conditions);

        // Group conditions
        for (Cust_Loan_Condition__c condition : conditions) {
            String status = condition.Cust_Status__c;
            if (!conditionsByStatus.containsKey(status)) {
                conditionsByStatus.put(status, new List<ConditionWrapper.ConditionDTO>());
            }
            conditionsByStatus.get(status).add(new ConditionWrapper.ConditionDTO(condition));
        }

        // Build the grouped response
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


    // @AuraEnabled(cacheable=true)
    // public static ConditionWrapper.ConditionResponseDTO getConditionsByLoanId(String loanId) {
    //     System.debug('Entering getConditionsByLoanId method with loanId: ' + loanId);  // Debug entry point
    //     try {
    //         Map<String, List<ConditionWrapper.ConditionDTO>> conditionsByStatus = new Map<String, List<ConditionWrapper.ConditionDTO>>();
    //         System.debug('Querying Cust_Loan_Condition__c records for loanId: ' + loanId); // Debug for query initiation
            
    //         // Query conditions based on loanId (Cust_Application__c)
    //         for (Cust_Loan_Condition__c condition : [
    //             SELECT Id, Name, Cust_Status__c, Cust_Type__c, Cust_Description__c,
    //                    Cust_Requested_Date__c, Cust_Condition_Satisfaction_Date__c,
    //                    Cust_Assigned_To__c,Cust_ETA__c,Cust_Category__c,Cust_Include_In_Email__c, Cust_Can_Borrower_See__c, Cust_Notes__c
    //             FROM Cust_Loan_Condition__c
    //             WHERE Cust_Application__c = :loanId
    //             ORDER BY Cust_Status__c, Cust_Requested_Date__c
    //         ]) {
    //             String status = condition.Cust_Status__c;
    //             System.debug('Found condition with status: ' + status + ', ID: ' + condition.Id);  // Debug each condition

    //             if (!conditionsByStatus.containsKey(status)) {
    //                 conditionsByStatus.put(status, new List<ConditionWrapper.ConditionDTO>());
    //                 System.debug('Adding new status group for status: ' + status);  // Debug for new status group creation
    //             }
    //             conditionsByStatus.get(status).add(new ConditionWrapper.ConditionDTO(condition));
    //         }

    //         // Preparing the response grouped by status
    //         List<ConditionWrapper.ConditionGroupDTO> result = new List<ConditionWrapper.ConditionGroupDTO>();
    //         for (String status : conditionsByStatus.keySet()) {
    //             result.add(new ConditionWrapper.ConditionGroupDTO(
    //                 status, 
    //                 conditionsByStatus.get(status)
    //             ));
    //             System.debug('Grouping conditions by status: ' + status);  // Debug status grouping
    //         }

    //         System.debug('Returning grouped conditions response');  // Debug response creation
    //         return new ConditionWrapper.ConditionResponseDTO(result);
    //     } catch (Exception e) {
    //         System.debug('Error occurred in getConditionsByLoanId: ' + e.getMessage());  // Debug error
    //         return new ConditionWrapper.ConditionResponseDTO(e);
    //     }
    // }

    @AuraEnabled
    public static ConditionWrapper.ConditionResponseDTO updateConditions(List<Cust_Loan_Condition__c> updatedConditions) {
        System.debug('Entering updateConditions method with conditions count: ' + updatedConditions.size());  // Debug entry point
        try {
            if (updatedConditions == null || updatedConditions.isEmpty()) {
                System.debug('No conditions to update');  // Debug for empty input
                throw new AuraHandledException('No conditions to update');
            }

            for (Cust_Loan_Condition__c updated : updatedConditions) {
                System.debug('Checking status transition for condition ID: ' + updated.Id);  // Debug condition check

                // Query the current status of the condition
                Cust_Loan_Condition__c existing = [
                    SELECT Id, Cust_Status__c 
                    FROM Cust_Loan_Condition__c 
                    WHERE Id = :updated.Id 
                    LIMIT 1
                ];
                System.debug('Existing condition status: ' + existing.Cust_Status__c);  // Debug existing condition status

                // Validate the status transition
                if (!isValidStatusTransition(existing.Cust_Status__c, updated.Cust_Status__c)) {
                    System.debug('Invalid status transition from ' + existing.Cust_Status__c + ' to ' + updated.Cust_Status__c);  // Debug invalid transition
                    throw new AuraHandledException('Invalid status transition for ' + updated.Id);
                }
            }

            // Perform the update operation
            update updatedConditions;
            System.debug('Successfully updated conditions');  // Debug success

            return new ConditionWrapper.ConditionResponseDTO(new List<ConditionWrapper.ConditionGroupDTO>());
        } catch (Exception e) {
            System.debug('Error occurred in updateConditions: ' + e.getMessage());  // Debug error
            return new ConditionWrapper.ConditionResponseDTO(e);
        }
    }

    // Helper method to validate status transition
    private static Boolean isValidStatusTransition(String oldStatus, String newStatus) {
        System.debug('Validating status transition from ' + oldStatus + ' to ' + newStatus);  // Debug status validation
        if (oldStatus == 'Cleared' && newStatus != 'Cleared') {
            System.debug('Transition from Cleared to another status is not allowed');  // Debug specific invalid transition
            return false;
        }
        if (oldStatus == 'Rejected' && newStatus == 'Pending') {
            System.debug('Transition from Rejected to Pending is not allowed');  // Debug specific invalid transition
            return false;
        }
        return true;
    }
}