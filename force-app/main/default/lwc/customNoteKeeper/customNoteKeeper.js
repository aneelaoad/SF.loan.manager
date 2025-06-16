import { LightningElement, track, api, wire } from 'lwc';
import getNotes from '@salesforce/apex/NotesController.getNotes';
import createNote from '@salesforce/apex/NotesController.createNote';
import deleteNote from '@salesforce/apex/NotesController.deleteNote';
import updateNote from '@salesforce/apex/NotesController.updateNote';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import noAssistance from '@salesforce/resourceUrl/NoAsisstentceSvg';
import { getRecord } from 'lightning/uiRecordApi';
import NAME_FIELD from '@salesforce/schema/Opportunity.Name';
import getCurrentUserContext from '@salesforce/apex/UtilityClass.getCurrentUserContext';


export default class CustomNoteKeeper extends LightningElement {
    recordId;    
    @api objectApiName;
    activeUsers = [];
    isLoading = false;
    searchKey = '';
    selectedUserId = '';
    filteredNotes = [];
    allNotes = [];
    showModal = false;
    newRole = '';
    newNoteSubject = '';
    newNoteBody = '';
    selectedNoteId = null;
    modalTitle = 'New Note';
    modalButtonLabel = 'Create Note';
    recordName = '';
    errorMessage = '';
    successMessage = '';
    showError = false;
    showSuccess = false;
    selectedButtonsValues = [];

    // ------wire methods-----
    // ------------------------
    // @wire(getActiveUsers)
    // wiredActiveUsers({ error, data }) {
    //     if (data) {
    //         this.userOptions = [
    //             { label: 'All', value: '' }, // Default "All" option
    //             ...data.map(user => ({
    //                 label: user.Name, // Display user's Name in the combobox
    //                 value: user.Id    // Store the user's Id as the value
    //             }))
    //         ];
    //         this.error = undefined; // Clear any previous errors
    //     } else if (error) {
    //         this.error = error; // Handle error
    //         this.userOptions = [];
    //     }
    // }
     @wire(CurrentPageReference)
    getPageReference(pageRef) {
        console.log('pageRef : ',pageRef);
        console.log('recordId : ',this.recordId);
        if (pageRef && pageRef.state && pageRef.attributes.recordId) {
            this.recordId = pageRef.attributes.recordId;
            this.objectApiName = pageRef.attributes.objectApiName;

            this.loadNotes();
        }
    }
  
  get noAssistanceIcon() {
        return noAssistance;
    }
  
    buttonList = [
        { value: 'Processor', label: 'Processor', icon: 'action:submit_for_approval', baseClass: 'custom-green-icon' },
        { value: 'Loan Officer', label: 'Loan Officer', icon: 'action:new_case', baseClass: 'custom-orange-icon' },
        { value: 'Closer', label: 'Closer', icon: 'action:new_note', baseClass: 'custom-orange-icon' },
        { value: 'Loan Officer Assistant', label: 'Loan Officer Assistant', icon: 'action:user', baseClass: 'custom-blue-icon' },
        { value: 'Funder', label: 'Funder', icon: 'action:user', baseClass: 'custom-blue-icon' },
        { value: 'Owner', label: 'Owner', icon: 'action:user', baseClass: 'custom-blue-icon' },
        { value: 'Team Lead', label: 'Team Lead', icon: 'action:user', baseClass: 'custom-blue-icon' }
    ];


    get updatedButtonList() {
        return this.buttonList.map(btn => {
            return {
                ...btn,
                iconClass: this.selectedButtonsValues.includes(btn.value)
                    ? `${btn.baseClass} selected-button`
                    : btn.baseClass
            };
        });
    }

    // Wire the getRecord function to fetch record data
    @wire(getRecord, { recordId: '$recordId', fields: [NAME_FIELD] })
    wiredRecord({ error, data }) {
        if (data) {
            // Extract the name of the account record
            this.recordName = data.fields.Name.value;
        } else if (error) {
            console.error('Error fetching record:', error);
        }
    }
    connectedCallback() {
       getCurrentUserContext()
      .then(context => {
        this.isExperienceSite = context.isExperienceSite;
        if (this.isExperienceSite) {
          this.objectName = context.objectName
          this.recordId = context.userId;
          console.log('Experience Site - objectName:', this.objectName, 'recordId:', this.recordId);
        }
        // this.refreshDocumentCategories();
      })
      .catch(error => {
        console.error('Error fetching user context:', error);
        this.showToast('Error', 'Failed to load user context.', 'error');
        this.isLoading = false;
      })
      .finally(() => {
        this.isLoading = false;
      });
    }
  loadNotes() {
        if (!this.recordId) return;
        getNotes({ recordId: this.recordId})
            .then(result => {
                  this.allNotes = result;
                this.filteredNotes = result;
            })
            .catch(error => {
                this.showErrorMessage('Error fetching notes: ' + this.getErrorMessage(error));
            })
            .finally(() => {
                this.isLoading = false;
            });
            
    }



    handleSearchKeyChange(event) {
        this.searchKey = event.target.value;
    }

    handleSearchEnter(event) {
        if (event.key === 'Enter') {
            this.applyFilters();
        }
    }

   
    // handleUserFilterChange(event) {
    //     this.selectedUserId = event.detail.value;
    //     console.log('searchTerm: ', this.selectedUserId );
    //     this.applyFilters();
    // }

    handleUserFilterChange(event) {
    this.selectedUserId = event.detail.userId;
    console.log('selectedUserId : ',this.selectedUserId);
    this.applyFilters(); // Apply your filtering logic here
}



