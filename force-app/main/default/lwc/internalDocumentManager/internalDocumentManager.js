import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getFolders from '@salesforce/apex/DocumentManagerController.getFolders';
import getDocumentsForFolder from '@salesforce/apex/DocumentManagerController.getDocumentsForFolder';
import handleFileUpload from '@salesforce/apex/DocumentManagerController.handleFileUpload';
import createFolder from '@salesforce/apex/DocumentManagerController.createFolder';
import { CurrentPageReference } from 'lightning/navigation';

export default class CustomDocuments extends LightningElement {
    @api recordId;
    objectName
    @track folders = [];
    @track selectedFolder = 'other';
    @track documents = [];
    @track searchTerm = '';
    @track newFolderName = '';
    @track showNewFolderForm = false;
    @track error;
    @track wiredFoldersResult;
    acceptedFormats = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx'];

    // Get recordId from CurrentPageReference (record page)
    @wire(CurrentPageReference)
    getPageReference(pageRef) {
        if (pageRef) {
            this.recordId = pageRef.attributes.recordId;
            this.objectName = pageRef.attributes.objectApiName;
        }
    }

    connectedCallback(){
        this.fetchDocumentsForFolder(null);
    }
    // Fetch all folders using @wire
    @wire(getFolders, { recordId: '$recordId' })
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

    // Folder selection logic
 handleFolderClick(event) {
    const folderId = event.currentTarget.dataset.id;
    console.log('folderId : ', folderId);

    // If the 'all' folder is clicked, fetch documents for all and apply the selected class
    if (folderId === 'other') {
        this.selectedFolder = 'other';  // Set selected folder as 'all'
        this.fetchDocumentsForFolder(null);  // Fetch documents for all folders
    } else {
        // Set selected folder to clicked folder
        this.selectedFolder = folderId;
        this.fetchDocumentsForFolder(folderId);  // Fetch documents for the specific folder
    }

    // Update the class for each folder: add 'selected' to the selected folder, else remove 'selected'
    this.updateFolderClass();
}

// Method to update folder class dynamically
updateFolderClass() {
    this.folders = this.folders.map(f => ({
        ...f,
        class: f.id === this.selectedFolder ? 'folder selected' : 'folder'
    }));
}


    // Fetch documents for selected folder
    async fetchDocumentsForFolder(folderId) {
        try {
            const documents = await getDocumentsForFolder({ folderId: folderId, recordId: this.recordId });
            this.documents = documents.map(doc => ({
                id: doc.id,
                name: doc.title,
                folder: doc.folderName,
                fileType: doc.fileType,
                createdDate: doc.createdDate
            }));
        } catch (error) {
            this.showToast('Error', 'Failed to load documents', 'error');
            this.documents = [];
        }
    }

    // Search functionality
    handleSearch(event) {
        this.searchTerm = event.target.value;
    }

    // Filter documents based on search term
    get filteredDocuments() {
        if (!this.searchTerm) return this.documents;
        return this.documents.filter(doc => 
            doc.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            doc.folder.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
            doc.fileType.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    // New folder form toggle
    createFolderButtonClick() {
        this.showNewFolderForm = true;
        this.newFolderName = '';
    }

    // Handle folder name change
    handleFolderNameChange(event) {
        this.newFolderName = event.target.value;
    }

    // Submit folder creation
    async handleCreateFolderSubmit() {
        console.log(   'Creating folder:',  this.newFolderName);
        console.log(   'recordId:',  this.recordId);
        console.log(   'objectName:',  this.objectName);
        
        // if (this.newFolderName.trim()) {
            try {
                await createFolder({ name: this.newFolderName, recordId: this.recordId, objectName: this.objectName });
                this.showNewFolderForm = false;
                this.showToast('Success', 'Folder created successfully!', 'success');
                await refreshApex(this.wiredFoldersResult);
            } catch (error) {
                this.showToast('Error', 'Error creating folder', 'error');
            }
        // }
    }

    // Handle file upload finished
    async handleUploadFinished(event) {
        const uploadedFiles = event.detail.files;
        console.log('uploadedFiles : ', uploadedFiles);

        try {
            // Loop through each file using 'for...of' to await the async upload process
            const fileUploadPromises = uploadedFiles.map(async (file) => {
                console.log('file.contentVersionId : ', file.contentVersionId);
                console.log('file.documentId : ', file.documentId);
                console.log('file.mimeType : ', file.mimeType);
                console.log('file.name : ', file.name);

                // Wait for file upload handling to complete
                await handleFileUpload({
                    contentDocumentId: file.documentId,
                    status: 'Uploaded',
                    recordId: this.recordId,
                    folderId: this.selectedFolder
                });
                console.log('File uploaded and linked to folder:', file.name);
            });

            // Await all file uploads to complete
            await Promise.all(fileUploadPromises);

            // Show toast after all files are uploaded
            this.showToast('Success', `${uploadedFiles.length} file(s) uploaded and linked to folder.`, 'success');

            // Refresh folder and document data after file upload
            await refreshApex(this.wiredFoldersResult); // Updates folder counts
            await this.fetchDocumentsForFolder(this.selectedFolder); // Updates document table reactively

        } catch (error) {
            // Handle any errors that occur during the upload process
            this.showToast('Error', 'There was an issue uploading the files.', 'error');
            console.error('Error during file upload:', error);
        }
    }

    // Show toast message
    showToast(title, message, variant) {
        const event = new ShowToastEvent({
            title,
            message,
            variant
        });
        this.dispatchEvent(event);
    }

    // Show upload box if needed
    get showUploadBox() {
        return this.selectedFolder !== 'other';
        // return this.selectedFolder !== 'all';
    }

    // Check if the new folder form is visible
    get isFlolderFormVisible() {
        return this.showNewFolderForm;
    }

    // Check if new folder name is provided
    get haveNewFolderName() {
        return this.newFolderName.trim().length > 0;
    }

    // Handle folder refresh
    async handleRefresh() {
        try {
            await refreshApex(this.wiredFoldersResult);
            await this.fetchDocumentsForFolder(this.selectedFolder);
            this.showToast('Success', 'Folder refreshed.', 'success');
        } catch (error) {
            this.showToast('Error', 'Error refreshing folder', 'error');
        }
    }

    // Handle file download
    handleDownload() {
        this.showToast('Success', 'Files downloaded.', 'success');
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