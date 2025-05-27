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
  @track templateItems = [];
  @track groupedItems = {};
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
    this.isTemplateDropdownOpen = true;

    getTemplatesByCategory({ category })
      .then(templates => {
        this.templateOptions = templates;
      })
      .catch(error => {
        console.error('Error fetching templates:', error);
      });
  }

  // handleTemplateClick(event) {
  //   const templateId = event.currentTarget.dataset.id;
  //   this.isTemplateDropdownOpen = false;
  //   this.isCategoryDropdownOpen = false;

  //   getTemplateItems({ templateId })
  //     .then(items => {
  //       const processed = items.map(item => ({
  //         ...item,
  //         assignedToName: item.owner || '',
  //         name: item.name,
  //         status: item.status,
  //         team: item.team
  //       }));

  //       // 🔥 Append to existing items
  //       this.templateItems = [...this.templateItems, ...processed];

  //       // 🔥 Emit combined items
  //       this.dispatchEvent(new CustomEvent('templateitemsloaded', {
  //         detail: this.templateItems,
  //         bubbles: true,
  //         composed: true
  //       }));
  //     })
  //     .catch(error => {
  //       console.error('Error fetching template items:', error);
  //     });
  // }
isLoading = false;
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

      // Prevent duplicates using item.id
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
      });
  }
}