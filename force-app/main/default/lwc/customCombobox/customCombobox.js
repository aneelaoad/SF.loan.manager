import { LightningElement, track, wire } from 'lwc';
import getActiveUsers from '@salesforce/apex/NotesController.getActiveUsers';

export default class CustomCombobox extends LightningElement {
    @track userOptions = [];
    @track filteredOptions = [];
    @track searchTerm = '';
    @track showDropdown = false;
    @track noResults = false;

    @wire(getActiveUsers)
    wiredUsers({ error, data }) {
        if (data) {
            this.userOptions = [
                { label: 'All', value: '' }, // Default "All" option
                ...data.map(user => ({
                    label: user.Name, // Display user's Name in the combobox
                    value: user.Id    // Store the user's Id as the value
                }))
            ];
            this.filteredOptions = [...this.userOptions];
        } else if (error) {
            console.error('Error fetching users', error);
        }
    }

    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.showDropdown = true;
        this.filterUsers();
    }

    filterUsers() {
        if (this.searchTerm === '') {
            this.filteredOptions = [...this.userOptions];
        } else {
            this.filteredOptions = this.userOptions.filter(user =>
                user.label.toLowerCase().includes(this.searchTerm)
            );
        }

        this.noResults = this.filteredOptions.length === 0;
    }

    handleSelect(event) {
        const selectedUserId = event.currentTarget.dataset.id;
        const selectedUser = this.userOptions.find(user => user.value === selectedUserId);
        this.searchTerm = selectedUser.label;
        this.showDropdown = false;

        this.dispatchEvent(new CustomEvent('userfilterchange', {
            detail: { userId: selectedUserId }
        }));
    }

    toggleDropdown() {
        this.showDropdown = !this.showDropdown;
    }
}