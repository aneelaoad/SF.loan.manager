import { LightningElement, track, wire } from 'lwc';
import { getPicklistValues, getObjectInfo } from 'lightning/uiObjectInfoApi';
import TEMPLATE_OBJECT from '@salesforce/schema/Template__c';
import CATEGORY_FIELD from '@salesforce/schema/Template__c.Category__c';
import getTemplatesByCategory from '@salesforce/apex/TemplateController.getTemplatesByCategory';

export default class ConditionTemplateManager extends LightningElement {
    @track categoryOptions = [];
    @track templates = [];
    @track selectedCategory = null;
    @track showCategoryMenu = false;
    @track isLoadingTemplates = false;

    @wire(getObjectInfo, { objectApiName: TEMPLATE_OBJECT })
    objectInfo;

    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: CATEGORY_FIELD
    })
    picklistValues({ data, error }) {
        if (data) {
            this.categoryOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
        }
    }

    toggleCategoryMenu() {
        this.showCategoryMenu = !this.showCategoryMenu;
        this.selectedCategory = null;
        this.templates = [];
    }

    handleCategoryClick(event) {
        const category = event.currentTarget.dataset.value;
        if (this.selectedCategory === category) {
            this.selectedCategory = null;
            this.templates = [];
            return;
        }

        this.selectedCategory = category;
        this.isLoadingTemplates = true;

        getTemplatesByCategory({ category })
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

handleCategoryClick(event) {
    const selected = event.currentTarget.dataset.value;

    this.selectedCategory = selected;
    this.templates = [];
    this.isLoadingTemplates = true;

    // Update each category with isSelected flag
    this.categoryOptions = this.categoryOptions.map(c => ({
        ...c,
        isSelected: c.value === selected
    }));

    getTemplatesByCategory({ category: selected })
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
