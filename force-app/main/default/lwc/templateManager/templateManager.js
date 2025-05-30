import { LightningElement, track,wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getAllowedTemplateCategories from '@salesforce/apex/DocumentTemplateController.getTemplateCategories';
import getAllowedDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getDocumentsByCategory from '@salesforce/apex/DocumentTemplateController.getDocumentsByCategory';
// import getItemsByTemplateCategory from '@salesforce/apex/DocumentTemplateController.getItemsByTemplateCategory';
// import createTemplateAndItem from '@salesforce/apex/DocumentTemplateController.createTemplateAndItem';
// import getItemsByTemplateId from '@salesforce/apex/DocumentTemplateController.getItemsByTemplateId';
import getAllDocuments from '@salesforce/apex/DocumentTemplateController.getAllDocuments';
// import saveEditedTemplate from '@salesforce/apex/DocumentTemplateController.saveEditedTemplate';
import createOrUpdateTemplate from '@salesforce/apex/DocumentTemplateController.createOrUpdateTemplate';

export default class TemplateManager extends LightningElement {
  @track isTemplateDropdownOpen = false;
  @track isDocumentDropdownOpen = false;
  @track isLoading = false;
  @track showModal = false;
  @track isEditModalOpen = false;

  @track templateCategoryOptions = [];
  @track documentCategoryOptions = [];
  @track documentOptions = [];
  @track documentList = [];
  @track documentsForTemplate = [];

  @track selectedTemplateCategory = '';
  @track selectedDocumentCategory = '';
  @track selectedCategoryType = '';
  @track selectedTemplateForEdit = '';

  @track modalHeader = '';
  @track modalCategory = '';
  @track modalTemplateName = '';
  @track modalDocumentId = '';


  // Keeps backup list for documents in specified template
  @track templateDocumentList = []


  connectedCallback() {
   
    
  }
  
    // Wire method for calling Apex
    @wire(getAllDocuments)
    wiredDocuments({ error, data }) {
        if (data) {
            this.availableDocuments = data;
            console.log('Documents fetched successfully:', this.documents);
        } else if (error) {
            this.error = error;
            console.error('Error fetching documents:', this.error);
        }
    }

  // Fetch template categories for dropdown
  handleAddTemplate() {
    // this.isLoading = true;
    getAllowedTemplateCategories()
      .then(result => {
        console.log('getAllowedTemplateCategories : ', JSON.stringify(result));
        
        // this.templateCategoryOptions = result;

          // Transform result to include templateName and templateId along with categoryId and categoryName
      this.templateCategoryOptions = result.map(item => {
        return {
          categoryId: item.id,
          categoryName: item.name,
          templateId: item.template?.id,
          templateName: item.template?.name
        };
      });

        console.log('templateCategoryOptions : ', JSON.stringify(this.templateCategoryOptions));

        this.isTemplateDropdownOpen = true;
        this.isDocumentDropdownOpen = false;
      })
      .catch(error => this.showError('Error loading template categories', error))
      .finally(() => (this.isLoading = false));
  }

  // Fetch document categories for dropdown
  handleAddDocument() {
    this.isLoading = true;
    getAllowedDocumentCategories()
      .then(result => {
        this.documentCategoryOptions = result;
        this.isDocumentDropdownOpen = true;
        this.isTemplateDropdownOpen = false;
      })
      .catch(error => this.showError('Error loading document categories', error))
      .finally(() => (this.isLoading = false));
  }

  // Template category click → fetch items for that template
  handleTemplateCategoryClick(event) {
    const categoryId = event.currentTarget.dataset.id;
    // this.selectedTemplateCategory = category;
    // this.selectedCategoryType = 'template';
    this.isLoading = true;
    console.log('categoryId : ',categoryId);
    getDocumentsByCategory({ categoryId: categoryId })
      .then(result => {

        console.log('getDocumentsByCategory : ',JSON.stringify(result));
       

        if (result && result.documents) {
                    this.documentList = result.documents;
                    console.log('Documents loaded:', this.documents);
                }

        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: this.documentList
        }));
      })
      .catch(error => this.showError('Error fetching template items', error))
      .finally(() => (this.isLoading = false));
  }
