import { LightningElement, api, wire,track } from 'lwc';
import getMilestones from '@salesforce/apex/MilestoneMarkerController.getMilestones';
import getRecipients from '@salesforce/apex/MilestoneMarkerController.getRecipients';
export default class CustomMilestoneTracker extends LightningElement {

    @api recordId; 
    @track milestones;
    recipientsList = []
    @track error;
    isModalOpen = false;

    @wire(getMilestones, { loanId: '$recordId' })
    wiredMilestones({ error, data }) {
        if (data) {
            this.milestones = data;
        } else if (error) {
            this.error = error.body.message;
        }
    }
    @wire(getRecipients, { loanId: '$recordId' })
    wiredMilestones({ error, data }) {
        if (data) {
            this.recipientsList = data;
        
        } else if (error) {
            this.error = error.body.message;
        }
    }


    handleOpenModal() {
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
    }
}