import { LightningElement, track } from 'lwc';

export default class CustomTaskManager extends LightningElement {
    @track selectedCategory = '';
    @track showVerification = false;
    @track allRows = [];
    @track filteredRows = [];

    // Sample data
    connectedCallback() {
        this.allRows = [
            { id: '1', itemName: 'Template A', assignee: 'John Doe', category: 'Income', status: 'In Progress', team: 'Team A', isChecked: false },
            { id: '2', itemName: 'Task B', assignee: 'Jane Smith', category: 'Assets', status: 'Completed', team: 'Team B', isChecked: true },
            { id: '3', itemName: 'Verification C', assignee: 'Bob Johnson', category: 'Credit', status: 'Not Started', team: 'Team C', isChecked: false }
        ];
        this.filteredRows = [...this.allRows]; // Initialize view
    }

    // categoryOptions = [
    //     { label: 'Income', value: 'Income' },
    //     { label: 'Assets', value: 'Assets' },
    //     { label: 'Credit', value: 'Credit' },
    //     { label: 'REO', value: 'REO' },
    //     { label: 'Other', value: 'Other' },
    //     { label: 'Disclosures', value: 'Disclosures' },
    //     { label: 'Compliance', value: 'Compliance' }
    // ];
    categoryList = [
  { name: 'Income', circleClass: 'income-dot', labelClass: 'category-label' },
  { name: 'Assets', circleClass: 'assets-dot', labelClass: 'category-label' },
  { name: 'Credit', circleClass: 'credit-dot', labelClass: 'category-label' },
  { name: 'REO', circleClass: 'reo-dot', labelClass: 'category-label' },
  { name: 'Other', circleClass: 'other-dot', labelClass: 'category-label' },
  { name: 'Disclosures', circleClass: 'disclosures-dot', labelClass: 'category-label' },
  { name: 'Compliance', circleClass: 'compliance-dot', labelClass: 'category-label' }
];


    get isEmpty() {
        return this.filteredRows.length === 0;
    }

    // Handle + Template menu actions
    handleMenuSelect(event) {
        const selected = event.detail.value;
        if (selected === 'newTemplate') {
            this.handleNewTemplate();
        } else if (selected === 'fromExisting') {
            this.handleFromExisting();
        }
    }

    handleNewTemplate() {
        // TODO: Open modal or launch new template flow
        console.log('Creating new template...');
    }

    handleFromExisting() {
        // TODO: Logic for creating from existing template
        console.log('Creating template from existing...');
    }

    handleNewTask() {
        // TODO: Logic to add a new task
        console.log('Adding new task...');
    }

    toggleVerification() {
        this.showVerification = !this.showVerification;
    }

    handleCategoryChange(event) {
        this.selectedCategory = event.detail.value;

        if (this.selectedCategory) {
            this.filteredRows = this.allRows.filter(row => row.category === this.selectedCategory);
        } else {
            this.filteredRows = [...this.allRows];
        }
    }

    // Checkbox handler
    handleCheckboxChange(event) {
        const rowId = event.target.dataset.id;
        const isChecked = event.target.checked;

        const row = this.allRows.find(r => r.id === rowId);
        if (row) {
            row.isChecked = isChecked;
        }
    }

    // Input field change (e.g., inline edit support)
    handleInputChange(event) {
        const rowId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        const row = this.allRows.find(r => r.id === rowId);
        if (row && field) {
            row[field] = value;
        }
    }
}