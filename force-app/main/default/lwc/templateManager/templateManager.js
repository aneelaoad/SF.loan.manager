import { LightningElement, track } from 'lwc';
import getAllowedTemplateCategories from '@salesforce/apex/DocumentTemplateController.getAllowedTemplateCategories';
import getAllowedDocumentCategories from '@salesforce/apex/DocumentTemplateController.getAllowedDocumentCategories';
import getItemsByDocumentCategory from '@salesforce/apex/DocumentTemplateController.getItemsByDocumentCategory';
import getItemsByTemplateCategory from '@salesforce/apex/DocumentTemplateController.getItemsByTemplateCategory';
import createTemplateAndItem from '@salesforce/apex/DocumentTemplateController.createTemplateAndItem';

export default class TemplateManager extends LightningElement {
  @track isTemplateDropdownOpen = false;
  @track isDocumentDropdownOpen = false;
  @track isLoading = false;
  @track showModal = false;

  @track templateCategoryOptions = [];
  @track documentCategoryOptions = [];
  @track documentOptions = [];

  @track selectedTemplateCategory = '';
  @track selectedDocumentCategory = '';
  @track selectedCategoryType = '';
  @track documentList = [];

  @track modalHeader = '';
  @track modalCategory = '';
  @track modalTemplateName = '';
  @track modalDocumentId = '';

  // Load Template Categories
  handleAddTemplate() {
    this.isLoading = true;
    getAllowedTemplateCategories()
      .then(result => {
        console.log('result : ',JSON.stringify(result));
        this.templateCategoryOptions = result
        // this.templateCategoryOptions = result.map(cat => ({
        //   label: cat.masterLabel,
        //   value: cat.masterLabel
        // }));

        this.isTemplateDropdownOpen = true;
        this.isDocumentDropdownOpen = false;
      })
      .finally(() => (this.isLoading = false));
  }

  // Load Document Categories
  handleAddDocument() {
    this.isLoading = true;
    getAllowedDocumentCategories()
      .then(result => {
        console.log('result : ',JSON.stringify(result));
this.documentCategoryOptions = result
        // this.documentCategoryOptions = result.map(cat => ({
        //   label: cat.masterLabel,
        //   value: cat.masterLabel
        // }));
        console.log('documentCategoryOptions : ',JSON.stringify(this.documentCategoryOptions));

        this.isDocumentDropdownOpen = true;
        this.isTemplateDropdownOpen = false;
      })
      .finally(() => (this.isLoading = false));
  }

  // Template Category Click → fetch all associated documents
  handleTemplateCategoryClick(event) {
    const category = event.currentTarget.dataset.value;
    this.selectedTemplateCategory = category;
    this.selectedCategoryType = 'template';
    this.isLoading = true;

    getItemsByTemplateCategory({ templateCategory: category })
      .then(result => {
        console.log('getItemsByTemplateCategory : ',result);

        this.documentList = result;
        // this.documentList = [...this.documentList, ...result];
        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: this.documentList
        }));
      })
      .finally(() => (this.isLoading = false));
  }

  // Document Category Click → fetch selectable documents
  handleDocumentCategoryClick(event) {
    const category = event.currentTarget.dataset.value;
    this.selectedDocumentCategory = category;
    this.selectedCategoryType = 'document';
    this.isLoading = true;

    getItemsByDocumentCategory({ category })
      .then(result => {
        console.log('getItemsByDocumentCategory : ',result);
        this.documentOptions = result;
      })
      .finally(() => (this.isLoading = false));
  }

  handleDocumentSelect(event) {
    const documentId = event.currentTarget.dataset.id;
    const selectedLabel = event.currentTarget.dataset.name;
    const category = event.currentTarget.dataset.category;
    const status = event.currentTarget.dataset.status;
    const team = event.currentTarget.dataset.team;

    const alreadyExists = this.documentList.some(doc => doc.id === documentId);
    console.log('alreadyExists : ',alreadyExists);
    if (!alreadyExists) {
      this.documentList = [
        ...this.documentList,
        {
          id: documentId,
          name: selectedLabel,
          type: 'document',
          status: status,
          team: team,
          category: category
        }
      ];
    }

    this.isDocumentDropdownOpen = false;

    this.dispatchEvent(new CustomEvent('templateitemsloaded', {
      detail: this.documentList
    }));
  }

  // "+" Modal Logic
  handleAddCategoryClick(event) {
    const category = event.currentTarget.dataset.category;
    const type = event.currentTarget.dataset.type;

    this.modalCategory = category;
    this.modalHeader = type === 'template' ? 'Create Template' : 'Create Document';
    this.modalTemplateName = '';
    this.modalDocumentId = '';
    this.showModal = true;
  }

  handleModalInputChange(event) {
    this.modalTemplateName = event.target.value;
  }

  handleDocumentChange(event) {
    this.modalDocumentId = event.detail.value;
  }

  handleModalCancel() {
    this.showModal = false;
  }

  handleModalSave() {
    if (!this.modalTemplateName || !this.modalDocumentId) return;
    this.isLoading = true;

    createTemplateAndItem({
      templateName: this.modalTemplateName,
      category: this.modalCategory,
      appliesTo: '',
      itemName: this.modalDocumentId,
      team: '',
      status: 'New'
    })
      .then(() => {
        this.showModal = false;
        this.isTemplateDropdownOpen = false;
        this.isDocumentDropdownOpen = false;
      })
      .finally(() => (this.isLoading = false));
  }
}