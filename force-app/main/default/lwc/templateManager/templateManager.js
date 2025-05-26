import { LightningElement, track } from 'lwc';
import getAllowedCategories from '@salesforce/apex/DocumentTemplateController.getAllowedCategories';
import getTemplatesByCategory from '@salesforce/apex/DocumentTemplateController.getTemplatesByCategory';
import getTemplateItems from '@salesforce/apex/DocumentTemplateController.getTemplateItems';

export default class TemplateManager extends LightningElement {
  @track selectedCategory = '';
  @track categoryOptions = [];
  @track templateOptions = [];
  @track templateItems = [];

  columns = [
    { label: 'Document Name', fieldName: 'name' },
    { label: 'Status', fieldName: 'status' },
    { label: 'Assigned To', fieldName: 'owner' },
    { label: 'Team', fieldName: 'team' }
  ];

  connectedCallback() {
    getAllowedCategories().then(data => {
      this.categoryOptions = data.map(cat => ({
        label: cat.label,
        value: cat.label // Use label as value
      }));
    }).catch(error => {
      console.error('Error fetching categories:', error);
    });
  }

  handleCategoryChange(event) {
    this.selectedCategory = event.detail.value;
    this.templateItems = [];
    this.templateOptions = [];

    getTemplatesByCategory({ category: this.selectedCategory })
      .then(templates => {
        this.templateOptions = templates;
      })
      .catch(error => {
        console.error('Error fetching templates:', error);
      });
  }

  handleTemplateClick(event) {
    const templateId = event.currentTarget.dataset.id;

    getTemplateItems({ templateId }).then(items => {
      const itemsWithDisplay = items.map(item => ({
        ...item,
        assignedToName: item.owner || '',
        name: item.name,
        status: item.status,
        team: item.team
      }));

      this.dispatchEvent(new CustomEvent('templateitemsloaded', {
        detail: itemsWithDisplay,
        bubbles: true,
        composed: true
      }));
    }).catch(error => {
      console.error('Error fetching template items:', error);
    });
  }
}