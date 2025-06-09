import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import STATUS_FIELD from '@salesforce/schema/Document__c.Status__c';
import getAllowedTemplateCategories from '@salesforce/apex/DocumentTemplateController.getTemplateCategories';
import getAllowedDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getDocumentsByCategory from '@salesforce/apex/DocumentTemplateController.getDocumentsByCategory';
import getAllDocuments from '@salesforce/apex/DocumentTemplateController.getAllDocuments';
import createTemplateWithDocuments from '@salesforce/apex/DocumentTemplateController.createTemplateWithDocuments';
import updateTemplateWithDocuments from '@salesforce/apex/DocumentTemplateController.updateTemplateWithDocuments';
import getDocumentsByTemplate from '@salesforce/apex/DocumentTemplateController.getDocumentsByTemplate';
import assignDocumentToRecord from '@salesforce/apex/DocumentTemplateController.assignDocumentToRecord';
import createDocument from '@salesforce/apex/DocumentTemplateController.createDocument';
import createDocumentCategory from '@salesforce/apex/DocumentTemplateController.createDocumentCategory';
import getActiveUsers from '@salesforce/apex/DocumentTemplateController.getActiveUsers';

export default class TemplateManager extends LightningElement {
    // ==================== Properties ====================
    // API Properties
    @api recordId;
     users = [];
    selectedUserId;
    // Boolean Flags
    @track isTemplateDropdownOpen = false;
    @track isDocumentDropdownOpen = false;
    @track isLoading = false;
    @track showModal = false;
    @track isEditModalOpen = false;
    @track isNewTemplate = false;

    // String Properties
    @track objectName;
    @track selectedTemplateCategory = '';
    @track selectedDocumentCategory = '';
    @track selectedCategoryType = '';
    @track selectedTemplateForEdit = '';
    @track selectedTemplateId;
    @track modalCategoryId = '';
    @track modalHeader = '';
    @track modalCategory = '';
    @track modalTemplateName = '';
    @track modalDocumentId = '';
    @track modalStatus = '';
    @track modalNotes = '';
    @track modalTeam = '';
    @track editableTemplateName = '';

    // Lists and Collections
    @track templateCategoryOptions = [];
    @track documentCategoryOptions = [];
    @track documentOptions = [];
    @track documentList = [];
    @track documentsForTemplate = [];
    @track statusOptions = [];
    @track templateDocumentList = [];
    @track newItemIds = [];
    @track deletedItemIds = [];
    @track originalDocumentIds = [];
    @track availableDocuments = [];
    wiredTemplateCategoriesResult;
    @track availableTasks = []
    // Static Options
    teamOptions = [
        { label: 'Underwriting', value: 'Underwriting' },
        { label: 'Processing', value: 'Processing' },
        { label: 'Funding', value: 'Funding' },
        { label: 'Compliance', value: 'Compliance' }
    ];

    // ==================== Getters ====================
    /**
     * Returns the modal title based on whether a new template is being created.
     */
    get modalTitle() {
        return this.isNewTemplate ? 'Add New Template' : 'Edit Template';
    }

    /**
     * Groups available documents by category for display.
     */
    get groupedAvailableDocuments() {
        if (!Array.isArray(this.availableDocuments) || this.availableDocuments.length === 0) {
            return [];
        }

        const categoryMap = {};
        const seenDocIds = new Set();
        const selectedIds = new Set(
            (this.templateDocumentList || []).map(d => d.id)
        );

        this.availableDocuments.forEach(doc => {
            if (!doc || !doc.id || seenDocIds.has(doc.id) || selectedIds.has(doc.id)) {
                return;
            }

            seenDocIds.add(doc.id);
            const category = doc.categoryName && doc.categoryName.trim() ? doc.categoryName : 'General';

            if (!categoryMap[category]) {
                categoryMap[category] = [];
            }

            categoryMap[category].push({ ...doc });
        });

        return Object.keys(categoryMap).map(categoryName => {
            const documentsWithNumbers = categoryMap[categoryName].map((doc, index) => ({
                ...doc,
                displayNumber: index + 1
            }));
            return {
                name: categoryName,
                documents: documentsWithNumbers
            };
        });
    }

