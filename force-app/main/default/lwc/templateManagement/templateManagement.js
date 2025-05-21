import { LightningElement, track } from 'lwc';

export default class AddTemplate extends LightningElement {
  @track isDropdownOpen = false;

  @track categories = [
    { name: 'Income', conditions: ['W-2 Verified', 'Paystub uploaded'], showConditions: false },
    { name: 'Credit', conditions: ['Credit Report Pulled'], showConditions: false },
    { name: 'REO', conditions: ['Property Verified'], showConditions: false },
    { name: 'ID', conditions: ['ID Verified'], showConditions: false },
    { name: 'Disclosures', conditions: ['Disclosure Sent'], showConditions: false },
    { name: 'Other', conditions: ['Custom Note'], showConditions: false }
  ];

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  handleCategoryClick(event) {
    const selectedCategory = event.currentTarget.dataset.category;
    this.categories = this.categories.map(cat => {
      if (cat.name === selectedCategory) {
        return { ...cat, showConditions: !cat.showConditions };
      }
      return cat;
    });
  }

  handleAddCondition(event) {
    const categoryName = event.currentTarget.dataset.category;
    const newCondition = prompt(`Enter new condition for ${categoryName}`);
    if (newCondition) {
      this.categories = this.categories.map(cat => {
        if (cat.name === categoryName) {
          return { ...cat, conditions: [...cat.conditions, newCondition] };
        }
        return cat;
      });
    }
  }
}