@track editableTemplateId;
@track editableTemplateName = '';
@track editableDocuments = [];


  // Document category click → show document options
  handleDocumentCategoryClick(event) {
    const category = event.currentTarget.dataset.value;
    this.selectedDocumentCategory = category;
    this.selectedCategoryType = 'document';
    this.isLoading = true;

    getItemsByDocumentCategory({ category })
      .then(result => {
        this.documentOptions = result;
      })
      .catch(error => this.showError('Error fetching documents by category', error))
      .finally(() => (this.isLoading = false));
  }

  // Select a document from documentOptions list
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

    this.isDocumentDropdownOpen = false;

    this.dispatchEvent(new CustomEvent('templateitemsloaded', {
      detail: this.documentList
    }));
  }

  // "+" button click → open modal for template or document creation
  handleAddCategoryClick(event) {
    const category = event.currentTarget.dataset.category;
    const type = event.currentTarget.dataset.type;

    this.modalCategory = category;
    this.modalHeader = type === 'template' ? 'Create Template' : 'Create Document';
    this.modalTemplateName = '';
    this.modalDocumentId = '';
    this.showModal = true;
  }

  handleModalInputChange(event) {
    this.modalTemplateName = event.target.value;
  }

  handleDocumentChange(event) {
    this.modalDocumentId = event.detail.value;
  }

  handleModalCancel() {
    this.showModal = false;
  }

  // Save modal form (template + document item creation)
  handleModalSave() {
    if (!this.modalTemplateName || !this.modalDocumentId) {
      this.showError('Missing input', 'Please provide both a name and a document.');
      return;
    }

    this.isLoading = true;

    createTemplateAndItem({
      templateName: this.modalTemplateName,
      category: this.modalCategory,
      appliesTo: '',
      itemName: this.modalDocumentId,
      team: '',
      status: 'New'
    })
      .then(() => {
        this.showModal = false;
        this.isTemplateDropdownOpen = false;
        this.isDocumentDropdownOpen = false;
        this.showSuccess('Created successfully', 'Template and document item were created.');
      })
      .catch(error => this.showError('Creation failed', error))
      .finally(() => (this.isLoading = false));
  }
// When user clicks the edit icon
// handleEditTemplate(event) {
//   const templateId = event.currentTarget.dataset.templateid;
//   const categoryId = event.currentTarget.dataset.categoryid;
//   const templateName = event.currentTarget.dataset.templatename;

//   this.isLoading = true;

//   // Construct input object to send
//   const input = {
//     categoryId: categoryId,
//     templateName: templateName,
//     templateId: templateId,
//     documents: [] // Empty for now; Apex will load and sync actual documents
//   };

//   createOrUpdateTemplate({ input })
//     .then(result => {
//       console.log('createOrUpdateTemplate result: ', result);

//       this.editableTemplateId = templateId;
//       this.editableTemplateName = templateName;
//       this.editableDocuments = result.documents || []; // depends on what Apex returns
//       this.isEditModalOpen = true;
//     })
//     .catch(error => this.showError('Error loading template for editing', error))
//     .finally(() => (this.isLoading = false));
// }

// When user clicks the edit icon

// handleEditTemplate(event) {
//   const templateId = event.currentTarget.dataset.templateid;
//   const categoryName = event.currentTarget.dataset.category;

//   this.isLoading = true;
//   createOrUpdateTemplate({ templateId })
//     .then(result => {
//       console.log('createOrUpdateTemplate : ',result);
//       this.editableTemplateId = templateId;
//       this.editableTemplateName = result.templateName;
//       this.editableDocuments = result.documents;
//       this.isEditModalOpen = true;
//     })
//     .catch(error => this.showError('Error loading template for editing', error))
//     .finally(() => (this.isLoading = false));
// }

handleTemplateNameChange(event) {
  this.editableTemplateName = event.target.value;
}

handleRemoveDocument(event) {
  const docId = event.currentTarget.dataset.id;
  this.editableDocuments = this.editableDocuments.filter(doc => doc.id !== docId);
}

handleAddNewDocument() {
  // optionally show modal or dropdown to select new document item(s)
  // For now, simulate adding a dummy document:
  const newDoc = { id: Date.now().toString(), name: 'New Document', isNew: true };
  this.editableDocuments = [...this.editableDocuments, newDoc];
}

closeEditModal() {
  this.isEditModalOpen = false;
}


newItems;
deletedItemIds;

andleAddToTemplate(event) {
  const docId = event.currentTarget.dataset.id;
  const doc = this.availableDocuments.find(d => d.id === docId);
  if (doc) {
    this.templateDocumentList = [...this.templateDocumentList, doc];
    this.availableDocuments = this.availableDocuments.filter(d => d.id !== docId);

    // Track newly added documents (avoid duplicates)
    if (!this.templateDocumentList.some(d => d.id === doc.id)) {
      this.newItems.push({ ...doc }); // clone to avoid mutation
    }

    console.log('Added to templateDocumentList:', this.templateDocumentList);
  }
}

