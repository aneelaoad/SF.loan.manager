import { LightningElement, track, api, wire } from 'lwc';
import getAssignedDocuments from '@salesforce/apex/DocumentTemplateController.getAssignedDocuments';
import { CurrentPageReference } from 'lightning/navigation';
import { NavigationMixin } from 'lightning/navigation';
import deleteDocumentAssignment from '@salesforce/apex/DocumentTemplateController.deleteDocumentAssignment';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getArchivedDocuments from '@salesforce/apex/DocumentTemplateController.getArchivedDocuments';
import archiveDocumentAssignment from '@salesforce/apex/DocumentTemplateController.archiveDocumentAssignment';
import deleteArchivedAssignments from '@salesforce/apex/DocumentTemplateController.deleteArchivedAssignments';
import restoreArchivedAssignment from '@salesforce/apex/DocumentTemplateController.restoreArchivedAssignment';
import restoreArchivedAssignments from '@salesforce/apex/DocumentTemplateController.restoreArchivedAssignments';
import getAllowedDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import STATUS_FIELD from '@salesforce/schema/Document__c.Status__c';
import createDocument from '@salesforce/apex/DocumentTemplateController.createDocument';

export default class CustomTaskManager extends LightningElement {
    recordId;
    @track selectedCategories = [];
    @track showVerification = false;
    isArchived = false
    @track templateItemRows = [];
    @track filteredRows = [];
    documentId = ''
    wiredDocumentResult
    @track archivedList = [];
    archivedWireResult;  
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

    @wire(getDocumentCategories)
    wiredCategories({ error, data }) {
        if (data) {
            this.categoryList = data.map(cat => ({
                name: cat.name,
                circleClass: this.getCategoryClass(cat.name),
                labelClass: 'category-label'
            }));

            // Add static "Reset" option at the end
            this.categoryList.push({
                name: 'Reset',
                icon: 'utility:refresh',
                isReset: true,
                labelClass: 'category-label'
            });
        } else if (error) {
            console.error('Error loading categories:', error);
            this.categoryList = [];
        }
    }
    getCategoryClass(name) {
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


    @wire(getAssignedDocuments, { recordId: '$recordId' })
    wiredDocuments(result) {
        this.wiredDocumentResult = result; // save for refresh
        const { data, error } = result;

        if (data) {
            this.filteredRows = data;
            this.templateItemRows = data; // Keep this synced for category filtering
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.filteredRows = [];
        }
    }

   @wire(getArchivedDocuments, { recordId: '$recordId' })
wiredArchivedDocs(result) {
    this.archivedWireResult = result;
    const { data, error } = result;

    if (data) {
        this.archivedList = data;
    } else if (error) {
        console.error('Error fetching archived docs', error);
    }
}

@track documentCategoryOptions = [];
@track selectedDocumentCategory;


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

connectedCallback() {
  getAllowedDocumentCategories()
    .then(result => {
      console.log('Document Categories: ', result);
      this.documentCategoryOptions = result.map(item => ({
        label: item.name,
        value: item.id
      }));
    })
    .catch(error => this.showError('Error loading document categories', error))
    .finally(() => (this.isLoading = false));
}



    handleDocumentCategoryChange(event) {
        console.log('handleDocumentCategoryChange',event);
        
  this.selectedDocumentCategory = event.detail.value;
}
handleStatusChange(event){
   this.selectedStatus= event.detail.value;
}
handleDeleteAllArchived() {
    const documentIds = this.archivedList.map(item => item.id);

    if (documentIds.length === 0) return;

    deleteArchivedAssignments({ documentIds, recordId: this.recordId })
        .then(() => {
            this.archivedList = [];
            this.dispatchEvent(new ShowToastEvent({
                title: 'Deleted',
                message: 'All archived documents deleted.',
                variant: 'success'
            }));
        })
        .catch(error => {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'Failed to delete archived documents.',
                variant: 'error'
            }));
        });
}

    handleDelete(event) {
        const documentId = event.currentTarget.dataset.id;
        const recordId = this.recordId;
        const objectName = this.objectName;

        deleteDocumentAssignment({ documentId, recordId, objectName })
            .then(() => {
                return refreshApex(this.wiredDocumentResult); 
            })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: 'Document assignment deleted successfully.',
                        variant: 'success'
                    })
                );
            })
            .catch(error => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Error',
                        message: error.body?.message || 'Failed to delete assignment.',
                        variant: 'error'
                    })
                );
            });
    }
handleDeleteArchived(event) {
    console.log('handleDeleteArchived: ', event.currentTarget);
    
    const documentId = event.currentTarget.dataset.id;
    const recordId = this.recordId;
        const objectName = this.objectName;

    deleteDocumentAssignment({ documentId, recordId, objectName})
        .then(() => {
            // Remove from archived list
            this.archivedList = this.archivedList.filter(doc => doc.id !== documentId);
            // this.saveArchivedToLocalStorage();

            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Deleted',
                    message: 'Archived document deleted.',
                    variant: 'success'
                })
            );
        })
        .catch(error => {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: error.body?.message || 'Failed to delete archived document.',
                    variant: 'error'
                })
            );
        });
}

handleArchiveRecord(event) {
    const documentId = event.currentTarget.dataset.id;
            console.log('handleArchiveRecord:'+documentId);

    archiveDocumentAssignment({ documentId, recordId: this.recordId })
        .then(() => {
            // Remove from active lists
            this.filteredRows = this.filteredRows.filter(row => row.id !== documentId);
            this.templateItemRows = this.templateItemRows.filter(row => row.id !== documentId);
            return refreshApex(this.archivedWireResult);
            // Refresh archived documents to include the newly archived one
        //    getArchivedDocuments({ recordId: this.recordId });
        })
        .then(() => {
            // this.archivedList = data;
            // console.log('archivedList:'+this.archivedList);
            
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Archived',
                    message: 'Document archived successfully.',
                    variant: 'info'
                })
            );
            return refreshApex( this.archivedList)
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
 handleCloseModal() {
    this.isArchived = false;
  }



