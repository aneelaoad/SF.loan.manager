import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getFolders from '@salesforce/apex/DocumentManagerController.getFolders';
import getDocumentsForFolder from '@salesforce/apex/DocumentManagerController.getDocumentsForFolder';
import handleFileUpload from '@salesforce/apex/DocumentManagerController.handleFileUpload';
import createFolder from '@salesforce/apex/DocumentManagerController.createFolder';
import deleteDocumentLink from '@salesforce/apex/DocumentManagerController.deleteContentDocument';
import getDownloadUrl from '@salesforce/apex/DocumentManagerController.getDownloadUrl';
import getCurrentUserContext from '@salesforce/apex/DocumentManagerController.getCurrentUserContext';
import { CurrentPageReference } from 'lightning/navigation';
import { NavigationMixin } from 'lightning/navigation';

export default class InternalDocumentManager extends NavigationMixin(LightningElement) {
    @api recordId;
    objectName;
    userId;
    isExperienceSite = false;
    @track folders = [];
    @track selectedFolder = 'other';
    @track documents = [];
    @track searchTerm = '';
    @track newFolderName = '';
    @track showNewFolderForm = false;
    @track error;
    @track wiredFoldersResult;
    isLoading = true;
    acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];

    async connectedCallback() {
        try {
            const context = await getCurrentUserContext();
            console.log('context:', context);

            this.isExperienceSite = context.isExperienceSite;
            if (this.isExperienceSite) {
                this.objectName = context.objectName;
                this.userId = context.userId;
                this.recordId = context.userId; // Use userId as recordId for Experience Site users
                console.log('Experience Site - objectName:', this.objectName, 'userId:', this.userId);
            }
            // If not an Experience Site, recordId and objectName will be set by getPageReference
            await this.refreshData();
        } catch (error) {
            console.error('Error fetching user context:', error);
            this.showToast('Error', 'Failed to load user context', 'error');
            this.isLoading = false;
        }
    }

    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (!this.isExperienceSite && pageRef) {
            // For Record Page
            if (pageRef.attributes && pageRef.attributes.recordId) {
                this.recordId = pageRef.attributes.recordId;
                this.objectName = pageRef.attributes.objectApiName;
            }
            // For App Page with state params (passed from popOut())
            if (pageRef.state && pageRef.state.c__recordId) {
                this.recordId = pageRef.state.c__recordId;
                this.objectName = pageRef.state.c__objectName;
            }
            console.log('recordId:', this.recordId, 'objectName:', this.objectName);
        }
    }

    popOut() {
        console.log('pop!');
        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'Document_Manager'
            },
            state: {
                c__recordId: this.recordId,
                c__objectName: this.objectName
            }
        });
    }

    @wire(getFolders, { recordId: '$recordId', objectName: '$objectName', isExperienceSite: '$isExperienceSite' })
    wiredFolders(result) {
        this.wiredFoldersResult = result;
        if (result.data) {
            this.folders = result.data.map(folder => ({
                ...folder,
                class: folder.id === this.selectedFolder ? 'folder selected' : 'folder'
            }));
            this.error = undefined;
        } else if (result.error) {
            this.error = result.error;
            this.folders = [];
            this.showToast('Error', 'Failed to load folders', 'error');
        }
    }

    handleFolderClick(event) {
        this.searchTerm = ''
        const folderId = event.currentTarget.dataset.id;
        this.selectedFolder = folderId;
        this.fetchDocumentsForFolder(folderId === 'other' ? null : folderId);
        this.updateFolderClass();
    }

    updateFolderClass() {
        this.folders = this.folders.map(f => ({
            ...f,
            class: f.id === this.selectedFolder ? 'folder selected' : 'folder'
        }));
    }

    async fetchDocumentsForFolder(folderId) {
        this.isLoading = true;
        try {
            const docs = await getDocumentsForFolder({ folderId, recordId: this.recordId });
            this.documents = docs;
        } catch (error) {
            this.showToast('Error', 'Failed to load documents', 'error');
            this.documents = [];
        } finally {
            this.isLoading = false;
        }
    }

    async refreshData() {
        this.isLoading = true;
        try {
            await refreshApex(this.wiredFoldersResult);
            await this.fetchDocumentsForFolder(this.selectedFolder === 'other' ? null : this.selectedFolder);
        } catch (error) {
            this.showToast('Error', 'Failed to refresh data', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

      get filteredDocuments() {
        if (!this.searchTerm) return this.documents;
        const term = this.searchTerm.toLowerCase();
        return this.documents.filter(doc =>
            (doc.title || '').toLowerCase().includes(term) ||
            (doc.folderName || '').toLowerCase().includes(term) ||
            (doc.fileType || '').toLowerCase().includes(term)
        );
    }


    createFolderButtonClick() {
        this.showNewFolderForm = true;
        this.newFolderName = '';
    }

    handleFolderNameChange(event) {
        this.newFolderName = event.target.value;
    }

    async handleCreateFolderSubmit() {
        try {
            await createFolder({
                name: this.newFolderName,
                recordId: this.recordId,
                objectName: this.objectName,
                isExperienceSite: this.isExperienceSite
            });
            this.showNewFolderForm = false;
            this.showToast('Success', 'Folder created successfully!', 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Error', 'Error creating folder', 'error');
        }
    }

    async handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        try {
            const uploadPromises = uploadedFiles.map(file =>
                handleFileUpload({
                    contentDocumentId: file.documentId,
                    status: 'Uploaded',
                    recordId: this.recordId,
                    folderId: this.selectedFolder,
                    objectName: this.objectName,
                    isExperienceSite: this.isExperienceSite
                })
            );
            await Promise.all(uploadPromises);
            this.showToast('Success', `${uploadedFiles.length} file(s) uploaded successfully`, 'success');
            await this.refreshData();
        } catch (error) {
            this.showToast('Error', 'There was an issue uploading the files.', 'error');
        }
    }

    async handleDeleteFile(event) {
        const contentDocumentId = event.currentTarget.dataset.id;
        const fileName = event.currentTarget.dataset.name;
        try {
            await deleteDocumentLink({ contentDocumentId, recordId: this.recordId });
            this.showToast('Success', fileName + ' file deleted successfully', 'success');
            await this.refreshData();
        } catch (error) {
            console.error(error)
            this.showToast('Error', error.message, 'error');
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    get showUploadBox() {
        return this.selectedFolder !== 'other';
    }

    get isFlolderFormVisible() {
        return this.showNewFolderForm;
    }

    get haveNewFolderName() {
        return this.newFolderName.trim().length > 0;
    }

    async handleRefresh() {
        this.isLoading = true;
        try {
            await this.refreshData();
            this.showToast('Success', 'Data refreshed successfully.', 'success');
        } catch (error) {
            this.showToast('Error', 'Failed to refresh data', 'error');
        } finally {
            this.isLoading = false;
        }
    }

    handleDownload(event) {
        const contentDocumentId = event.currentTarget.dataset.id;
        getDownloadUrl({ contentDocumentId })
            .then((url) => {
                window.open(url, '_blank');
            })
            .catch((error) => {
                console.error('Download failed', error);
            });
    }

    get numberedDocuments() {
        return this.filteredDocuments.map((doc, i) => ({
            ...doc,
            rowNumber: i + 1,
            createdDate: new Date(doc.createdDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            })
        }));
    }
}