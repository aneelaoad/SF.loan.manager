import { LightningElement, track, api, wire } from 'lwc';
import getAssignedDocuments from '@salesforce/apex/DocumentTemplateController.getAssignedDocuments';
import { CurrentPageReference } from 'lightning/navigation';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getArchivedDocuments from '@salesforce/apex/DocumentTemplateController.getArchivedDocuments';
import archiveDocumentAssignment from '@salesforce/apex/DocumentTemplateController.archiveDocumentAssignment';
import deleteArchivedAssignments from '@salesforce/apex/DocumentTemplateController.deleteArchivedAssignments';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import STATUS_FIELD from '@salesforce/schema/Document__c.Status__c';
import createDocument from '@salesforce/apex/DocumentTemplateController.createDocument';
import sendReadyToSendDocuments from '@salesforce/apex/DocumentTemplateController.sendReadyToSendDocuments';
import restoreArchivedAssignments from '@salesforce/apex/DocumentTemplateController.restoreArchivedAssignments';
import getActiveUsers from '@salesforce/apex/DocumentTemplateController.getActiveUsers';

// -------------------------------------
// 02. Component Definition
// -------------------------------------
export default class CustomTaskManager extends LightningElement {
    // -------------------------------------
    // 03. Properties
    // -------------------------------------
    recordId;
    users = [];
    objectName = ''
    selectedUserId;
    @track selectedCategories = [];
    @track showVerification = false;
    @track isArchived = false;
    @track masterDocumentList = [];
    wiredDocumentResult;
    @track archivedList = [];
    @track isEmailModalOpen = false;
    @track readyToSendDocuments = [];
    isLoading = false;
    archivedWireResult;
    @track documentCategoryOptions = [];
    @track selectedDocumentCategory;
    showModal = false;
    categoryList = []
    // -------------------------------------
    // 04. Wired Method to Get Page Reference
    // -------------------------------------
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            // Log the current page reference for debugging
            console.log('CurrentPageReference: ', pageRef);

