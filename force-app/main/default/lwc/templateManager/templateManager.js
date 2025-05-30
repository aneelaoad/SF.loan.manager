import { LightningElement, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

import getAllowedTemplateCategories from '@salesforce/apex/DocumentTemplateController.getTemplateCategories';
import getAllowedDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getDocumentsByCategory from '@salesforce/apex/DocumentTemplateController.getDocumentsByCategory';
import getAllDocuments from '@salesforce/apex/DocumentTemplateController.getAllDocuments';
import createTemplateWithDocuments from '@salesforce/apex/DocumentTemplateController.createTemplateWithDocuments';
import updateTemplateWithDocuments from '@salesforce/apex/DocumentTemplateController.updateTemplateWithDocuments';
import getDocumentsByTemplate from '@salesforce/apex/DocumentTemplateController.getDocumentsByTemplate';
import{ refreshApex } from '@salesforce/apex';
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

        // Transform result to include templateName and templateId along with categoryId and categoryName
        this.templateCategoryOptions = result.map(item => {
          const templateName = item.template?.name || '';
          return {
            categoryId: item.id,
            categoryName: item.name,
            templateId: item.template?.id,
            templateName: templateName,
            showEdit: templateName !== 'Custom' // Only show edit button if name is not 'Custom'
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
        console.log('getAllowedDocumentCategories : ', result);
        this.documentCategoryOptions = result;
        this.isDocumentDropdownOpen = true;
        this.isTemplateDropdownOpen = false;
      })
      .catch(error => this.showError('Error loading document categories', error))
      .finally(() => (this.isLoading = false));
  }

  // Template category click → fetch items for that template
  handleTemplateCategoryClick(event) {
    const templateId = event.currentTarget.dataset.id;
    // this.selectedTemplateCategory = category;
    // this.selectedCategoryType = 'template';
    this.isLoading = true;
    console.log('templateId : ', templateId);
    getDocumentsByTemplate({ templateId: templateId })
      .then(result => {

        console.log('getDocumentsByCategory : ', JSON.stringify(result));
          this.documentList = [...this.documentList, ...result];

    // this.showSuccess('Success', 'Template Updated Successfully')
        // if (result && result.documents) {
        //   this.documentList = result.documents;
        //   console.log('Documents loaded:', this.documents);
        // }

        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: this.documentList
        }));
      })
      .catch(error => this.showError('Error fetching template items', error))
      .finally(() => (this.isLoading = false));
  }


  // Document category click → show document options
  handleDocumentCategoryClick(event) {
    const categoryId = event.currentTarget.dataset.id;
    this.isLoading = true;

    getDocumentsByCategory({ categoryId })
      .then(result => {
        if (result && result.documents) {
          this.documentOptions = result.documents;
          console.log('documentOptions loaded:', this.documents);
        }

        this.dispatchEvent(new CustomEvent('templateitemsloaded', {
          detail: this.documentList
        }));

        // this.documentOptions = result;
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
  // handleModalSave() {
  //   if (!this.modalTemplateName || !this.modalDocumentId) {
  //     this.showError('Missing input', 'Please provide both a name and a document.');
  //     return;
  //   }

  //   this.isLoading = true;

  //   createTemplateAndItem({
  //     templateName: this.modalTemplateName,
  //     category: this.modalCategory,
  //     appliesTo: '',
  //     itemName: this.modalDocumentId,
  //     team: '',
  //     status: 'New'
  //   })
  //     .then(() => {
  //       this.showModal = false;
  //       this.isTemplateDropdownOpen = false;
  //       this.isDocumentDropdownOpen = false;
  //       this.showSuccess('Created successfully', 'Template and document item were created.');
  //     })
  //     .catch(error => this.showError('Creation failed', error))
  //     .finally(() => (this.isLoading = false));
  // }
  

  handleTemplateNameChange(event) {
    this.editableTemplateName = event.target.value;
    console.log('editableTemplateName : ',this.editableTemplateName);
  }

 

  closeEditModal() {
    this.isEditModalOpen = false;
  }

  newItemIds = [];
deletedItemIds = [];

// handleAddToTemplate(event) {
//   const docId = event.currentTarget.dataset.id;
//   const doc = this.availableDocuments.find(d => d.id === docId);

//   if (doc) {
//     // Add to selected list
//     this.templateDocumentList = [...this.templateDocumentList, doc];

//     // Remove from available list
//     this.availableDocuments = this.availableDocuments.filter(d => d.id !== docId);

//     // Add to newItemIds if not already present and not in originalDocumentIds
//     if (
//       !this.newItemIds.includes(docId) &&
//       !this.originalDocumentIds?.includes(docId)
//     ) {
//       this.newItemIds.push(docId);
//     }

//     // Remove from deletedItemIds if it was previously removed
//     this.deletedItemIds = this.deletedItemIds.filter(id => id !== docId);

//     console.log('Added docId:', docId);
//     console.log('newItemIds:',JSON.stringify( this.newItemIds));
//   }
// }

handleAddToTemplate(event) {
  const docId = event.currentTarget.dataset.id;
  const doc = this.availableDocuments.find(d => d.id === docId);

  if (doc) {
    // Add to selected list
    this.templateDocumentList = [...this.templateDocumentList, doc];

    // Remove from available list
    this.availableDocuments = this.availableDocuments.filter(d => d.id !== docId);

    // Add to newItemIds if not already present and not in originalDocumentIds
    if (
      !this.newItemIds.includes(docId) &&
      !this.originalDocumentIds?.includes(docId)
    ) {
      this.newItemIds.push(docId);
    }

    // 🟡 Add to newItems only when creating new template
    if (this.isNewTemplate && !this.newItemIds.find(item => item.id === docId)) {
      this.newItemIds.push(docId);
    console.log('isNewTemplate:', JSON.stringify(this.newItemIds));

    }

    // Remove from deletedItemIds if it was previously removed
    this.deletedItemIds = this.deletedItemIds.filter(id => id !== docId);

    console.log('Added docId:', docId);
    console.log('newItemIds:', JSON.stringify(this.newItemIds));
  }
}


handleRemoveFromTemplate(event) {
  const docId = event.currentTarget.dataset.id;
  const doc = this.templateDocumentList.find(d => d.id === docId);

  if (doc) {
    // Return it to available list
    this.availableDocuments = [...this.availableDocuments, doc];

    // Remove from selected list
    this.templateDocumentList = this.templateDocumentList.filter(d => d.id !== docId);

    // Remove from newItemIds if it was just added
    this.newItemIds = this.newItemIds.filter(id => id !== docId);

    // Add to deletedItemIds if not already there and if not newly added
    if (!this.newItemIds.includes(docId) && !this.deletedItemIds.includes(docId)) {
      this.deletedItemIds.push(docId);
    }

    console.log('Removed docId:', docId);
    console.log('deletedItemIds:', JSON.stringify(this.deletedItemIds));
  }
}



  get groupedAvailableDocuments() {
    // console.log('availableDocuments : ', JSON.stringify(this.availableDocuments));

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

handleAddNewTemplate(event){
  this.editableTemplateName = ''
  this.isNewTemplate = true;
  console.log('event : ',event.currentTarget);
  this.isEditModalOpen = true;

   this.templateDocumentList = [];

}
@track isNewTemplate = false;

  get modalTitle() {
        return this.isNewTemplate ? 'Add New Template' : 'Edit Template';
    }
  handleEditTemplate(event) {
    this.isNewTemplate = false
    const templateId = event.currentTarget.dataset.templateid;
    this.selectedTemplateId = templateId;
    const categoryId = event.currentTarget.dataset.categoryid;
    const templateName = event.currentTarget.dataset.templatename;

    console.log('templateId:', templateId);
    console.log('categoryId:', categoryId);
    console.log('templateName:', templateName);


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

  getDocumentsByTemplate({ templateId: templateId })
      .then(result => {
        this.isEditModalOpen = true;
          this.templateDocumentList = result;
          console.log('Documents loaded:', this.templateDocumentList);
        
        // if (result && Array.isArray(result.documents)) {
        //   this.templateDocumentList = result;
        //   // this.templateDocumentList = result.documents;
        //   console.log('Documents loaded:', this.templateDocumentList);
        // } else {
        //   this.templateDocumentList = [];
        //   console.warn('No documents found for categoryId:', categoryId);
        // }
      })
      .catch(error => {
        console.error('Error fetching template items', error);
        this.showError('Error fetching template items', error);
      })
      .finally(() => {
        this.isLoading = false;
      });
  }


handleSaveTemplateChanges() {
  console.log('selectedTemplateId : ',this.selectedTemplateId);
  console.log('editableTemplateName : ',this.editableTemplateName);
  console.log('deletedItemIds : ',this.deletedItemIds);
  console.log('newItemIds : ',this.newItemIds);
  console.log('isNewTemplate ?: ',this.isNewTemplate);

  if(!this.isNewTemplate){
  updateTemplateWithDocuments({
    templateId: this.selectedTemplateId,
    newTemplateName: this.editableTemplateName,
    newItemIds: this.newItemIds,
    deletedItemIds: this.deletedItemIds
  })
    .then((updatedTemplate) => {
        this.showSuccess('Success', 'Template Updated Successfully')
      console.log('Updated template:', updatedTemplate);
      // Optionally update local data
      this.templateDocumentList = updatedTemplate.documents;
      this.originalDocumentIds = updatedTemplate.documents.map(doc => doc.id);
      this.newItems = [];
      this.deletedItemIds = [];
      this.closeEditModal();
    })
    .catch((error) => {
      console.error('Error updating template:', error);
    });
  }

    // this.newItemIds = this.newItems.map(item => item.id);

if (this.isNewTemplate) {
  createTemplateWithDocuments({
    templateName: this.editableTemplateName,
    documentIds: this.newItemIds
  })
    .then((createdTemplate) => {
      this.showSuccess('Success', 'Template Created Successfully');
      this.closeEditModal();
      this.refreshTemplateList(); // implement this if needed
    })
    .catch(error => {
      console.error('Error creating template:', error);
      this.showError('Error creating template', error);
    });
  return; // exit early to avoid running update logic
}

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