import { LightningElement, api, wire, track } from 'lwc';
import getMilestoneGridData from '@salesforce/apex/MilestoneMarkerController.getMilestoneGridData';
import deleteRecipientApex from '@salesforce/apex/MilestoneMarkerController.deleteRecipient';
import sendMilestoneEmail from '@salesforce/apex/MilestoneMarkerController.sendMilestoneEmail';
import updateRecipient from '@salesforce/apex/MilestoneMarkerController.updateRecipient';
import addRecipient from '@salesforce/apex/MilestoneMarkerController.addRecipient';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import RECIPIENT_OBJECT from '@salesforce/schema/Cust_Milestone_Recipient__c';
import TYPE_FIELD from '@salesforce/schema/Cust_Milestone_Recipient__c.Type__c';
import CHANNEL_FIELD from '@salesforce/schema/Cust_Milestone_Recipient__c.Channel__c';

export default class CustomMilestoneTracker extends LightningElement {
    @api recordId;
    @track milestones = [];
    @track recipients = [];
    @track error;
     @api primaryTheme = '#eaf3ff';
    @api secondaryTheme = '#d9ecff';
    @api textTheme = '#1e4f91';
    isModalOpen = false;
    @track isEditMode = false;
    @track editingRecipientId = null;
    objectName = ''
    name = '';
    email = '';
    type = '';
    selectedChannels = [];

    typeOptions = [];
    channelOptions = [];

    get modalTitle() {
        return this.isEditMode ? 'Edit Recipient' : 'Add New Recipient';
    }

    @wire(getObjectInfo, { objectApiName: RECIPIENT_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: TYPE_FIELD
    })
    wiredTypeValues({ data }) {
        if (data) {
            this.typeOptions = data.values;
        }
    }

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: CHANNEL_FIELD
    })
    wiredChannelValues({ data }) {
        if (data) {
            this.channelOptions = data.values;
        }
    }

     @wire(CurrentPageReference)
  getPageReference(pageRef) {
    if (pageRef && !this.isExperienceSite) {
      console.log('CurrentPageReference:', pageRef);
      this.recordId = pageRef.attributes.recordId;
      this.objectName = pageRef.attributes.objectApiName;
      console.log('Internal User: objectName:', this.objectName, 'recordId:', this.recordId);
    }
  }
    connectedCallback() {
        this.loadData();
          if (this.primaryTheme) {
            this.template.host.style.setProperty('--theme-primary', this.primaryTheme);
        }
        if (this.secondaryTheme) {
            this.template.host.style.setProperty('--theme-secondary', this.secondaryTheme);
        }
        if(this.textTheme){
            this.template.host.style.setProperty('--theme-text', this.textTheme);
        }
    
    }
  

    loadData() {
        getMilestoneGridData({ loanId: this.recordId })
            .then(data => {
                 this.milestones = [...data.milestones];
                  this.recipients = [...data.recipients];
            })
            .catch(error => {
                this.showToast('Error loading data', this.getErrorMessage(error), 'error');
            });
    }

    handleOpenModal() {
        this.resetModalFields();
        this.isEditMode = false;
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
        this.resetModalFields();
    }

    sendEmail(event) {
        const milestoneId = event.target.dataset.milestoneId;
        const recipientId = event.target.dataset.recipientId;

        sendMilestoneEmail({ milestoneId, recipientId })
            .then(() => {
                this.showToast('Email Sent', 'Milestone email sent successfully', 'success');
            })
            .catch(error => {
                this.showToast('Error sending email', this.getErrorMessage(error), 'error');
            });
    }

   deleteRecipient(event) {
    const recipientId = event.target.dataset.recipientId;

    deleteRecipientApex({ recipientId })
        .then(() => {
            this.showToast('Deleted', 'Recipient deleted successfully', 'success');

            // ✅ Remove recipient from the in-memory list
            this.recipients = this.recipients.filter(recipient => recipient.id !== recipientId);
        })
        .catch(error => {
            this.showToast('Error deleting recipient', this.getErrorMessage(error), 'error');
        });
}

    editRecipient(event) {
        const recipientId = event.target.dataset.recipientId;
        const recipient = this.recipients.find(r => r.id === recipientId);

        if (recipient) {
            this.name = recipient.name;
            this.email = recipient.email;
            this.type = recipient.type;
            this.selectedChannels = recipient.channel ? recipient.channel.split(';') : [];
            this.editingRecipientId = recipientId;
            this.isEditMode = true;
            this.isModalOpen = true;
        }
    }

    handleNameChange(event) {
        this.name = event.detail.value;
    }

    handleEmailChange(event) {
        this.email = event.detail.value;
    }

    handleTypeChange(event) {
        this.type = event.detail.value;
    }

    handleChannelChange(event) {
        this.selectedChannels = event.detail.value;
    }

    handleCancel() {
    //      if (this.name || this.email || this.type || this.selectedChannels.length) {
    //     if (!confirm('Discard unsaved changes?')) return;
    // }
        this.handleCloseModal();
    }

    

    handleSave() {
    const payload = {
        name: this.name,
        email: this.email,
        type: this.type,
        channel: this.selectedChannels.join(';'),
        loan: this.recordId
    };

    if (this.editingRecipientId) {
        // Edit mode
        updateRecipient({
            recipientId: this.editingRecipientId,
            jsonData: JSON.stringify(payload)
        })
        .then((updatedRecipient) => {
            this.showToast('Updated', 'Recipient updated successfully', 'success');
            this.handleCloseModal();

            // ✅ Update the in-memory recipient
            this.recipients = this.recipients.map(rec => 
                rec.id === updatedRecipient.id ? updatedRecipient : rec
            );
        })
        .catch(error => {
            this.showToast('Error updating recipient', this.getErrorMessage(error), 'error');
        });
    } else {
        // Add mode
        addRecipient({
            jsonData: JSON.stringify(payload)
        })
        .then((newRecipient) => {
            this.showToast('Added', 'Recipient added successfully', 'success');
            this.handleCloseModal();

            // ✅ Push the new recipient to the in-memory list
            this.recipients = [...this.recipients, newRecipient];
        })
        .catch(error => {
            this.showToast('Error adding recipient', this.getErrorMessage(error), 'error');
        });
    }
}

    resetModalFields() {
        this.name = '';
        this.email = '';
        this.type = '';
        this.selectedChannels = [];
        this.editingRecipientId = null;
        this.isEditMode = false;
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    getErrorMessage(error) {
        return error?.body?.message || error?.message || 'Unknown error';
    }
}