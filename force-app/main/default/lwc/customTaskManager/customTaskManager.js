import { LightningElement, track, api, wire } from 'lwc';
import getAssignedDocuments from '@salesforce/apex/DocumentTemplateController.getAssignedDocuments';
import { CurrentPageReference } from 'lightning/navigation';

export default class CustomTaskManager extends LightningElement {
    @api recordId;
    @track selectedCategories = [];
    @track showVerification = false;
    @track templateItemRows = [];
    @track filteredRows = [];

    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            console.log('CurrentPageReference : ', pageRef);


            // Extract recordId and objectName from the URL or page reference
            this.recordId = pageRef.attributes.recordId;
            this.objectName = pageRef.attributes.objectApiName;
            console.log('recordId : ', this.recordId);
            console.log('objectName : ', this.objectName);

        }
    }


    @wire(getAssignedDocuments, { recordId: '$recordId' })
    wiredDocuments({ error, data }) {
        if (data) {
            this.filteredRows = data;
            console.log('dataxx : ', JSON.stringify(data));

            console.log('filteredRowsxx : ', JSON.stringify(this.filteredRows));

            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.filteredRows = [];
        }
    }

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

    get groupedByStatus() {
        const groups = {};

        this.filteredRows.forEach(item => {
            const status = item.status || 'General';
            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push(item);
        });
        console.log('31: filteredRows : ', JSON.stringify(this.filteredRows));
        return Object.entries(groups).map(([status, items]) => ({
            status,
            items
        }));
    }

    get statusKeys() {
        return this.groupedByStatus.map(group => group.status);
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

     handleRefreshClick() {
        console.log('Refresh button clicked!');
        // Add your refresh logic here
    }

    // Handler for the Archive button
    handleArchiveClick() {
        console.log('Archive button clicked!');
        // Add your archive logic here
    }

    // Handler for the Mortgage App button
    handleMortgageAppClick() {
        console.log('Mortgage App button clicked!');
        // Add your app-specific logic here
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
        this.templateItemRows = items


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