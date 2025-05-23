import { LightningElement, track } from 'lwc';
import createConditionTemplate from '@salesforce/apex/LoanConditionTemplateController.createConditionTemplate';
import getConditionTemplatesByCategory from '@salesforce/apex/LoanConditionTemplateController.getConditionTemplatesByCategory';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AddTemplate extends LightningElement {
    @track isDropdownOpen = false;
    @track isModalOpen = false;

    @track modalItemName = '';
    @track modalCategory = '';
    @track modalComments = '';
    @track modalStatus = 'Upcoming';

    @track categories = [];
    // @track categories = [
    //     { name: 'Income', showConditions: false, conditions: [] },
    //     { name: 'Credit', showConditions: false, conditions: [] },
    //     { name: 'REO', showConditions: false, conditions: [] },
    //     { name: 'ID', showConditions: false, conditions: [] },
    //     { name: 'Disclosures', showConditions: false, conditions: [] },
    //     { name: 'Other', showConditions: false, conditions: [] }
    // ];

    get categoryOptions() {
        return this.categories.map(cat => ({ label: cat.name, value: cat.name }));
    }

    get statusOptions() {
        return [
            { label: 'Upcoming', value: 'Upcoming' },
            { label: 'Completed', value: 'Completed' },
            { label: 'Pending', value: 'Pending' }
        ];
    }

       connectedCallback() {
        this.fetchConditions();
    }


    fetchConditions() {
        getConditionTemplatesByCategory()
            .then(result => {
                const categoryNames = ['Income', 'Credit', 'REO', 'ID', 'Disclosures', 'Other'];
                this.categories = categoryNames.map(catName => ({
                    name: catName,
                    showConditions: false,
                    conditions: result[catName] || []
                }));
            })
            .catch(error => {
                console.error('Error loading condition templates:', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Failed to load templates.',
                    variant: 'error'
                }));
            });

            console.log(' this.categoryNames : ', JSON.stringify(this.categoryNames));
            console.log(' this.categories : ', JSON.stringify(this.categories));
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    handleCategoryClick(event) {
        const category = event.currentTarget.dataset.category;
        this.categories = this.categories.map(cat => ({
            ...cat,
            showConditions: cat.name === category ? !cat.showConditions : cat.showConditions
        }));
    }

    openAddConditionModal(event) {
        this.modalCategory = event.currentTarget.dataset.category;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.modalItemName = '';
        this.modalCategory = '';
        this.modalComments = '';
        this.modalStatus = 'Upcoming';
    }

    handleItemNameChange(event) {
        this.modalItemName = event.target.value;
    }

    handleCategoryChange(event) {
        this.modalCategory = event.detail.value;
    }

    handleCommentsChange(event) {
        this.modalComments = event.target.value;
    }

    handleStatusChange(event) {
        this.modalStatus = event.detail.value;
    }

    submitCondition() {
        createConditionTemplate({
            itemName: this.modalItemName,
            category: this.modalCategory,
            comments: this.modalComments,
            defaultStatus: this.modalStatus
        })
            .then(result => {
                // Add new condition to category
                this.categories = this.categories.map(cat => {
                    if (cat.name === this.modalCategory) {
                        return {
                            ...cat,
                            conditions: [...cat.conditions, this.modalItemName]
                        };
                    }
                    return cat;
                });

                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: 'Condition template added!',
                    variant: 'success'
                }));
                this.closeModal();
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body.message || 'Something went wrong.',
                    variant: 'error'
                }));
            });
    }
}