handleRemoveFromTemplate(event) {
  const docId = event.currentTarget.dataset.id;
  const doc = this.templateDocumentList.find(d => d.id === docId);
  if (doc) {
    this.availableDocuments = [...this.availableDocuments, doc];
    this.templateDocumentList = this.templateDocumentList.filter(d => d.id !== docId);

    // Track for deletion only if it's an existing item (i.e., already saved in DB)
    if (doc.id) {
      this.deletedItemIds.push(doc.id);
    }

    // Remove from newItems if it was just added
    this.newItems = this.newItems.filter(d => d.id !== docId);

    console.log('Removed from templateDocumentList:', this.templateDocumentList);
  }
}
get groupedAvailableDocuments() {
  console.log('availableDocuments : ', JSON.stringify(this.availableDocuments));

  if (!Array.isArray(this.availableDocuments) || this.availableDocuments.length === 0) {
    return [];
  }

  const categoryMap = {};
  const seenDocIds = new Set();

  // Collect IDs of all documents already in the template
  const templateDocIds = new Set(
    (this.templateDocumentList || []).map(d => d.id)
  );

  this.availableDocuments.forEach(doc => {
    // Skip if missing, already seen, or already added to the template
    if (!doc || !doc.id || seenDocIds.has(doc.id) || templateDocIds.has(doc.id)) {
      return;
    }

    seenDocIds.add(doc.id);

    const category = doc.categoryName && doc.categoryName.trim() ? doc.categoryName : 'General';

    if (!categoryMap[category]) {
      categoryMap[category] = [];
    }

    categoryMap[category].push({ ...doc });
  });

  // Add displayNumber to each grouped document
  return Object.keys(categoryMap).map(categoryName => {
    const documentsWithNumbers = categoryMap[categoryName].map((doc, index) => ({
      ...doc,
      displayNumber: index + 1 // Start numbering from 1
    }));
    return {
      name: categoryName,
      documents: documentsWithNumbers
    };
  });
}

handleEditTemplate(event) {
  const templateId = event.currentTarget.dataset.templateid;
  const categoryId = event.currentTarget.dataset.categoryid;
  const templateName = event.currentTarget.dataset.templatename;

  console.log('templateId:', templateId);
  console.log('categoryId:', categoryId);
  console.log('templateName:', templateName);

  this.isEditModalOpen = true;

  // Validate and find the template
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

  getDocumentsByCategory({ categoryId })
    .then(result => {
      if (result && Array.isArray(result.documents)) {
        this.templateDocumentList = result.documents;
        console.log('Documents loaded:', this.templateDocumentList);
      } else {
        this.templateDocumentList = [];
        console.warn('No documents found for categoryId:', categoryId);
      }
    })
    .catch(error => {
      console.error('Error fetching template items', error);
      this.showError('Error fetching template items', error);
    })
    .finally(() => {
      this.isLoading = false;
    });
}



handleSaveEditModal() {
  if (!this.selectedTemplateForEdit || !this.selectedTemplateForEdit.templateId) {
    console.error('No selected template to save.');
    return;
  }

  this.isLoading = true;

  const newDocIds = this.newItems.map(item => item.id);
  const deletedDocIds = this.deletedItemIds;

  console.log('newDocIds : ',newDocIds);
  console.log('deletedDocIds : ',deletedDocIds);

  // updateTemplateItems({
  //   templateId: this.selectedTemplateForEdit.templateId,
  //   newDocIds: newDocIds,
  //   deletedDocIds: deletedDocIds
  // })
  //   .then(() => {
  //     this.showSuccess('Template updated successfully!');
  //     this.isEditModalOpen = false;

  //     // Reset tracking arrays
  //     this.newItems = [];
  //     this.deletedItemIds = [];

  //     // Optionally reload templates
  //     this.loadTemplates(); 
  //   })
  //   .catch(error => {
  //     console.error('Error updating template items:', error);
  //     this.showError('Error saving changes', error);
  //   })
  //   .finally(() => {
  //     this.isLoading = false;
  //   });
}


  // handleEditTemplate(event) {
  //   const templateId = event.currentTarget.dataset.templateid;
  //   const categoryId = event.currentTarget.dataset.categoryid;
  //   const templateName = event.currentTarget.dataset.templatename;


  //   console.log('templateId : ',templateId);
  //   console.log('categoryId : ',categoryId);
  //   console.log('templateName : ',templateName);
  //   this.isEditModalOpen= true;

  //   console.log('templateDocumentList : ', JSON.stringify(this.templateDocumentList));
   
    
  //   this.selectedTemplateForEdit = this.templateCategoryOptions.find(t => t.templateId === templateId);
  //   this.selectedTemplateForEdit = this.templateCategoryOptions.find(t => t.templateId === templateId);

  //   console.log('selectedTemplateForEdit : ',JSON.stringify( this.selectedTemplateForEdit));

  //   getDocumentsByCategory({ categoryId: categoryId })
  //     .then(result => {
  //       this.templateDocumentList = result;
  //       console.log('templateDocumentList : ', this.templateDocumentList);


  //     })
  //     .catch(error => this.showError('Error fetching template items', error))
  //     .finally(() => (this.isLoading = false));
  // }


  closeEditModal() {
    this.isEditModalOpen = false;
  }

  // Utility: Show error toast
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

  // Utility: Show success toast
  showSuccess(title, message) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant: 'success'
      })
    );
  }
}