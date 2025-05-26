import { LightningElement, track } from 'lwc';
import getAllTemplates from '@salesforce/apex/TemplateController.getAllTemplates';

export default class CustomTaskManager extends LightningElement {
    @track selectedCategories = [];
    @track showVerification = false;
    @track templateItemRows = [];
    @track filteredRows = [];

    categoryList = [
        { name: 'Income', circleClass: 'income-dot', labelClass: 'category-label' },
        { name: 'Assets', circleClass: 'assets-dot', labelClass: 'category-label' },
        { name: 'Credit', circleClass: 'credit-dot', labelClass: 'category-label' },
        { name: 'REO', circleClass: 'reo-dot', labelClass: 'category-label' },
        { name: 'Other', circleClass: 'other-dot', labelClass: 'category-label' },
        { name: 'Disclosures', circleClass: 'disclosures-dot', labelClass: 'category-label' },
        { name: 'Compliance', circleClass: 'compliance-dot', labelClass: 'category-label' },
        { name: 'Reset', icon: 'utility:refresh', isReset: true, labelClass: 'category-label' }
    ];

    connectedCallback() {
        this.fetchTemplates();
    }

    fetchTemplates() {
        getAllTemplates()
            .then((data) => {
                console.log('Templates:', JSON.stringify(data));
                // Template fetching is retained but not used for table filtering
            })
            .catch((error) => {
                console.error('Error fetching templates:', error);
            });
    }

    get isEmpty() {
        return this.filteredRows.length === 0;
    }

    // Dropdown handler
    handleMenuSelect(event) {
        const selected = event.detail.value;
        if (selected === 'newTemplate') {
            this.handleNewTemplate();
        } else if (selected === 'fromExisting') {
            this.handleFromExisting();
        }
    }

    handleNewTemplate() {
        console.log('Creating new template...');
    }

    handleFromExisting() {
        console.log('Creating template from existing...');
    }

    handleNewTask() {
        console.log('Adding new task...');
    }

    toggleVerification() {
        this.showVerification = !this.showVerification;
    }

    // Handle category filter clicks, filters templateItemRows
    handleCategoryClick(event) {
        const clickedCategory = event.currentTarget.dataset.name;

        if (clickedCategory === 'Reset') {
            this.selectedCategories = [];
            this.filteredRows = [...this.templateItemRows];
        } else {
            if (this.selectedCategories.includes(clickedCategory)) {
                this.selectedCategories = this.selectedCategories.filter(cat => cat !== clickedCategory);
            } else {
                this.selectedCategories = [...this.selectedCategories, clickedCategory];
            }

            if (this.selectedCategories.length > 0) {
                this.filteredRows = this.templateItemRows.filter(row =>
                    this.selectedCategories.includes(row.category)
                );
            } else {
                this.filteredRows = [...this.templateItemRows];
            }
        }

        this.categoryList = this.categoryList.map(cat => ({
            ...cat,
            labelClass: this.selectedCategories.includes(cat.name)
                ? 'category-label selected'
                : 'category-label'
        }));
    }

    handleCheckboxChange(event) {
        const rowId = event.target.dataset.id;
        const isChecked = event.target.checked;

        const row = this.templateItemRows.find(r => r.id === rowId);
        if (row) {
            row.isChecked = isChecked;
        }
    }

    handleInputChange(event) {
        const rowId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        const row = this.templateItemRows.find(r => r.id === rowId);
        if (row && field) {
            row[field] = value;
        }
    }

    // Receive template items from child component
    handleTemplateItems(event) {
        const items = event.detail;

        this.templateItemRows = items.map(item => ({
            id: item.id,
            name: item.name,
            category: item.category || 'N/A',
            status: item.status || 'Pending',
            createdBy: item.createdBy || 'N/A',
            owner: item.assignedToName || 'Unassigned'
        }));

        // Default to show all when first received
        this.filteredRows = [...this.templateItemRows];
        this.selectedCategories = [];

        // Reset category label classes
        this.categoryList = this.categoryList.map(cat => ({
            ...cat,
            labelClass: 'category-label'
        }));
    }
}