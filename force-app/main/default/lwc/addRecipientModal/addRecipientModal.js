import { LightningElement, api } from 'lwc';
import addRecipient from '@salesforce/apex/MilestoneMarkerController.addRecipient';
import updateRecipient from '@salesforce/apex/MilestoneMarkerController.updateRecipient'; // Add this Apex

export default class AddRecipientModal extends LightningElement {
    @api loanId;
    @api recipient;
    @api isEditMode;

    name = '';
    email = '';
    type = '';
    selectedChannels = [];

    typeOptions = [];
    channelOptions = [];

    connectedCallback() {
        if (this.isEditMode && this.recipient) {
            this.name = this.recipient.Name;
            this.email = this.recipient.Email__c;
            this.type = this.recipient.Type__c;
            this.selectedChannels = this.recipient.Channel__c?.split(';') || [];
        }
    }

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
        this.selectedChannels = event.detail.value;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('closemodal'));
    }

    handleSave() {
        const payload = {
            loan: this.loanId,
            name: this.name,
            email: this.email,
            type: this.type,
            channel: this.selectedChannels.join(';')
        };

        if (this.isEditMode && this.recipient) {
            updateRecipient({ recipientId: this.recipient.Id, jsonData: JSON.stringify(payload) })
                .then(() => {
                    this.fireSuccess();
                })
                .catch(error => {
                    console.error('Error updating recipient:', error);
                });
        } else {
            addRecipient({ jsonData: JSON.stringify(payload) })
                .then(() => {
                    this.fireSuccess();
                })
                .catch(error => {
                    console.error('Error adding recipient:', error);
                });
        }
    }

    fireSuccess() {
        this.dispatchEvent(new CustomEvent('recipientadded', {
            bubbles: true,
            composed: true
        }));
        this.dispatchEvent(new CustomEvent('closemodal'));
    }
}
