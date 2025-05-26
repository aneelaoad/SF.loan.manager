import { LightningElement, track } from 'lwc';
import getActiveCategories from '@salesforce/apex/DocumentTemplateController.getActiveCategories';
import getTemplatesByCategory from '@salesforce/apex/DocumentTemplateController.getTemplatesByCategory';
import createTemplate from '@salesforce/apex/DocumentTemplateController.createTemplate';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class AddTemplate extends LightningElement {
    @track isDropdownOpen = false;
    @track isModalOpen = false;
    @track categories = [];

    @track modalTemplateName = '';
    @track modalCategoryId = '';
    @track modalAppliesTo = 'Lead';

    @track selectedCategory = '';

    get categoryOptions() {
        return this.categories.map(cat => ({ label: cat.Name, value: cat.Id }));
    }

    get appliesToOptions() {
        return [
            { label: 'Lead', value: 'Lead' },
            { label: 'Opportunity', value: 'Opportunity' },
            { label: 'Both', value: 'Both' }
        ];
    }

    connectedCallback() {
        this.loadCategories();
    }

    loadCategories() {
        getActiveCategories()
            .then(result => {
                this.categories = result.map(cat => ({
                    ...cat,
                    showTemplates: false,
                    templates: []
                }));
            })
            .catch(error => {
                this.showError('Failed to load categories', error);
            });
    }

    toggleDropdown() {
        this.isDropdownOpen = !this.isDropdownOpen;
    }

    handleCategoryClick(event) {
        const categoryId = event.currentTarget.dataset.category;

        this.categories = this.categories.map(cat => {
            if (cat.Id === categoryId) {
                cat.showTemplates = !cat.showTemplates;
                if (cat.showTemplates && cat.templates.length === 0) {
                    getTemplatesByCategory({ categoryId: cat.Id })
                        .then(result => {
                            cat.templates = result;
                        })
                        .catch(error => {
                            this.showError('Failed to load templates', error);
                        });
                }
            } else {
                cat.showTemplates = false;
            }
            return cat;
        });
    }

    openAddConditionModal(event) {
        this.modalCategoryId = event.currentTarget.dataset.category;
        this.isModalOpen = true;
    }

    closeModal() {
        this.isModalOpen = false;
        this.modalTemplateName = '';
        this.modalCategoryId = '';
        this.modalAppliesTo = 'Lead';
    }

    handleNameChange(event) {
        this.modalTemplateName = event.target.value;
    }

    handleAppliesToChange(event) {
        this.modalAppliesTo = event.detail.value;
    }

    handleCategoryChange(event) {
        this.modalCategoryId = event.detail.value;
    }

    submitTemplate() {
        if (!this.modalTemplateName || !this.modalCategoryId || !this.modalAppliesTo) {
            this.showError('Please complete all fields');
            return;
        }

        createTemplate({
            name: this.modalTemplateName,
            categoryId: this.modalCategoryId,
            appliesTo: this.modalAppliesTo
        })
            .then(result => {
                this.showSuccess('Template created!');
                this.closeModal();
                this.loadCategories();
            })
            .catch(error => {
                this.showError('Error creating template', error);
            });
    }

    showSuccess(message) {
        this.dispatchEvent(new ShowToastEvent({ title: 'Success', message, variant: 'success' }));
    }

    showError(title, error) {
        console.error(error);
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message: error?.body?.message || 'Something went wrong.',
                variant: 'error'
            })
        );
    }
}