    get groupedAvailableTasks() {
        const grouped = {};
        const selectedIds = new Set(
            (this.templateDocumentList || []).map(d => d.id)
        );

        if (this.availableTasks) {
            this.availableTasks.forEach(doc => {
                if (!doc || !doc.id || selectedIds.has(doc.id)) {
                    return;
                }

                const groupKey = doc.categoryName || 'Uncategorized';
                if (!grouped[groupKey]) {
                    grouped[groupKey] = [];
                }
                grouped[groupKey].push(doc);
            });
        }

        return Object.keys(grouped).map(key => ({
            name: key,
            documents: grouped[key]
        }));
    }
@api isDropdrownsVisble
    // ==================== Lifecycle Hooks ====================
    connectedCallback() {
        console.log('this.isDropdrownsVisble : ',this.isDropdrownsVisble );
        
    }

    // ==================== Wired Methods ====================
    @wire(getActiveUsers)
    wiredUsers({ error, data }) {
        if (data) {
            this.users = data.map(user => ({
                label: user.name,
                value: user.id
            }));
        } else if (error) {
            console.error('Error retrieving users:', error);
        }
    }

    handleUserChange(event) {
        this.selectedUserId = event.detail.value;
    }
    /**
     * Retrieves the current page reference to extract recordId and objectName.
     */
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            console.log('CurrentPageReference : ', pageRef);
            this.recordId = pageRef.attributes.recordId;
            this.objectName = pageRef.attributes.objectApiName;
        }
    }

    /**
     * Retrieves object info for Document__c.
     */
    @wire(getObjectInfo, { objectApiName: DOCUMENT_OBJECT })
    objectInfo;

    /**
     * Retrieves picklist values for the Status__c field.
     */
    @wire(getPicklistValues, {
        recordTypeId: '$objectInfo.data.defaultRecordTypeId',
        fieldApiName: STATUS_FIELD
    })
    wiredPicklistValues({ error, data }) {
        if (data) {
            this.statusOptions = data.values;
        } else if (error) {
            console.error('Error loading picklist values', error);
        }
    }
@track wiredDocumentsResult;
    /**
     * Fetches all available documents.
     */
    @wire(getAllDocuments)
    wiredDocuments(result) {
       this.wiredDocumentsResult = result; // capture the full wire response

    const { error, data } = result;
    if (data) {
        console.log('206: Documents fetched successfully:', data);

        this.availableDocuments = data.documents;
        this.availableTasks = data.tasks;
    } else if (error) {
        this.error = error;
        console.error('Error fetching documents:', this.error);
    }
    }

    refreshDocuments() {
    refreshApex(this.wiredDocumentsResult)
        .then(() => {
            console.log('🔄 Documents refreshed');
        })
        .catch(error => {
            console.error('Refresh error:', error);
        });
}

//  @wire(getAllowedTemplateCategories)
//     wiredCategories(result) {
//         this.wiredTemplateCategoriesResult = result.data;
//         console.log('result: ',result.data);
//         console.log('wiredTemplateCategoriesResult: ',this.wiredTemplateCategoriesResult);
        
      
//             // this.templateCategoryOptions = result.data.map(item => {
//             //     const templateName = item.template?.name || '';
//             //     return {
//             //         categoryId: item.id,
//             //         categoryName: item.name,
//             //         templateId: item.template?.id,
//             //         templateName: templateName,
//             //         showEdit: true
//             //     };
//             // });
       