            // Extract recordId and objectName from the URL or page reference
            this.recordId = pageRef.attributes.recordId;
            this.objectName = pageRef.attributes.objectApiName;
            console.log('recordId: ', this.recordId);
            console.log('objectName: ', this.objectName);
        }
    }

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
    // -------------------------------------
    // 05. Wired Method to Load Document Categories
    // -------------------------------------
    refreshDocumentCategories() {
        getDocumentCategories()
            .then(data => {
                console.log('data->>> ', data);
                this.documentCategoryOptions = data.map(item => ({
                    label: item.name,
                    value: item.id
                }));

                this.categoryList = data.map(cat => ({
                    name: cat.name,
                    circleClass: this.getCategoryClass(cat.name),
                    labelClass: 'category-label'
                }));

                // Add static "Reset" option
                this.categoryList.push({
                    name: 'Reset',
                    icon: 'utility:refresh',
                    isReset: true,
                    labelClass: 'category-label'
                });

                console.log('categoryList (refreshed): ', JSON.stringify(this.categoryList));
                console.log('documentCategoryOptions (refreshed): ', JSON.stringify(this.documentCategoryOptions));
            })
            .catch(error => {
                console.error('Error loading categories:', error);
                this.categoryList = [];
            });
    }


    // -------------------------------------
    // 06. Helper Method for Category Styling
    // -------------------------------------
    getCategoryClass(name) {
        // Define style mapping for category dots
        const styleMap = {
            'Income': 'income-dot',
            'Assets': 'assets-dot',
            'Credit': 'credit-dot',
            'REO': 'reo-dot',
            'Other': 'other-dot',
            'Disclosures': 'disclosures-dot',
            'Compliance': 'compliance-dot'
        };
        return styleMap[name] || 'default-dot'; // Fallback class
    }

    // -------------------------------------
    // 07. Wired Method to Load Assigned Documents
    // -------------------------------------
    @wire(getAssignedDocuments, { recordId: '$recordId', objectName: '$objectName' })
    wiredDocuments(result) {
        this.wiredDocumentResult = result; // Save for refresh
        console.log("wiredDocuments: ", this.wiredDocumentResult);

        const { data, error } = result;

        if (data) {
            this.masterDocumentList = data;

            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.masterDocumentList = [];
        }
    }

    // -------------------------------------
    // 08. Wired Method to Load Archived Documents
    // -------------------------------------
    @wire(getArchivedDocuments, { recordId: '$recordId' })
    wiredArchivedDocs(result) {
        this.archivedWireResult = result;
        console.log('getArchivedDocuments: '+JSON.stringify(this.archivedWireResult));
        
        const { data, error } = result;

        if (data) {
            this.archivedList = data;
        } else if (error) {
            console.error('Error fetching archived docs', error);
        }
    }

    // -------------------------------------
    // 09. Wired Method to Get Document Object Info
    // -------------------------------------
    @wire(getObjectInfo, { objectApiName: DOCUMENT_OBJECT })
    objectInfo;

    // -------------------------------------
    // 10. Wired Method to Get Status Picklist Values
    // -------------------------------------
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

    // -------------------------------------
    // 11. Lifecycle Hook: Connected Callback
    // -------------------------------------
    connectedCallback() {
        this.refreshDocumentCategories();
        // // Load allowed document categories on component initialization
        // getAllowedDocumentCategories()
        //     .then(result => {
        //         console.log('Document Categories: ', result);
        //         this.documentCategoryOptions = result.map(item => ({
        //             label: item.name,
        //             value: item.id
        //         }));
        //     })
        //     .catch(error => this.showError('Error loading document categories', error))
        //     .finally(() => (this.isLoading = false));
    }
    // Parent component JS
    handleCategoryCreated(event) {
        const newCategory = event.detail.category;
        // console.log('Received new category from child:', newCategory);
        // this.categoryList = [...this.categoryList, newCategory];
        // this.categoryList = [...this.categoryList, newCategory]

        //     console.log('Updated categoryList:', this.categoryList);
        this.refreshDocumentCategories();
        // Add your logic here to handle the new category
        // For example, you might add it to an array of categories:
        // this.categories = [...this.categories, newCategory];

        //    const newCategory = {
        //         ...event.detail.category,      // Original fields
        //         isReset: false,                // Default values
        //         icon: 'utility:refresh',
        //         circleClass: 'slds-circle slds-m-right_xx-small',
        //         labelClass: 'slds-truncate'
        //     };
    }

    // -------------------------------------
    // 12. Handler for Document Category Change
    // -------------------------------------
    handleDocumentCategoryChange(event) {
        console.log('handleDocumentCategoryChange', event);
        this.selectedDocumentCategory = event.detail.value;
    }

    // -------------------------------------
    // 13. Handler for Status Change
    // -------------------------------------
    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
    }

    // -------------------------------------
    // 14. Handler for Deleting All Archived Documents
    // -------------------------------------

    // -------------------------------------
    // Shared Delete Archived Handler
    // -------------------------------------
    deleteArchivedDocuments(documentIds, name = null) {
        if (!documentIds || documentIds.length === 0) return;

        const recordId = this.recordId;
        const objectName = this.objectName;

        deleteArchivedAssignments({ documentIds, recordId, objectName })
            .then(() => {
                // Filter out deleted documents from archivedList
                this.archivedList = this.archivedList.filter(doc => !documentIds.includes(doc.id));
                this.masterDocumentList = this.masterDocumentList.filter(doc => !documentIds.includes(doc.id));
                this.isArchived = this.archivedList.length > 0;

                this.dispatchEvent(new ShowToastEvent({
                    title: 'Deleted',
                    message: name
                        ? `Archived document "${name}" deleted.`
                        : 'All archived documents deleted.',
                    variant: 'success'
                }));

                 return Promise.all([
                    refreshApex(this.archivedWireResult),
                    refreshApex(this.wiredDocumentResult) // Refresh active documents
                ]);
                // return refreshApex(this.archivedWireResult);
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error?.body?.message || 'Failed to delete archived document(s).',
                    variant: 'error'
                }));
            });
    }

    // -------------------------------------
    // 16. Delete Single Archived Document
    // -------------------------------------
    handleDeleteArchived(event) {
        const documentId = event.currentTarget.dataset.id;
        const name = event.currentTarget.dataset.name;
        this.deleteArchivedDocuments([documentId], name);
    }

    // -------------------------------------
    // 14. Delete All Archived Documents
    // -------------------------------------
    handleDeleteAllArchived() {
        const documentIds = this.archivedList.map(doc => doc.id);
        this.deleteArchivedDocuments(documentIds);
    }


    // -------------------------------------
    // 17. Handler for Archiving a Document
    // -------------------------------------
    handleArchiveRecord(event) {
        const documentId = event.currentTarget.dataset.id;
        const name = event.currentTarget.dataset.name;
        console.log('handleArchiveRecord: ', documentId);

        archiveDocumentAssignment({ documentId, recordId: this.recordId })
            .then(() => {
                // Remove from master list
                
                this.masterDocumentList = this.masterDocumentList.filter(row => row.id !== documentId);
                return Promise.all([
                    refreshApex(this.archivedWireResult),
                    refreshApex(this.wiredDocumentResult) // Refresh active documents
                ]);
                // return refreshApex(this.archivedWireResult);
            })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Archived',
                        message: name + ' archived successfully.',
                        variant: 'info'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body?.message || 'Failed to archive document.',
                        variant: 'error'
                    })
                );
            });
    }

    // -------------------------------------
    // 18. Handler for Closing Modal
    // -------------------------------------
    handleCloseModal() {
        this.isArchived = false;
    }

    // -------------------------------------
    // 19. Handler for Restoring an Archived Document
    // -------------------------------------


    restoreDocumentsHelper(documentIds, successMessage, skipArchiveReset = false) {
        if (!documentIds || documentIds.length === 0) return;

        restoreArchivedAssignments({ documentIds, recordId: this.recordId })
            .then((restoredDocuments) => {
                // Remove restored docs from archived list
                this.archivedList = this.archivedList.filter(doc => !documentIds.includes(doc.id));

                // Optional: Reset archive view flag
                if (!skipArchiveReset) {
                    this.isArchived = false;
                    this.isArchive = false;
                }

                // Update master document list
                if (restoredDocuments && restoredDocuments.length > 0) {
                    const existingIds = new Set(this.masterDocumentList.map(doc => doc.id));
                    const newDocs = restoredDocuments.filter(doc => !existingIds.has(doc.id));
                    this.masterDocumentList = [...this.masterDocumentList, ...newDocs];
                }


                return refreshApex(this.wiredDocumentResult); // Sync server data
            })
            .then(() => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Success',
                    message: successMessage,
                    variant: 'success'
                }));
            })
            .catch(error => {
                console.error('Restore failed: ', error);
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Failed to restore document(s).',
                    variant: 'error'
                }));
            });
    }
    handleRestoreArchived(event) {
        const documentId = event.currentTarget.dataset.id;
        const name = event.currentTarget.dataset.name;

        console.log('documentId:', documentId);
        console.log('recordId:', this.recordId);

        this.restoreDocumentsHelper([documentId], `${name} restored successfully.`, true);
    }
    handleRestoreAllArchived() {
        const documentIds = this.archivedList.map(item => item.id);
        if (documentIds.length === 0) return;

        this.restoreDocumentsHelper(documentIds, 'All archived documents restored.');
    }

    // handleRestoreArchived(event) {
    //     const documentId = event.currentTarget.dataset.id;
    //     const name = event.currentTarget.dataset.name;

    //      console.log('documentId: ', documentId);
    //      console.log('recordId: ', this.recordId);

    //     restoreArchivedAssignments({ documentIds: [documentId], recordId: this.recordId })
    //         .then((restoredDocuments) => {
    //         console.log('restoredDocuments', restoredDocuments);
    //             this.isArchived = false
    //             // Remove from archived list
    //             this.archivedList = this.archivedList.filter(doc => doc.id !== documentId);
    //             // Refresh active documents to include restored one
    //             console.log('handleRestoreArchived: ', this.archivedList);
    //         //     if (restoredDocuments && restoredDocuments.length > 0) {
    //             this.masterDocumentList = [...this.masterDocumentList, ...restoredDocuments];
    //             // this.masterDocumentList = [...this.masterDocumentList, ...restoredDocuments];
    //         // }
    //         console.log('handleRestoreArchived: archivedList:', this.archivedList);
    //         console.log('handleRestoreArchived: masterDocumentList:', this.masterDocumentList);
    //             // console.log('handleRestoreArchived:');

    //             // return refreshApex(this.wiredDocumentResult);
    //         })
    //         .then(() => {
    //             this.dispatchEvent(new ShowToastEvent({
    //                 title: 'Success',
    //                 message: name+' restored successfully.',
    //                 variant: 'success'
    //             }));
    //         })
    //         .catch(error => {
    //             console.error('Restore failed: ', error);
    //             this.dispatchEvent(new ShowToastEvent({
    //                 title: 'Error',
    //                 message: 'Failed to restore document.',
    //                 variant: 'error'
    //             }));
    //         });
    // }

    // // -------------------------------------
    // // 20. Handler for Restoring All Archived Documents
    // // -------------------------------------
    // handleRestoreAllArchived() {
    //     const documentIds = this.archivedList.map(item => item.id);
    //     if (documentIds.length === 0) return;

    //     restoreArchivedAssignments({ documentIds, recordId: this.recordId })
    //         .then((restoredDocuments) => {
    //             this.archivedList = [];
    //             this.isArchive=false;
    //             // Refresh active documents to include restored ones
    //             if (restoredDocuments && restoredDocuments.length > 0) {
    //             this.masterDocumentList = [...this.masterDocumentList, ...restoredDocuments];
    //         }
    //             return refreshApex(this.wiredDocumentResult);
    //         })
    //         .then(() => {
    //             this.dispatchEvent(new ShowToastEvent({
    //                 title: 'Restored',
    //                 message: 'All archived documents restored.',
    //                 variant: 'success'
    //             }));
    //         })
    //         .catch(error => {
    //             console.error('Restore All Failed: ', error);
    //             this.dispatchEvent(new ShowToastEvent({
    //                 title: 'Error',
    //                 message: error.body?.message || 'Failed to restore archived documents.',
    //                 variant: 'error'
    //             }));
    //         });
    // }

    // -------------------------------------
    // 21. Helper Method to Check Ready to Send Status
    // -------------------------------------
    isReadyToSend(status) {
        return status === 'Ready to Send';
    }

    // -------------------------------------
    // 22. Getter for Grouping Documents by Status
    // // -------------------------------------


    // get groupedByStatus() {
    //     const groups = {};
    //     const archivedIds = new Set((this.archivedList || []).map(item => item.id));

    //     let filteredDocuments = (this.masterDocumentList || []).filter(item => {
    //         if (!item) return false;
    //         if (archivedIds.has(item.id)) return false;
    //         if (this.selectedCategories.length === 0) return true;
    //         return this.selectedCategories.includes(item.Category__c); // Use Category__c ID
    //     });

    //     filteredDocuments.forEach(item => {
    //         const status = item.status || 'General';
    //         if (!groups[status]) {
    //             groups[status] = [];
    //         }
    //         groups[status].push({ ...item });
    //     });

    //     return Object.entries(groups).map(([status, items]) => ({
    //         status,
    //         items
    //     }));
    // }

    // -------------------------------------
    // 22. Getter for Grouping Documents by Status
    // -------------------------------------
    get groupedByStatus() {
        const groups = {};
        const archivedIds = new Set((this.archivedList || []).map(item => item.id));

        let filteredDocuments = (this.masterDocumentList || []).filter(item => {
            if (!item) return false;
            if (archivedIds.has(item.id)) return false;
            if (this.selectedCategories.length === 0) return true;
            // Match selected category names with the document's categoryName field
            return this.selectedCategories.includes(item.categoryName);
        });

        filteredDocuments.forEach(item => {
            const status = item.status || 'Other';
            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push({ ...item });
        });

        return Object.entries(groups).map(([status, items]) => ({
            status,
            items
        }));
    }
    // -------------------------------------
    // 23. Getter for Grouping with Ready to Send Flag
    // -------------------------------------
    get groupedByStatusWithReadyToSend() {
        return this.groupedByStatus.map(group => ({
            ...group,
            isReadyToSend: this.isReadyToSend(group.status)
        }));
    }
    get readyToSendDocsWithEmails() {
        // Filter documents with 'Ready to Send' status and extract id and email
        console.log('masterDocumentList:', JSON.stringify(this.masterDocumentList));

        const readyToSendDocs = (this.masterDocumentList || [])
            .filter(doc =>
                doc &&
                doc.status === 'Ready to Send' &&
                doc.assignedToEmail &&
                doc.id
            )
            .map(doc => ({
                id: doc.id,
                email: doc.assignedToEmail,
                // name:'Customer'
                name: doc.assignedTo || 'Customer'
            }));

        // Return the array of objects containing doc ID and email
        console.log('readyToSendDocs:', JSON.stringify(readyToSendDocs));

        return readyToSendDocs;
    }

    // -------------------------------------
    // 24. Getter for Status Keys
    // -------------------------------------
    get statusKeys() {
        return this.groupedByStatus.map(group => group.status);
    }

    // -------------------------------------
    // 25. Getter to Check if Master List is Empty
    // -------------------------------------
    get isEmpty() {
        return this.masterDocumentList.length === 0;
    }

    // -------------------------------------
    // 26. Property for Email Popover State
    // -------------------------------------
    isEmailPopoverOpen = false;

    // -------------------------------------
    // 27. Handler for Email Button Click
    // -------------------------------------
    handleEmailClick(event) {
        const groupId = event.currentTarget.dataset.groupId;
        // const readyToSendDocs = this.masterDocumentList.filter(doc => doc.status === 'Ready to Send');
        const readyToSendDocs = this.masterDocumentList.filter(
            doc => doc.status === 'Ready to Send' && doc.isArchived === false
        );

        console.log('readyToSendDocs: ' + JSON.stringify(readyToSendDocs));

        if (readyToSendDocs.length === 0) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'No documents are ready to send.',
                variant: 'error'
            }));
            return;
        }

        const documentIds = readyToSendDocs.map(doc => doc.id);

        sendReadyToSendDocuments({
            documentIds: documentIds,
            recordId: this.recordId,
            objectName: this.objectName
        })
            .then(result => {
                if (result.success) {
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Success',
                        message: result.message,
                        variant: 'success'
                    }));
                } else {
                    this.dispatchEvent(new ShowToastEvent({
                        title: 'Error',
                        message: result.message,
                        variant: 'error'
                    }));
                }
            })
            .catch(error => {
                this.dispatchEvent(new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Failed to send email.',
                    variant: 'error'
                }));
            });
    }
    // -------------------------------------
    // 28. Handler to Close Email Popover
    // -------------------------------------
    closeEmailPopover() {
        this.isEmailPopoverOpen = false;
    }

    // -------------------------------------
    // 29. Handler for Menu Selection
    // -------------------------------------
    handleMenuSelect(event) {
        const selected = event.detail.value;
        if (selected === 'newTemplate') {
            this.handleNewTemplate();
        } else if (selected === 'fromExisting') {
            this.handleFromExisting();
        }
    }

    // -------------------------------------
    // 30. Handler for Refresh Button Click
    // -------------------------------------
    handleRefreshClick() {
        console.log('Refresh button clicked!');
    }

    // -------------------------------------
    // 31. Handler for Archive Button Click
    // -------------------------------------
    handleArchiveClick() {
        this.isArchived = !this.isArchived;
        this.isLoading = true;
          console.log('Archive button clicked!');
        console.log('archivedWireResult', this.archivedWireResult);
          if (this.archivedWireResult) {
        refreshApex(this.archivedWireResult)
            .then(() => {
                this.archivedList = this.archivedWireResult.data;
        this.isLoading = false;

                console.log('Archived list refreshed');
            })
            .catch(error => {
                console.error('Error refreshing archived list:', error);
            });
    }
      
    }
    get hasArchivedDocs() {
    return this.archivedList && this.archivedList.length > 0;
}


    // -------------------------------------
    // 32. Handler for Mortgage App Button Click
    // -------------------------------------
    handleMortgageAppClick() {
        console.log('Mortgage App button clicked!');
    }

    // -------------------------------------
    // 33. Handler for Category Filter Click
    // -------------------------------------
    handleCategoryClick(event) {
        console.log('wiredDocumentResult: ', this.wiredDocumentResult);

        const clickedCategory = event.currentTarget.dataset.name;
        console.log('clickedCategory: ', clickedCategory);
        console.log('selectedCategories: ', this.selectedCategories);

        if (clickedCategory === 'Reset') {
            this.selectedCategories = [];
        } else {
            if (this.selectedCategories.includes(clickedCategory)) {
                this.selectedCategories = this.selectedCategories.filter(cat => cat !== clickedCategory);
            } else {
                this.selectedCategories = [...this.selectedCategories, clickedCategory];
            }
        }

        // Update category label classes based on selection
        this.categoryList = this.categoryList.map(cat => ({
            ...cat,
            labelClass: this.selectedCategories.includes(cat.name)
                ? 'category-label selected'
                : 'category-label'
        }));
    }

    // -------------------------------------
    // 34. Handler for Checkbox Change
    // -------------------------------------
    handleCheckboxChange(event) {
        const rowId = event.target.dataset.id;
        const isChecked = event.target.checked;

        const row = this.masterDocumentList.find(r => r.id === rowId);
        if (row) {
            row.isChecked = isChecked;
        }
    }

    // -------------------------------------
    // 35. Handler for Input Field Change
    // -------------------------------------
    handleInputChange(event) {
        const rowId = event.target.dataset.id;
        const field = event.target.dataset.field;
        const value = event.target.value;

        const row = this.masterDocumentList.find(r => r.id === rowId);
        if (row && field) {
            row[field] = value;
        }
    }

    // -------------------------------------
    // 36. Handler for Receiving Template Items
    // -------------------------------------
    handleTemplateItems(event) {
        const items = event.detail.documents;
        console.log('--------------------------');
        console.log('--------------------------');
        console.log('Received document/s: ', items);

        this.masterDocumentList = [...this.masterDocumentList, ...items];

        // Reset category selections
        this.selectedCategories = [];

        // Reset category label classes
        this.categoryList = this.categoryList.map(cat => ({
            ...cat,
            labelClass: 'category-label'
        }));
    }

    // -------------------------------------
    // 37. Handler for Modal Cancel
    // -------------------------------------
    handleModalCancel() {
        this.showModal = false;
    }

    // -------------------------------------
    // 38. Handler for Adding a New Task
    // -------------------------------------
    handleAddTask() {
        this.showModal = true;
    }

    // -------------------------------------
    // 39. Property for Modal Template Name
    // -------------------------------------
    modalTemplateName;

    // -------------------------------------
    // 40. Handler for Modal Input Change
    // -------------------------------------
    handleModalInputChange(event) {
        this.modalTemplateName = event.target.value;
        console.log('event.target.value: ', event.target.value);
        console.log('modalTemplateName: ', this.modalTemplateName);
    }

    // -------------------------------------
    // 41. Handler for Team Selection Change
    // -------------------------------------
    handleTeamChange(event) {
        this.modalTeam = event.detail.value;
    }

    // -------------------------------------
    // 42. Handler for Status Selection Change
    // -------------------------------------
    handleStatusChange(event) {
        this.modalStatus = event.detail.value;
    }

    // -------------------------------------
    // 43. Handler for Notes Change
    // -------------------------------------
    handleNotesChange(event) {
        this.modalNotes = event.detail.value;
    }

    // -------------------------------------
    // 44. Handler for Saving a New Document
    // -------------------------------------
    handleSaveNewDocument() {
        this.isLoading = true;

        // Prepare input object for document creation
        const input = {
            categoryId: this.selectedDocumentCategory,
            name: this.modalTemplateName,
            status: this.modalStatus || '',
            team: this.modalTeam || '',
            type: 'Task',
            relatedTo: this.recordId,
            assignedToId: this.selectedUserId,
            objectName: this.objectName

        };

        console.log('input: ', JSON.stringify(input));

        createDocument({ inputJson: JSON.stringify(input) })
            .then((newDocument) => {
                this.masterDocumentList = [...this.masterDocumentList, newDocument];
                console.log('new Task: ', JSON.stringify(newDocument));
                this.showModal = false;
            })
            .catch(error => console.error('Creation failed', error))
            .finally(() => (this.isLoading = false));
    }
}