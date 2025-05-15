import { LightningElement, track, wire} from 'lwc';

export default class CustomOperationsConditions extends LightningElement {


@track allConditions = [];
@track outstanding = [];
@track ready = [];
@track cleared = [];

// @wire(getConditions, { loanId: '$recordId' })
// wiredConditions({ data, error }) {
//     if (data) {
//         this.allConditions = data;
//         this.outstanding = data.filter(c => c.Condition_Type__c === 'Outstanding');
//         this.ready = data.filter(c => c.Condition_Type__c === 'ReadyForLender');
//         this.cleared = data.filter(c => c.Condition_Type__c === 'Cleared');
//     }
// }


connectedCallback() {
    // Hardcoded condition records
    const data = [
        { Id: '001', Name: 'Condition 1', Condition_Type__c: 'Outstanding' },
        { Id: '002', Name: 'Condition 2', Condition_Type__c: 'ReadyForLender' },
        { Id: '003', Name: 'Condition 3', Condition_Type__c: 'Cleared' },
        { Id: '004', Name: 'Condition 4', Condition_Type__c: 'Outstanding' },
        { Id: '005', Name: 'Condition 5', Condition_Type__c: 'Cleared' }
    ];

    this.allConditions = data;
    this.outstanding = data.filter(c => c.Condition_Type__c === 'Outstanding');
    this.ready = data.filter(c => c.Condition_Type__c === 'ReadyForLender');
    this.cleared = data.filter(c => c.Condition_Type__c === 'Cleared');
}


}