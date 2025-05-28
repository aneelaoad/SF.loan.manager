import { LightningElement, track } from 'lwc';
import getAllowedCategories from '@salesforce/apex/DocumentTemplateController.getAllowedCategories';
import getTemplatesByCategory from '@salesforce/apex/DocumentTemplateController.getTemplatesByCategory';
import getTemplateItems from '@salesforce/apex/DocumentTemplateController.getTemplateItems';
import createTemplate from '@salesforce/apex/DocumentTemplateController.createTemplate';
import getTemplateItemsByCategory from '@salesforce/apex/DocumentTemplateController.getTemplateItemsByCategory';

export default class TemplateManager extends LightningElement {
  @track categoryOptions = [];
  @track templateOptions = [];
  @track isCategoryDropdownOpen = false;
  @track isTemplateDropdownOpen = false;
  @track templateItems = [];
  @track groupedItems = {};
  selectedCategory = '';

  @track showModal = false;
  @track modalCategory = '';
  @track modalTemplateName = '';
  @track documentOptions = [];
  @track modalDocumentId = null;

  isLoading = false;

  connectedCallback() {
    getAllowedCategories()
      .then(data => {
        this.categoryOptions = data.map(cat => ({
          label: cat.label,
          value: cat.label
        }));
      })
      .catch(error => {
        console.error('Error fetching categories:', error);
      });
  }

  get categoryDropdownArrow() {
    return this.isCategoryDropdownOpen ? '▲' : '▼';
  }

  toggleCategoryDropdown() {
    this.isCategoryDropdownOpen = !this.isCategoryDropdownOpen;
    this.isTemplateDropdownOpen = false;
  }

  handleCategoryClick(event) {
    const category = event.currentTarget.dataset.value;
    this.selectedCategory = category;
    this.isTemplateDropdownOpen = true;

    getTemplatesByCategory({ category })
      .then(templates => {
        this.templateOptions = templates;
      })
      .catch(error => {
        console.error('Error fetching templates:', error);
      });
  }

  handleTemplateClick(event) {
    const templateId = event.currentTarget.dataset.id;
    this.isTemplateDropdownOpen = false;
    this.isCategoryDropdownOpen = false;
    this.isLoading = true;

    getTemplateItems({ templateId })
      .then(items => {
        this.isLoading = false;

        const processed = items.map(item => ({
          ...item,
          assignedToName: item.owner || '',
          name: item.name,
          status: item.status,
          team: item.team,
          category: item.category
        }));

        const existingIds = new Set(this.templateItems.map(i => i.id));
        const uniqueNewItems = processed.filter(i => !existingIds.has(i.id));
        this.templateItems = [...this.templateItems, ...uniqueNewItems];

        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: this.templateItems,
          bubbles: true,
          composed: true
        }));
      })
      .catch(error => {
        console.error('Error fetching template items:', error);
        this.isLoading = false;
      });
  }

  get modalHeader() {
    return `Add ${this.modalCategory} Template`;
  }

  handleAddTemplateClick(event) {
    event.stopPropagation();
    this.modalCategory = event.currentTarget.dataset.category;
    this.modalTemplateName = '';
    this.modalDocumentId = null;
    this.showModal = true;

    // Load document template items for this category
    getTemplateItemsByCategory({ category: this.modalCategory })
      .then(items => {
        this.documentOptions = items.map(i => ({
          label: i.name,
          value: i.id
        }));
      })
      .catch(error => {
        console.error('Error fetching template items for modal:', error);
      });

      console.log('documentOptions : ',JSON.stringify(this.documentOptions));
  }

  handleModalInputChange(event) {
    this.modalTemplateName = event.target.value;
  }

  handleModalCancel() {
    this.showModal = false;
  }

  handleDocumentChange(event) {
  this.modalDocumentId = event.detail.value;
  console.log('modalDocumentId : ',this.modalDocumentId);

}

modalDocumentIds = [];

handleDocumentMultiChange(event) {
  this.modalDocumentIds = event.detail.value; // array of IDs
  console.log('modalDocumentIds : ',this.modalDocumentIds);
}

handleModalSave() {
  const name = this.modalTemplateName;
  const category = this.modalCategory;
  const appliesTo = 'Opportunity';
  const itemId = this.modalDocumentId;
  console.log('itemId : ',itemId);
  if (!name) {
    alert('Please enter a template name.');
    return;
  }

  if (!itemId) {
    alert('Please select a document template item.');
    return;
  }

  createTemplate({
    name,
    category,
    appliesTo,
    documentItemId: itemId // updated: send as array
  })
    .then(newTemplate => {
      this.showModal = false;

      if (this.selectedCategory === category) {
        return getTemplatesByCategory({ category }).then((templates) => {
          this.templateOptions = templates;
          this.isTemplateDropdownOpen = true;
        });
      }
    })
    .catch(error => {
      console.error('Error creating template:', error);
      alert('Error creating template: ' + (error.body?.message || error.message));
    });
}

  // handleModalSave() {
  //   const name = this.modalTemplateName;
  //   const category = this.modalCategory;
  //   const appliesTo = 'Opportunity';
  //   const itemId = this.modalDocumentId;

  //   if (!name) {
  //     alert('Please enter a template name.');
  //     return;
  //   }

  //   if (!itemId) {
  //     alert('Please select a document template item.');
  //     return;
  //   }

  //   // createTemplate({ name, category, appliesTo, itemId }) // Update Apex to accept itemId if needed
  //   //   .then(newTemplate => {
  //   //     this.showModal = false;

  //   //     if (this.selectedCategory === category) {
  //   //       return getTemplatesByCategory({ category }).then((templates) => {
  //   //         this.templateOptions = templates;
  //   //         this.isTemplateDropdownOpen = true;
  //   //       });
  //   //     }
  //   //   })
  //   //   .catch(error => {
  //   //     console.error('Error creating template:', error);
  //   //     alert('Error creating template: ' + (error.body?.message || error.message));
  //   //   });
  // }
}