handleRestoreArchived(event) {
    const documentId = event.currentTarget.dataset.id;

    restoreArchivedAssignment({ documentId, recordId: this.recordId })
        .then(() => {
        this.archivedList = this.archivedList.filter(doc => doc.id !== documentId);
            // Optionally re-fetch active documents
            return getAssignedDocuments({ recordId: this.recordId });
        })
        .then(data => {
            this.filteredRows = data;
            this.error = undefined;
        })
        .catch(error => {
            console.error('Restore failed: ', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: 'Failed to restore document.',
                variant: 'error'
            }));
        });
}
handleRestoreAllArchived() {
    const documentIds = this.archivedList.map(item => item.id);
    if (documentIds.length === 0) return;

    restoreArchivedAssignments({ documentIds, recordId: this.recordId })
        .then(() => {
            this.archivedList = [];

            return getAssignedDocuments({ recordId: this.recordId });
        })
        .then(data => {
            this.filteredRows = data;
            this.templateItemRows = data;

            this.dispatchEvent(new ShowToastEvent({
                title: 'Restored',
                message: 'All archived documents restored.',
                variant: 'success'
            }));
        })
        .catch(error => {
            console.error('Restore All Failed: ', error);
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'Failed to restore archived documents.',
                variant: 'error'
            }));
        });
}

get groupedByStatus() {
    const groups = {};
    
    // Ensure archivedList and filteredRows are initialized
    const archivedIds = new Set((this.archivedList || []).map(item => item.id));

    (this.filteredRows || [])
        .filter(item => item && !archivedIds.has(item.id)) // exclude archived
        .forEach(item => {
            const status = item.status || 'General';
            const enrichedItem = {
                ...item,
                isReadyToSend: item.status === 'Ready to Send'
            };

            if (!groups[status]) {
                groups[status] = [];
            }
            groups[status].push(enrichedItem);
        });

    return Object.entries(groups).map(([status, items]) => ({
        status,
        items
    }));
}

    // get groupedByStatus() {
    //     const groups = {};
    //     const archivedIds = new Set(this.archivedList.map(item => item.id));

    //     this.filteredRows
    //         .filter(item => !archivedIds.has(item.id)) // exclude archived
    //         .forEach(item => {
    //             const status = item.status || 'General';
    //             const enrichedItem = {
    //                 ...item,
    //                 isReadyToSend: item.status === 'Ready to Send'
    //             };

    //             if (!groups[status]) {
    //                 groups[status] = [];
    //             }
    //             groups[status].push(enrichedItem);
    //         });

    //     return Object.entries(groups).map(([status, items]) => ({
    //         status,
    //         items
    //     }));
    // }

    

    get statusKeys() {
        return this.groupedByStatus.map(group => group.status);
    }




    get isEmpty() {
        return this.filteredRows.length === 0;
    }
    handleEmailClick(event) {
        const docId = event.currentTarget.dataset.id;
        // Handle email logic here
        console.log('Send email for doc: ', docId);
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
           return getAssignedDocuments({ recordId: this.recordId }).then((data) => {
        this.filteredRows = data;
        this.templateItemRows = data;
    });
    }
handleArchiveClick() {
    this.isArchived = !this.isArchived;
    console.log('Archive button clicked!');

   
}

    // Handler for the Mortgage App button
    handleMortgageAppClick() {
        console.log('Mortgage App button clicked!');
        // Add your app-specific logic here
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
                    this.selectedCategories.includes(row.categoryName)
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
        const items = event.detail.documents;
        console.log('--------------------------');
        console.log('--------------------------');

        console.log('Recieved document/s: ' + items);

        this.templateItemRows = [...this.templateItemRows, ...items]


        // Default to show all when first received
        this.filteredRows = [...this.templateItemRows];
        this.selectedCategories = [];

        // Reset category label classes
        this.categoryList = this.categoryList.map(cat => ({
            ...cat,
            labelClass: 'category-label'
        }));
    }

showModal =false;
handleModalCancel(){
this.showModal =false;

}
handleAddTask(){
    this.showModal=true;
}
modalTemplateName;
handleModalInputChange(event) {
    // const field = event.target.dataset.field;
    this.modalTemplateName = event.target.value;
    // this[field] = event.target.value;
    console.log('vent.target.value;: ', event.target.value);
    console.log('modalTemplateName: ', this.modalTemplateName);
    
}

handleTeamChange(event) {
    this.modalTeam = event.detail.value;
}

handleStatusChange(event) {
    this.modalStatus = event.detail.value;
}

handleNotesChange(event) {
    this.modalNotes = event.detail.value;
}

 handleSaveNewDocument() {
        this.isLoading = true;

        const input = {
            categoryId: this.selectedDocumentCategory,
            name: this.modalTemplateName,
            status: this.modalStatus || '',
            team: this.modalTeam || '',
            type:'Task',
            // assignedToId: '005QQ000001E2asYAC',
            relatedTo: this.recordId,
            objectName: this.objectName
        };

        console.log('input: ' + JSON.stringify(input));

        createDocument({ inputJson: JSON.stringify(input) })
            .then((newDocument) => {
                console.log('new Task: ' + JSON.stringify(newDocument));
                this.showModal = false;
               
            })
            .catch(error => console.error('Creation failed', error))
            .finally(() => (this.isLoading = false));
    }
}