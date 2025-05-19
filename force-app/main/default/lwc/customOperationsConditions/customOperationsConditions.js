import { LightningElement, api, wire } from 'lwc';
import getConditionsByLoanId from '@salesforce/apex/ConditionController.getConditionsByLoanId';

export default class OperationsConditions extends LightningElement {
    @api recordId;

    outstanding = [];
    ready = [];
    cleared = [];

    @wire(getConditionsByLoanId, { loanId: '$recordId' })
    wiredConditions({ error, data }) {
        if (data && data.groupedConditions) {
            // Use flatMap correctly on the actual array
            const allConditions = data.groupedConditions.flatMap(group => group.conditions || []);
            const normalized = allConditions.map(this.normalizeCondition);

            this.outstanding = normalized.filter(c =>
                ['New', 'Review', 'Requested'].includes(c.status)
            );
            this.ready = normalized.filter(c =>
                ['Approved', 'Submitted'].includes(c.status)
            );
            this.cleared = normalized.filter(c =>
                ['Cleared'].includes(c.status)
            );
        } else if (error) {
            console.error('Error fetching conditions:', error);
        }
    }

  normalizeCondition(raw) {
    return {
        id: raw.id || raw.Id,
        name: raw.name || raw.Name,
        type: raw.type || raw.Cust_Type__c,
        description: raw.description || raw.Cust_Description__c,
        notes: raw.notes || raw.Cust_Notes__c,
        assignedToName: raw.assignedToName || raw.Cust_Assigned_To__c || '',
        status: raw.status || raw.Cust_Status__c,
        requestedDate: raw.Cust_Requested_Date__c,
        satisfactionDate: raw.Cust_Condition_Satisfaction_Date__c,
        eta: raw.Cust_ETA__c,
        category: raw.Cust_Category__c,
        includeInEmail: raw.Cust_Include_In_Email__c,
        canBorrowerSee: raw.Cust_Can_Borrower_See__c
    };
}

}