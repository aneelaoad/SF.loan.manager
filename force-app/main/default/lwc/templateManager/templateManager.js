import { LightningElement, track } from 'lwc';
import getAllowedCategories from '@salesforce/apex/DocumentTemplateController.getAllowedCategories';
import getTemplatesByCategory from '@salesforce/apex/DocumentTemplateController.getTemplatesByCategory';
import getTemplateItems from '@salesforce/apex/DocumentTemplateController.getTemplateItems';
import createTemplate from '@salesforce/apex/DocumentTemplateController.createTemplate';

export default class TemplateManager extends LightningElement {
  @track categoryOptions = [];
  @track templateOptions = [];
  @track isCategoryDropdownOpen = false;
  @track isTemplateDropdownOpen = false;
  selectedCategory = '';

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
    // this.isCategoryDropdownOpen = false;
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

    getTemplateItems({ templateId })
      .then(items => {
        const processed = items.map(item => ({
          ...item,
          assignedToName: item.owner || '',
          name: item.name,
          status: item.status,
          team: item.team
        }));

        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: processed,
          bubbles: true,
          composed: true
        }));
      })
      .catch(error => {
        console.error('Error fetching template items:', error);
      });
  }

  handleAddTemplateClick(event) {
  event.stopPropagation(); // Prevent parent li click

  const category = event.currentTarget.dataset.category;
  const name = prompt(`Enter name for new template under '${category}':`);
  if (!name) return;

  const appliesTo = 'Generic'; // Or fetch user input if needed

  createTemplate({ name, category, appliesTo })
    .then(newTemplate => {
      // Optionally refresh templates for the selected category
      if (this.selectedCategory === category) {
        return getTemplatesByCategory({ category }).then((templates) => {
          this.templateOptions = templates;
          this.isTemplateDropdownOpen = true;
        });
      }
    })
    .catch(error => {
      console.error('Error creating template:', error);
      alert('Error creating template: ' + error.body.message);
    });}
}