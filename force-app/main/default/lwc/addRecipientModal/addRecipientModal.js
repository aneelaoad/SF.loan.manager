import { LightningElement, api, wire } from 'lwc';
import addRecipient from '@salesforce/apex/MilestoneMarkerController.addRecipient';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';

// Schema imports
import RECIPIENT_OBJECT from '@salesforce/schema/Cust_Milestone_Recipient__c';
import TYPE_FIELD from '@salesforce/schema/Cust_Milestone_Recipient__c.Type__c';
import CHANNEL_FIELD from '@salesforce/schema/Cust_Milestone_Recipient__c.Channel__c';

export default class AddRecipientModal extends LightningElement {
    @api loanId;

    name = '';
    email = '';
    type = '';
    channel = '';

    typeOptions = [];
    channelOptions = [];

    // Get object metadata to extract recordTypeId
    @wire(getObjectInfo, { objectApiName: RECIPIENT_OBJECT })
    objectInfo;

    // Get Type__c picklist values
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: TYPE_FIELD
    })
    wiredTypeValues({ data, error }) {
        if (data) {
            this.typeOptions = data.values;
        if (data.values.length > 0 && !this.type) {
            this.type = data.values[0].value; // Set default to first value
        }
        } else if (error) {
            console.error('Error loading Type__c picklist:', error);
        }
    }

    // Get Channel__c multipicklist values
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: CHANNEL_FIELD
    })
    wiredChannelValues({ data, error }) {
        if (data) {
            this.channelOptions = data.values;
        } else if (error) {
            console.error('Error loading Channel__c multipicklist:', error);
        }
    }

    // Input handlers
    handleNameChange(event) {
        this.name = event.target.value;
    }

    handleEmailChange(event) {
        this.email = event.target.value;
    }

    handleTypeChange(event) {
        this.type = event.detail.value;
    }

    handleChannelChange(event) {
        // Multi-picklist values need to be joined as a semicolon-separated string
        this.channel = event.detail.value.join(';');
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    handleSave() {
        const recipient = {
            loan: this.loanId,
            name: this.name,
            email: this.email,
            type: this.type,
            channel: this.channel
        };

        console.log('recipient:', recipient);

        addRecipient({ jsonData: JSON.stringify(recipient) })
            .then(() => {
                this.dispatchEvent(new CustomEvent('recipientadded'));
            })
            .catch(error => {
                console.error('Error adding recipient:', error);
            });
    }
}