//     }
     refreshTemplateCategories() {
        //  this.isLoading = true;
    getAllowedTemplateCategories()
        .then(result => {
            console.log('result: '+result);
            
            this.templateCategoryOptions = result.map(item => {
                const templateName = item.template?.name || '';
                return {
                    categoryId: item.id,
                    categoryName: item.name,
                    templateId: item.template?.id,
                    templateName: templateName,
                    showEdit: true
                };
            });
        })
        .catch(error => this.showError('Error loading template categories', error))
        .finally(() => (this.isLoading = false));

    }
    refreshDocumentCategories(){
        
          getAllowedDocumentCategories()
            .then(result => {
                console.log('getAllowedDocumentCategories:', result);
                // this.documentCategoryOptions = [...this.documentCategoryOptions, ...result];
                this.documentCategoryOptions = result;
                this.isDocumentDropdownOpen = !this.isDocumentDropdownOpen;
                this.isTemplateDropdownOpen = false;
             
            })
            .catch(error => this.showError('Error loading document categories', error))
            .finally(() => (this.isLoading = false));
    }
    // ==================== Event Handlers ====================
    /**
     * Toggles the template category dropdown and fetches template categories.
     */
    handleAddTemplate() {
         this.isTemplateDropdownOpen = !this.isTemplateDropdownOpen;
            this.isDocumentDropdownOpen = false;
            console.log('wiredTemplateCategoriesResult: '+JSON.stringify(this.wiredTemplateCategoriesResult));
            
            this.refreshTemplateCategories();
}

 

    handleOutsideClick = (event) => {
    const dropdowns = this.template.querySelectorAll('.dropdown-list');
    let clickedInsideDropdown = false;

    dropdowns.forEach(dropdown => {
        if (dropdown.contains(event.target)) {
            clickedInsideDropdown = true;
        }
    });

    if (!clickedInsideDropdown) {
        this.isTemplateDropdownOpen = false;
        // this.isDocumentDropdownOpen = false;
        // this.isDocumentOptions = false;
        document.removeEventListener('click', this.handleOutsideClick);
    }
};


    handleDropdownClick(event) {
        // Stops propagation inside dropdowns so clicks there don't close them
        event.stopPropagation();
    }

    /**
     * Toggles the document category dropdown and fetches document categories.
     */

    @track selectedDocumentCategoryId = ''; // New: Track selected category

    /**
     * Toggles the document category dropdown and fetches document categories.
     */

     
    handleAddDocument() {
        // this.isLoading = true;
            this.refreshDocumentCategories();
        
    }
    // handleAddDocument() {
    //     this.isLoading = true;
    //     getAllowedDocumentCategories()
    //         .then(result => {
    //             console.log('getAllowedDocumentCategories : ', result);
    //             this.documentCategoryOptions = result;
    //             this.isDocumentDropdownOpen = !this.isDocumentDropdownOpen;
    //             this.isTemplateDropdownOpen = false;
    //             if (!this.isDocumentDropdownOpen) {
    //                 // Reset state when closing dropdown
    //                 this.documentOptions = [];
    //                 this.selectedDocumentCategoryId = '';
    //             }

    //             if (this.isDocumentDropdownOpen) {
    //                 setTimeout(() => {
    //                     document.addEventListener('click', this.handleOutsideClick);
    //                 }, 0);
    //             } else {
    //                 document.removeEventListener('click', this.handleOutsideClick);
    //             }
    //         })
    //         .catch(error => this.showError('Error loading document categories', error))
    //         .finally(() => (this.isLoading = false));
    // }

    /**
     * Fetches documents for a selected template category.
     * @param event The click event containing the template ID
     */
    handleTemplateCategoryClick(event) {
        const templateId = event.currentTarget.dataset.id;
        this.isLoading = true;
        console.log('templateId : ', templateId);
        console.log('recordId : ', this.recordId);
        console.log('objectName : ', this.objectName);
        getDocumentsByTemplate({ templateId: templateId, recordId: this.recordId, objectName: this.objectName })
            .then(result => {
                console.log('getDocumentsByTemplate : ', JSON.stringify(result));
                this.documentList = [...this.documentList, ...result];
                this.sendDocumentsToParent(result);
                this.isTemplateDropdownOpen =false;
            })
            .catch(error => this.showError('Error fetching template items', error))
            .finally(() => (this.isLoading = false));
    }

    /**
     * Fetches documents for a selected document category.
     * @param event The click event containing the category ID and name
     */
    /**
     * Fetches documents for a selected document category.
     * @param event The click event containing the category ID and name
     */
    // handleDocumentCategoryClick(event) {
    //     const categoryId = event.currentTarget.dataset.id;
    //     const categoryName = event.currentTarget.dataset.categoryname;
    //     this.isLoading = true;
    //     console.log('Fetching documents for:', { categoryId, categoryName });

    //     // Only fetch if a different category is selected
    //     if (this.selectedDocumentCategoryId !== categoryId) {
    //         this.selectedDocumentCategoryId = categoryId;
    //         this.documentOptions = []; // Clear previous documents
    //         getDocumentsByCategory({ categoryId })
    //             .then(result => {
    //                 console.log('getDocumentsByCategory result:', JSON.stringify(result));
    //                 if (result && result.documents && Array.isArray(result.documents)) {
    //                     this.documentOptions = [...result.documents]; // New array to ensure reactivity
    //                     console.log('documentOptions set:', JSON.stringify(this.documentOptions));
    //                     if (result.documents.length === 0) {
    //                         console.warn('No documents found for category:', categoryName);
    //                         this.showError('No Documents', `No documents available for category ${categoryName}.`);
    //                     }
    //                 } else {
    //                     console.warn('Invalid or empty document list:', result);
    //                     this.documentOptions = [];
    //                     this.showError('Error', 'No documents found or invalid response.');
    //                 }
    //             })
    //             .catch(error => {
    //                 console.error('Error fetching documents by category:', error);
    //                 this.documentOptions = [];
    //                 this.showError('Error fetching documents by category', error);
    //             })
    //             .finally(() => {
    //                 this.isLoading = false;
    //             });
    //     } else {
    //         this.isLoading = false; // Skip fetch if same category
    //     }
    // }
    isDocumentOptions = false
    // handleDocumentCategoryClick(event) {
    //     const categoryId = event.currentTarget.dataset.id;
    //     const categoryName = event.currentTarget.dataset.categoryname;
    //     this.isLoading = true;
    //     console.log('categoryId:',categoryId);
    //     console.log('categoryName:',categoryName);
        
    //     getDocumentsByCategory({ categoryId })
    //         .then(result => {
    //     console.log('result:',result);

    //             if (result && result.documents) {
    //                 this.documentOptions = result.documents;
    //                 this.isDocumentOptions = true;
    //                 console.log('documentOptions loaded:', this.documentOptions);
    //             }
    //         })
    //         .catch(error => this.showError('Error fetching documents by category', error))
    //         .finally(() => (this.isLoading = false));
    // }

    handleDocumentCategoryClick(event) {
    const categoryId = event.currentTarget.dataset.id;
    const categoryName = event.currentTarget.dataset.categoryname;

    // If the same category is clicked again, toggle it off
    if (this.selectedDocumentCategoryId === categoryId) {
        this.isDocumentOptions = false;
        this.documentOptions = [];
        this.selectedDocumentCategoryId = null;
        return;
    }

    // Set loading and reset prior state
    this.isLoading = true;
    // this.isDocumentOptions = false;
    this.documentOptions = [];
    this.selectedDocumentCategoryId = categoryId;

    console.log('Fetching documents for:', { categoryId, categoryName });

    getDocumentsByCategory({ categoryId })
        .then(result => {
            console.log('getDocumentsByCategory result:', result);
            if (result && result.documents && result.documents.length > 0) {
                this.documentOptions = [...result.documents];
                this.isDocumentOptions = true;
            } else {
                this.showError('No Documents', `No documents found for category ${categoryName}.`);
            }
        })
        .catch(error => {
            this.showError('Error fetching documents by category', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
}


    /**
     * Handles document selection and assigns it to a record if applicable.
     * @param event The click event containing document details
     */
    handleDocumentSelect(event) {
        const documentId = event.currentTarget.dataset.id;
        const selectedLabel = event.currentTarget.dataset.name;
        const category = event.currentTarget.dataset.category;
        const status = event.currentTarget.dataset.status;
        const team = event.currentTarget.dataset.team;
        const alreadyExists = this.documentList.some(doc => doc.id === documentId);
        if (!alreadyExists) {
            this.documentList = [
                ...this.documentList,
                {
                    id: documentId,
                    name: selectedLabel,
                    type: 'document',
                    status: status,
                    team: team,
                    category: category
                }
            ];
        }
        if (this.recordId && this.objectName && documentId) {
            assignDocumentToRecord({
                documentId: documentId,
                recordId: this.recordId,
                objectName: this.objectName
            })
                .then((newDoc) => {
                    console.log('newDoc: ', newDoc);
                    this.showSuccess('Success', 'Document added');
                    this.isDocumentDropdownOpen = false;
                    this.documentOptions = [];
                    this.sendDocumentsToParent([newDoc]);
                })
                .catch(error => {
                    this.showError('Duplicate Document', error);
                    console.error('Error assigning document to record:', error);
                });
        }
    }

    /**
     * Opens the modal for creating a new document.
     * @param event The click event containing category details
     */
    handleAddNewDocument(event) {
        this.modalCategoryId = event.currentTarget.dataset.categoryid;
        const categoryName = event.currentTarget.dataset.categoryname;
        this.modalCategory = categoryName;
        this.modalHeader = 'Add ' + categoryName + ' Document';
        this.modalTemplateName = '';
        this.modalDocumentId = '';
        this.showModal = true;
    }

    /**
     * Handles changes to the modal input for template name.
     * @param event The input event
     */
    handleModalInputChange(event) {
        this.modalTemplateName = event.target.value;
    }

    /**
     * Handles changes to the document selection in the modal.
     * @param event The input event
     */
    handleDocumentChange(event) {
        this.modalDocumentId = event.detail.value;
    }

    /**
     * Handles changes to the team selection in the modal.
     * @param event The input event
     */
    handleTeamChange(event) {
        this.modalTeam = event.detail.value;
        console.log('modalTeam:' + this.modalTeam);
    }

    /**
     * Closes the modal without saving.
     */
    handleModalCancel() {
        this.showModal = false;
    }

    /**
     * Saves a new document created via the modal.
     */
    handleSaveNewDocument() {
        this.isLoading = true;
        const input = {
            categoryId: this.modalCategoryId,
            name: this.modalTemplateName,
            status: this.modalStatus || '',
            team: this.modalTeam || '',
            type: 'document',
            relatedTo: this.recordId,
            objectName: this.objectName,
            assignedToId: this.selectedUserId
        };
        console.log('input: ' + JSON.stringify(input));
        createDocument({ inputJson: JSON.stringify(input) })
            .then((newDocument) => {
                console.log('newDocument: ' + JSON.stringify(newDocument));
                this.showModal = false;
                this.isTemplateDropdownOpen = false;
                this.isDocumentDropdownOpen = false;
                this.showSuccess('Created successfully', newDocument.name + ' document created.');
                this.documentList = [...this.documentList, newDocument];
                this.sendDocumentsToParent([newDocument]);
            })
            .catch(error => this.showError('Creation failed', error))
            .finally(() => (this.isLoading = false));
    }

    /**
     * Handles changes to the template name for editing.
     * @param event The input event
     */
    handleTemplateNameChange(event) {
        this.editableTemplateName = event.target.value;
        console.log('editableTemplateName : ', this.editableTemplateName);
    }

    /**
     * Closes the edit template modal.
     */
    closeEditModal() {
        this.editableTemplateName = '';
        this.isEditModalOpen = false;
    }

    /**
     * Adds a document to the template being edited or created.
     * @param event The click event containing the document ID
     */
    handleAddToTemplate(event) {
        const docId = event.currentTarget.dataset.id;

        // Check both lists
        let doc = this.availableDocuments.find(d => d.id === docId);
        if (!doc) {
            doc = this.availableTasks.find(t => t.id === docId);
        }

        if (doc) {
            // Add to the unified template list
            this.templateDocumentList = [...this.templateDocumentList, doc];

            // Track new additions
            if (
                !this.newItemIds.includes(docId) &&
                !this.originalDocumentIds?.includes(docId)
            ) {
                this.newItemIds.push(docId);
            }

            if (this.isNewTemplate && !this.newItemIds.includes(docId)) {
                this.newItemIds.push(docId);
            }

            // Clean up any removed entry
            this.deletedItemIds = this.deletedItemIds.filter(id => id !== docId);

            console.log('Added docId:', docId);
            console.log('newItemIds:', JSON.stringify(this.newItemIds));
        }
    }

    /**
     * Removes a document from the template being edited or created.
     * @param event The click event containing the document ID
     */
    handleRemoveFromTemplate(event) {
        const docId = event.currentTarget.dataset.id;
        const doc = this.templateDocumentList.find(d => d.id === docId);

        if (doc) {
            // Remove from template list
            this.templateDocumentList = this.templateDocumentList.filter(d => d.id !== docId);

            // Clean from new additions
            this.newItemIds = this.newItemIds.filter(id => id !== docId);

            // Track deleted if it wasn't new and not already deleted
            if (!this.newItemIds.includes(docId) && !this.deletedItemIds.includes(docId)) {
                this.deletedItemIds.push(docId);
            }

            console.log('Removed docId:', docId);
            console.log('deletedItemIds:', JSON.stringify(this.deletedItemIds));
        }
    }

    /**
     * Opens the modal for creating a new template.
     * @param event The click event
     */
    handleAddNewTemplate(event) {
        this.editableTemplateName = '';
        this.isNewTemplate = true;
        this.isEditModalOpen = true;
        this.templateDocumentList = [];
        console.log('event : ', event.currentTarget);
    }

    /**
     * Opens the modal for editing an existing template.
     * @param event The click event containing template details
     */
    handleEditTemplate(event) {
        this.refreshDocuments();
        this.isNewTemplate = false;
        const templateId = event.currentTarget.dataset.templateid;
        this.selectedTemplateId = templateId;
        const categoryId = event.currentTarget.dataset.categoryid;
        const templateName = event.currentTarget.dataset.templatename;
        console.log('templateId:', templateId);
        console.log('categoryId:', categoryId);
        console.log('templateName:', templateName);
        if (!Array.isArray(this.templateCategoryOptions)) {
            console.error('templateCategoryOptions is not an array:', this.templateCategoryOptions);
            return;
        }
        this.selectedTemplateForEdit = this.templateCategoryOptions.find(
            t => t.templateId === templateId
        );
        if (!this.selectedTemplateForEdit) {
            console.error('No template found with templateId:', templateId);
            return;
        }
        console.log('selectedTemplateForEdit:', JSON.stringify(this.selectedTemplateForEdit));
        this.isLoading = true;
        getDocumentsByTemplate({ templateId: templateId, recordId: null, objectName: null })
            .then(result => {
                this.isEditModalOpen = true;
                this.templateDocumentList = result;
                console.log('Template Items:', this.templateDocumentList);
            })
            .catch(error => {
                console.error('Error fetching template items', error);
                this.showError('Error fetching template items', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }
    get templateNameValue() {
        return this.isNewTemplate ? '' : this.selectedTemplateForEdit?.templateName || '';
    }

    /**
     * Saves changes to a template, either creating a new one or updating an existing one.
     */
    handleSaveTemplateChanges() {
        console.log('selectedTemplateId : ', this.selectedTemplateId);
        console.log('editableTemplateName : ', this.editableTemplateName);
        console.log('deletedItemIds : ', this.deletedItemIds);
        console.log('newItemIds : ', this.newItemIds);
        console.log('isNewTemplate ?: ', this.isNewTemplate);
        if (!this.isNewTemplate) {
            updateTemplateWithDocuments({
                templateId: this.selectedTemplateId,
                newTemplateName: this.editableTemplateName,
                newItemIds: this.newItemIds,
                deletedItemIds: this.deletedItemIds
            })
                .then((updatedTemplate) => {
                  this.refreshTemplateCategories();

                    this.showSuccess('Success', updatedTemplate.name+' Template updated successfully');
                    console.log('Updated template:', updatedTemplate);
                    this.templateDocumentList = updatedTemplate.documents;
                    this.originalDocumentIds = updatedTemplate.documents.map(doc => doc.id);
                    this.newItemIds = [];
                    this.deletedItemIds = [];
                    this.closeEditModal();
                })
                .catch((error) => {
                    console.error('Error updating template:', error);
                    this.showError('Error updating template', error);
                });
        } else {
            createTemplateWithDocuments({
                templateName: this.editableTemplateName,
                documentIds: this.newItemIds
            })
                .then((createdTemplate) => {
                     this.refreshTemplateCategories();
                    console.log('Created template:', createdTemplate);

                    this.showSuccess('Success', createdTemplate.name+' Template is created Successfully');
                    this.closeEditModal();
                    this.editableTemplateName = '';
                    this.refreshTemplateList();
                })
                .catch(error => {
                    console.error('Error creating template:', error);
                    this.showError('Error creating template', error);
                });
        }
    }

    /**
     * Handles changes to the status selection in the modal.
     * @param event The input event
     */
    handleStatusChange(event) {
        this.modalStatus = event.detail.value;
    }

    /**
     * Handles changes to the notes input in the modal.
     * @param event The input event
     */
    handleNotesChange(event) {
        this.modalNotes = event.detail.value;
    }

    // ==================== Utility Methods ====================
    /**
     * Sends the document list to the parent component via a custom event to append to existing list.
     * @param documents The list of new documents to append
     */
    sendDocumentsToParent(documents) {
        console.log('sendDocumentsToParent : ', JSON.stringify(documents));
        if (!Array.isArray(documents) || documents.length === 0) {
            console.warn('Invalid or empty documents array:', documents);
            return; // Exit if documents is not a valid array
        }
        // Validate each document object
        const validDocuments = documents.filter(doc => doc && typeof doc === 'object' && doc.id);
        if (validDocuments.length !== documents.length) {
            console.warn('Some documents are invalid, filtered out:', documents.filter(doc => !doc || typeof doc !== 'object' || !doc.id));
        }
        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
            detail: {
                documents: validDocuments,
                append: true
            }
        }));
    }

    /**
     * Displays an error toast message.
     * @param title The title of the toast
     * @param error The error object or message
     */
    showError(title, error) {
        const message = (typeof error === 'string') ? error : (error.body?.message || 'An unknown error occurred.');
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant: 'error'
            })
        );
    }

    /**
     * Displays a success toast message.
     * @param title The title of the toast
     * @param message The success message
     */
    showSuccess(title, message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title,
                message,
                variant: 'success'
            })
        );
    }

    /**
     * Refreshes the template list (placeholder for implementation).
     */
    refreshTemplateList() {
        // Implement refresh logic if needed
    }



    // modal state