    handleButtonClick(event) {
        const value = event.currentTarget.dataset.value;
        console.log('role: ' + value)
        this.newRole = value;
        const index = this.selectedButtonsValues.indexOf(value);
        if (index === -1) {
            this.selectedButtonsValues.push(value);
        } else {
            this.selectedButtonsValues.splice(index, 1);
        }
        this.selectedButtonsValues = [...this.selectedButtonsValues];

        if (this.showModal && !this.selectedNoteId) {
            this.newRole = this.selectedButtonsValues.join(', ');
            console.log('this.newRole 108: ' + this.newRole)

        }
        console.log('this.newRole 111: ' + this.newRole)
        console.log('selectedButtonsValues ' + this.selectedButtonsValues)

        this.newRole = this.selectedButtonsValues;
        this.applyFilters();
    }

    // -------------Handle new note click--------
    handleNewNoteClick() {
        this.showModal = true;
        this.modalTitle = 'New Note';
        this.modalButtonLabel = 'Create Note';
        // this.newRole = '';
        this.newNoteSubject = '';
        this.newNoteBody = '';
        this.selectedNoteId = null;
    }

    // -------------Handle editing/updating the note--------

    handleEditNoteClick(event) {
        const noteId = event.currentTarget.dataset.id;
        const note = this.allNotes.find(n => n.Id === noteId);
        if (note) {
            this.selectedNoteId = noteId;
            this.newNoteSubject = note.Subject;
            this.newNoteBody = note.Body;
            this.modalTitle = 'Edit Note';
            this.modalButtonLabel = 'Save Changes';
            this.showModal = true;
        }
    }
    // -------------Handle deleting new note--------

    handleDeleteNoteClick(event) {
        const noteId = event.currentTarget.dataset.id;
        this.isLoading = true;
        if (confirm('Are you sure you want to delete this note?')) {
            deleteNote({ noteId }) // Assume this is your Apex method
                .then(() => {
                    this.showSuccessMessage('Note deleted successfully');
                    this.filteredNotes = this.filteredNotes.filter(note => note.Id !== noteId);
                    
                    // return this.loadNotes(); // Refresh notes list
                })
                .catch(error => {
                    this.showErrorMessage('Error deleting note');
                    console.error(error);
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
    }

    // -------------Handle Modal opening & closing--------

    handleCloseModal() {
        this.showModal = false;
        this.newNoteSubject = '';
        this.newNoteBody = '';
        this.selectedNoteId = null;
        this.modalTitle = 'New Note';
        this.modalButtonLabel = 'Create Note';
    }

    handleSubjectChange(event) {
        this.newNoteSubject = event.target.value;
    }

    handleBodyChange(event) {
        this.newNoteBody = event.target.value;
    }

    // Handle creating new note
    // Create and update notes

    handleSaveNote() {
         if (!this.newNoteSubject || !this.newNoteBody) {
        this.showErrorMessage('Subject and body are required.');
        return;
    }
        this.isLoading = true;
        const noteData = JSON.stringify({
            recordId: this.recordId,
            objectName: this.objectApiName,
            noteId: this.selectedNoteId,
            subject: this.newNoteSubject,
            body: this.newNoteBody,
            role: this.newRole
        });

        if (this.selectedNoteId) {
            updateNote({
                noteId: this.selectedNoteId,
                subject: this.newNoteSubject,
                body: this.newNoteBody,
                role: this.selectedButtonsValues.join(';')
            })
                .then(updatedNote => {
                    this.allNotes = this.allNotes.map(note =>
                        note.Id === this.selectedNoteId ? updatedNote : note
                    );
                    this.applyFilters();
                    this.showSuccessMessage('Note updated successfully.');
                    this.handleCloseModal();
                })
                .catch(error => {
                    this.showErrorMessage('Error updating note: ' + this.getErrorMessage(error));
                })
                .finally(() => {
                    this.isLoading = false;
                });
        } else {
            createNote({
                recordId: this.recordId,
                objectName: this.objectApiName,
                subject: this.newNoteSubject,
                body: this.newNoteBody,
                role: this.selectedButtonsValues.join(';')
            })
                .then(note => {
                    this.allNotes = [note, ...this.allNotes];
                    this.applyFilters();
                    this.showSuccessMessage('Note created successfully.');
                    this.handleCloseModal();
                })
                .catch(error => {
                    this.showErrorMessage('Error creating note: ' + this.getErrorMessage(error));
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
    }


// -----Handle applying filters-------

    applyFilters() {
        const search = this.searchKey.toLowerCase();
        console.log('allNotes : ', JSON.stringify(this.allNotes));

        this.filteredNotes = this.allNotes.filter(note => {
            // console.log('note : ',JSON.stringify(note));

            const matchesSearch =
                (note.Subject || '').toLowerCase().includes(search) ||
                (note.Body || '').toLowerCase().includes(search);

            const matchesUser = this.selectedUserId ? note.OwnerId === this.selectedUserId : true;

            const noteRoles = note.Role ? note.Role.split(';') : [];

            const matchesRole = this.selectedButtonsValues.length === 0
                ? true
                : noteRoles.some(role => this.selectedButtonsValues.includes(role));

            return matchesSearch && matchesUser && matchesRole;
        });

        console.log('filteredNotes : ', JSON.stringify(this.filteredNotes));
    }


   //-----------Utility methods----------

    showErrorMessage(message) {
        this.errorMessage = message;
        this.showError = true;
        setTimeout(() => {
            this.showError = false;
            this.errorMessage = '';
        }, 5000);
    }

    showSuccessMessage(message) {
        this.successMessage = message;
        this.showSuccess = true;
        setTimeout(() => {
            this.showSuccess = false;
            this.successMessage = '';
        }, 5000);
    }

    getErrorMessage(error) {
        return error.body && error.body.message ? error.body.message : error.message || 'An unknown error occurred.';
    }


    showToast(title, message, variant = 'success') {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

}