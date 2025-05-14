import { LightningElement, api, wire, track } from 'lwc';
import getMilestoneGridData from '@salesforce/apex/MilestoneMarkerController.getMilestoneGridData';
import deleteRecipientApex from '@salesforce/apex/MilestoneMarkerController.deleteRecipient';
import updateRecipientApex from '@salesforce/apex/MilestoneMarkerController.updateRecipient';
import sendMilestoneEmail from '@salesforce/apex/MilestoneMarkerController.sendMilestoneEmail';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CustomMilestoneTracker extends LightningElement {
    @api recordId;
    @track milestones = [];
    @track recipients = [];
    @track error;
    isModalOpen = false;

    connectedCallback() {
        this.loadData();
    }

    // Fetch milestones and recipients
    loadData() {
        getMilestoneGridData({ loanId: this.recordId })
            .then(data => {
                this.milestones = data.milestones;
                this.recipients = data.recipients.map(r => ({
                    ...r,
                    isEditing: false,
                    draftValues: {
                        Name: r.Name,
                        Email__c: r.Email__c,
                        Type__c: r.Type__c,
                        Channel__c: r.Channel__c
                    }
                }));
            })
            .catch(error => {
                this.showToast('Error loading data', error.body.message, 'error');
            });
    }

    // Show modal
    handleOpenModal() {
        this.isModalOpen = true;
    }

    // Close modal and refresh list
    handleCloseModal() {
        this.isModalOpen = false;
    }

    refreshData() {
        this.loadData();
    }

    // Email per milestone
    sendEmail(event) {
        const milestoneId = event.target.dataset.milestoneId;
        const recipientId = event.target.dataset.recipientId;

        sendMilestoneEmail({ milestoneId, recipientId })
            .then(() => {
                this.showToast('Email Sent', 'Milestone email sent successfully', 'success');
            })
            .catch(error => {
                this.showToast('Error sending email', error.body.message, 'error');
            });
    }

    // Delete recipient
    deleteRecipient(event) {
        const recipientId = event.target.dataset.recipientId;

        deleteRecipientApex({ recipientId })
            .then(() => {
                this.showToast('Deleted', 'Recipient deleted successfully', 'success');
                this.loadData();
            })
            .catch(error => {
                this.showToast('Error deleting recipient', error.body.message, 'error');
            });
    }
isEditModalOpen = false;
    editRecipient(event) {
        this.isEditModalOpen =true;
    const recipientId = event.target.dataset.recipientId;
    this.recipients = this.recipients.map(r => {
        return { ...r, isEditing: r.Id === recipientId };
    });

    console.log('recipientId: '+recipientId);
    console.log('recipients: '+JSON.stringify(this.recipients));
    
}


    // Cancel edit
 
cancelEdit(event) {
    this.recipients = this.recipients.map(r => ({ ...r, isEditing: false }));
}

handleFieldChange(event) {
    const recipientId = event.target.dataset.recipientId;
    const field = event.target.dataset.field;
    const value = event.target.value;

    this.recipients = this.recipients.map(r => {
        if (r.Id === recipientId) {
            return { ...r, [field]: value };
        }
        return r;
    });
}

saveRecipient(event) {
    const recipientId = event.target.dataset.recipientId;
    const recipient = this.recipients.find(r => r.Id === recipientId);

    const updatedData = {
        Id: recipientId,
        Name: recipient.Name,
        Email__c: recipient.Email__c,
        Type__c: recipient.Type__c,
        Channel__c: recipient.Channel__c
    };

    updateRecipientApex({ recipientJson: JSON.stringify(updatedData) })
        .then(() => {
            this.showToast('Success', 'Recipient updated', 'success');
            this.loadData();
        })
        .catch(error => {
            this.showToast('Error updating recipient', error.body.message, 'error');
        });
}

    // Toast
    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}