showNewCategoryModal = false;
newCategoryName = '';
newCategoryDescription = '';

// open modal
handleAddNewCategory() {
    this.showNewCategoryModal = true;
}

// close modal
closeNewCategoryModal() {
    this.showNewCategoryModal = false;
    this.newCategoryName = '';
    this.newCategoryDescription = '';
}

// handle inputs
handleNewCategoryInput(event) {
    this.newCategoryName = event.target.value;
}
handleNewCategoryDescriptionInput(event) {
    this.newCategoryDescription = event.target.value;
}


createNewCategory() {
    const categoryName = this.newCategoryName?.trim();

    if (!categoryName) {
        this.dispatchEvent(new ShowToastEvent({
            title: 'Error',
            message: 'Category name cannot be empty.',
            variant: 'error'
        }));
        return;
    }

    console.log('Creating category:', categoryName);

    createDocumentCategory({ name: categoryName })  
        .then((newCategory) => {
            this.refreshDocumentCategories();

            console.log('newCategory: ',newCategory);
             this.dispatchEvent(new CustomEvent('categorycreated', {
                detail: {
                    category: newCategory
                },
                bubbles: true,
                composed: true
            }));

            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: `Category "${newCategory.name}" created.`,
                variant: 'success'
            }));


            this.closeNewCategoryModal();
            this.newCategoryName = ''; // Reset input
        })
        .catch(error => {
            console.error('Error creating category:', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'Failed to create category.',
                variant: 'error'
            }));
        });
}


}