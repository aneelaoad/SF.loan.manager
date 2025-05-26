import { LightningElement, track, wire } from 'lwc';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import TEMPLATE_OBJECT from '@salesforce/schema/Template__c';
import CATEGORY_FIELD from '@salesforce/schema/Template__c.Category__c';
import STATUS_FIELD from '@salesforce/schema/Template__c.Status__c';
import getTemplatesByCategory from '@salesforce/apex/TemplateController.getTemplatesByCategory';
import createTemplate from '@salesforce/apex/TemplateController.createTemplate';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
export default class ConditionTemplateManager extends LightningElement {
    @track categoryOptions = [];
    @track statusOptions = [];
    @track templates = [];
    @track selectedCategory = null;
    @track showCategoryMenu = false;
    @track isLoadingTemplates = false;
    @track showModal = false;
    @track newTemplateName = '';
    @track newTemplateStatus = '';

    // Fetch object metadata
    @wire(getObjectInfo, { objectApiName: TEMPLATE_OBJECT })
    objectInfo;

    // Fetch Category__c picklist values
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: CATEGORY_FIELD
    })
    categoryPicklistValues({ data, error }) {
        if (data) {
            this.categoryOptions = data.values.map(item => ({
                label: item.label,
                value: item.value,
                isSelected: false
            }));
        }
    }

    // Fetch Status__c picklist values
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    statusPicklistValues({ data, error }) {
        if (data) {
            this.statusOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
        }
    }

    // Toggle category menu dropdown
    toggleCategoryMenu() {
        this.showCategoryMenu = !this.showCategoryMenu;
        this.selectedCategory = null;
        this.templates = [];
    }

    // Handle category selection
    // handleCategoryClick(event) {
    //     const selected = event.currentTarget.dataset.value;

    //     this.selectedCategory = selected;
    //     this.templates = [];
    //     this.isLoadingTemplates = true;

    //     this.categoryOptions = this.categoryOptions.map(c => ({
    //         ...c,
    //         isSelected: c.value === selected
    //     }));

    //     getTemplatesByCategory({ category: selected })
    //         .then(result => {
    //             this.templates = result;
    //             this.isLoadingTemplates = false;
    //         })
    //         .catch(error => {
    //             console.error('Error fetching templates:', error);
    //             this.templates = [];
    //             this.isLoadingTemplates = false;
    //         });
    // }

    handleCategoryClick(event) {
    const clickedCategory = event.currentTarget.dataset.value;

    if (this.selectedCategory === clickedCategory) {
        // Same category clicked again → collapse the dropdown
        this.selectedCategory = null;
        this.templates = [];
        this.categoryOptions = this.categoryOptions.map(c => ({
            ...c,
            isSelected: false
        }));
    } else {
        // New category clicked → show templates
        this.selectedCategory = clickedCategory;
        this.templates = [];
        this.isLoadingTemplates = true;

        this.categoryOptions = this.categoryOptions.map(c => ({
            ...c,
            isSelected: c.value === clickedCategory
        }));

        getTemplatesByCategory({ category: clickedCategory })
            .then(result => {
                this.templates = result;
                this.isLoadingTemplates = false;
            })
            .catch(error => {
                console.error('Error fetching templates:', error);
                this.templates = [];
                this.isLoadingTemplates = false;
            });
    }
}

    // Open modal for adding new template
    handleAddTemplateClick(event) {
        this.selectedCategory = event.currentTarget.dataset.value;
        this.showModal = true;
        this.newTemplateName = '';
        this.newTemplateStatus = '';
    }

    // Handle name input
    handleNameChange(event) {
        this.newTemplateName = event.target.value;
    }

    // Handle status selection
    handleStatusChange(event) {
        this.newTemplateStatus = event.detail.value;
    }

    // Create new template via Apex
    createNewTemplate() {
        if (!this.newTemplateName || !this.selectedCategory || !this.newTemplateStatus) {
            alert('Please enter name, category, and status.');
            return;
        }

        createTemplate({
            name: this.newTemplateName,
            category: this.selectedCategory,
            status: this.newTemplateStatus
        })
            .then(result => {
                this.showModal = false;
                this.templates.push(result); // Optionally refetch templates
                this.newTemplateName = '';
                this.newTemplateStatus = '';

                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Template created successfully',
                        variant: 'success'
                    })
                );
                return refreshApex(this.templates);


            })
            .catch(error => {
                console.error('Error creating template:', error);
                this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Duplicate Templates.',
                    message: error.body.message,
                    variant: 'error'
                })
            );
            });
    }

    // Close the modal
    closeModal() {
        this.showModal = false;
    }

    // Refresh on success (optional, used if you use lightning-record-form)
    handleFormSuccess() {
        this.showModal = false;
        if (this.selectedCategory) {
            this.handleCategoryClick({ currentTarget: { dataset: { value: this.selectedCategory } } });
        }
    }
}