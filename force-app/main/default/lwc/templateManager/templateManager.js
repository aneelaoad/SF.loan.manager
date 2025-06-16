import { LightningElement, track, wire, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import STATUS_FIELD from '@salesforce/schema/Document__c.Status__c';
import TASKTYPE_FIELD from '@salesforce/schema/Document__c.Task_Type__c';
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
import createTask from '@salesforce/apex/DocumentTemplateController.createTask';
import getCurrentUserContext from '@salesforce/apex/UtilityClass.getCurrentUserContext';

export default class TemplateManager extends LightningElement {
  // API Properties
  @api recordId;
  @api primaryTheme; // Receive primaryTheme from parent
    @api secondaryTheme;
  @track users = [];
  @track selectedUserId;
  // Boolean Flags
  @track isTemplateDropdownOpen = false;
  @track isDocumentDropdownOpen = false;
  @track isLoading = false;
  @track showModal = false;
  @track isEditModalOpen = false;
  @track isNewTemplate = false;
  @track showTaskTypes = false;
  @track isDocumentOptions = false;
  @track isExperienceSite = false;
  // String Properties
  @track objectName;
  @track selectedTemplateCategory = '';
  @track selectedDocumentCategory = '';
  @track selectedDocumentCategoryId = '';
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
  @track taskType = '';
  // Lists and Collections
  @track templateCategoryOptions = [];
  @track documentCategoryOptions = [];
  @track documentOptions = [];
  @track documentList = [];
  @track documentsForTemplate = [];
  @track statusOptions = [];
  @track taskTypeOptions = [];
  @track taskCategoryOptions = [];
  @track templateDocumentList = [];
  @track newItemIds = [];
  @track deletedItemIds = [];
  @track originalDocumentIds = [];
  @track availableDocuments = [];
  @track availableTasks = [];
  @track formData = {};
  wiredTemplateCategoriesResult;
  wiredDocumentsResult;
  // Static Options
  teamOptions = [
    { label: 'Underwriting', value: 'Underwriting' },
    { label: 'Processing', value: 'Processing' },
    { label: 'Funding', value: 'Funding' },
    { label: 'Compliance', value: 'Compliance' }
  ];
  // Modal state for new category
  @track showNewCategoryModal = false;
  @track newCategoryName = '';
  @track newCategoryDescription = '';

  // Getters
  get modalTitle() {
    return this.isNewTemplate ? 'Add New Template' : 'Edit Template';
  }

  get groupedAvailableDocuments() {
    if (!Array.isArray(this.availableDocuments) || this.availableDocuments.length === 0) {
      return [];
    }
    const categoryMap = {};
    const seenDocIds = new Set();
    const selectedIds = new Set((this.templateDocumentList || []).map(d => d.id));
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
    const selectedIds = new Set((this.templateDocumentList || []).map(d => d.id));
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

  get isYN() {
    return this.taskType === 'Y/N';
  }

  get isCreditCard() {
    return this.taskType === 'Credit Card Information';
  }

  get isContactInfo() {
    return this.taskType === 'Contact Information';
  }

  // Lifecycle Hooks
  connectedCallback() {
    console.log('this.primaryColor: ', this.primaryTheme);
    
    // Set CSS custom properties for themes
        if (this.primaryTheme) {
            this.template.host.style.setProperty('--theme-primary', this.primaryTheme);
        }
        if (this.secondaryTheme) {
            this.template.host.style.setProperty('--theme-secondary', this.secondaryTheme);
        }
    this.isLoading = true;
    getCurrentUserContext()
      .then(context => {
        console.log('Template Manager - context:', context);
        this.isExperienceSite = context.isExperienceSite;
        if (this.isExperienceSite) {
          this.objectName = 'User';
          this.recordId = context.userId;
          console.log('Experience Site: objectName:', this.objectName, 'recordId:', this.recordId);
        }
        this.refreshData();
      })
      .catch(error => {
        console.error('Error fetching user context:', error);
        this.showError('Error', 'Failed to load user context.');
      })
      .finally(() => {
        console.log('this.isDropdrownsVisble:', this.isDropdrownsVisble);
        this.isLoading = false;
      });
  }

  // Helper Methods
  refreshData() {
    this.refreshTemplateCategories();
    this.refreshDocumentCategories();
    this.refreshDocuments();
  }

  refreshDocuments() {
    refreshApex(this.wiredDocumentsResult)
      .then(() => console.log('Documents refreshed'))
      .catch(error => console.error('Refresh error:', error));
  }

  refreshTemplateCategories() {
    this.isLoading = true;
    getAllowedTemplateCategories()
      .then(result => {
        this.templateCategoryOptions = result.map(item => ({
          categoryId: item.id,
          categoryName: item.name,
          templateId: item.template?.id,
          templateName: item.template?.name || '',
          showEdit: true
        }));
      })
      .catch(error => this.showError('Error', 'Failed to load template categories.'))
      .finally(() => (this.isLoading = false));
  }

  refreshDocumentCategories() {
    this.isLoading = true;
    getAllowedDocumentCategories()
      .then(result => {
        console.log('Document categories:', result);
        this.documentCategoryOptions = result;
        this.taskCategoryOptions = result.map(item => ({
          label: item.name,
          value: item.id
        }));
      })
      .catch(error => this.showError('Error', 'Failed to load document categories.'))
      .finally(() => (this.isLoading = false));
  }

  // Wired Methods
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

  @wire(CurrentPageReference)
  getPageReference(pageRef) {
    if (pageRef && !this.isExperienceSite) {
      console.log('CurrentPageReference:', pageRef);
      this.recordId = pageRef.attributes.recordId;
      this.objectName = pageRef.attributes.objectApiName;
      console.log('Internal User: objectName:', this.objectName, 'recordId:', this.recordId);
    }
  }

  @wire(getObjectInfo, { objectApiName: DOCUMENT_OBJECT })
  objectInfo;

  @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: STATUS_FIELD })
  wiredPicklistValues({ error, data }) {
    if (data) {
      this.statusOptions = data.values;
    } else if (error) {
      console.error('Error loading status picklist values:', error);
    }
  }

  @wire(getPicklistValues, { recordTypeId: '$objectInfo.data.defaultRecordTypeId', fieldApiName: TASKTYPE_FIELD })
  wiredTaskTypeValues({ error, data }) {
    if (data) {
      this.taskTypeOptions = data.values;
      console.log('Task types:', JSON.stringify(this.taskTypeOptions));
    } else if (error) {
      console.error('Error loading task type picklist values:', error);
    }
  }

  @wire(getAllDocuments)
  wiredDocuments(result) {
    this.wiredDocumentsResult = result;
    const { error, data } = result;
    if (data) {
      console.log('Documents fetched:', data);
      this.availableDocuments = data.documents;
      this.availableTasks = data.tasks;
    } else if (error) {
      console.error('Error fetching documents:', error);
      this.showError('Error', 'Failed to fetch documents.');
    }
  }

  // Event Handlers
  handleAddTemplate(event) {
    event.preventDefault();
    this.isTemplateDropdownOpen = !this.isTemplateDropdownOpen;
    this.isDocumentDropdownOpen = false;
    this.showTaskTypes = false;
    if (this.isTemplateDropdownOpen) {
      this.refreshTemplateCategories();
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClickTemplate);
      }, 0);
    } else {
      document.removeEventListener('click', this.handleOutsideClickTemplate);
    }
  }

  handleAddDocument(event) {
    event.preventDefault();
    this.isDocumentDropdownOpen = !this.isDocumentDropdownOpen;
    this.isTemplateDropdownOpen = false;
    this.showTaskTypes = false;
    if (this.isDocumentDropdownOpen) {
      this.refreshDocumentCategories();
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClickDocument);
      }, 0);
    } else {
      document.removeEventListener('click', this.handleOutsideClickDocument);
    }
  }

  handleTaskTypes(event) {
    event.preventDefault();
    this.showTaskTypes = !this.showTaskTypes;
    this.isDocumentDropdownOpen = false;
    this.isTemplateDropdownOpen = false;
    if (this.showTaskTypes) {
      setTimeout(() => {
        document.addEventListener('click', this.handleOutsideClickTask);
      }, 0);
    } else {
      document.removeEventListener('click', this.handleOutsideClickTask);
    }
  }

  handleOutsideClickTemplate = (event) => {
    if (!this.template.contains(event.target)) {
      console.log('Clicked outside template dropdown');
      this.isTemplateDropdownOpen = false;
      document.removeEventListener('click', this.handleOutsideClickTemplate);
    }
  };

  handleOutsideClickDocument = (event) => {
    if (!this.template.contains(event.target)) {
      console.log('Clicked outside document dropdown');
      this.isDocumentDropdownOpen = false;
      this.isDocumentOptions = false;
      this.documentOptions = [];
      this.selectedDocumentCategoryId = null;
      document.removeEventListener('click', this.handleOutsideClickDocument);
    }
  };

  handleOutsideClickTask = (event) => {
    if (!this.template.contains(event.target)) {
      console.log('Clicked outside task dropdown');
      this.showTaskTypes = false;
      document.removeEventListener('click', this.handleOutsideClickTask);
    }
  };

  handleDropdownClick(event) {
    event.stopPropagation();
  }

  handleTemplateCategoryClick(event) {
    event.stopPropagation();
    const templateId = event.currentTarget.dataset.id;
    const templateName = event.currentTarget.dataset.value;
    if (!templateId || !templateName) {
      console.error('Invalid template data:', { templateId, templateName });
      return;
    }
    this.isLoading = true;
    getDocumentsByTemplate({ templateId, recordId: this.recordId, objectName: this.objectName })
      .then(result => {
        console.log('Template documents:', JSON.stringify(result));
        if (result && Array.isArray(result)) {
          this.documentList = [...this.documentList, ...result];
          this.sendDocumentsToParent(this.documentList);
          this.showSuccess('Success', `Documents loaded for template: ${templateName}`);
        } else {
          this.showError('No Documents', `No documents found for template: ${templateName}`);
        }
      })
      .catch(error => {
        this.showError('Error', 'Failed to fetch template documents.');
        console.error('Error in handleTemplateCategoryClick:', error);
      })
      .finally(() => {
        this.isLoading = false;
        this.isTemplateDropdownOpen = false;
        document.removeEventListener('click', this.handleOutsideClickTemplate);
      });
  }

  handleDocumentCategoryClick(event) {
    event.stopPropagation();
    const categoryId = event.currentTarget.dataset.id;
    const categoryName = event.currentTarget.dataset.categoryname;
    if (!categoryId || !categoryName) {
      console.error('Invalid category data:', { categoryId, categoryName });
      return;
    }
    if (this.selectedDocumentCategoryId === categoryId) {
      this.isDocumentOptions = false;
      this.documentOptions = [];
      this.selectedDocumentCategoryId = null;
    } else {
      this.isLoading = true;
      this.documentOptions = [];
      this.selectedDocumentCategoryId = categoryId;
      getDocumentsByCategory({ categoryId })
        .then(result => {
          if (result && result.documents && Array.isArray(result.documents)) {
            this.documentOptions = [...result.documents];
            this.isDocumentOptions = true;
          } else {
            this.showError('No Documents', `No documents found for category: ${categoryName}`);
          }
        })
        .catch(error => {
          this.showError('Error', 'Failed to fetch documents by category.');
          console.error('Error in handleDocumentCategoryClick:', error);
        })
        .finally(() => {
          this.isLoading = false;
        });
    }
  }

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
        { id: documentId, name: selectedLabel, type: 'document', status, team, category }
      ];
    }
    if (this.recordId && this.objectName && documentId) {
      assignDocumentToRecord({ documentId, recordId: this.recordId, objectName: this.objectName })
        .then(newDoc => {
          this.showSuccess('Success', 'Document added');
          this.isDocumentDropdownOpen = false;
          this.documentOptions = [];
          this.sendDocumentsToParent([newDoc]);
        })
        .catch(error => {
          this.showError('Error', error.body?.message || 'Error assigning document.');
          console.error('Error assigning document:', error);
        });
    }
  }

  handleAddNewDocument(event) {
    this.modalCategoryId = event.currentTarget.dataset.categoryid;
    const categoryName = event.currentTarget.dataset.categoryname;
    this.modalCategory = categoryName;
    this.modalHeader = 'Add ' + categoryName + ' Document';
    this.modalTemplateName = '';
    this.modalDocumentId = '';
    this.taskType = '';
    this.formData = {};
    this.showModal = true;
  }

  handleTaskCategoryChange(event) {
    console.log('handleTaskCategoryChange:', event.detail.value);
    this.modalCategory = event.detail.value;
  }

  handleModalInputChange(event) {
    const { name, value } = event.target;
    if (name === 'taskName') {
      this.modalTemplateName = value;
    }
  }

  handleDocumentChange(event) {
    this.modalDocumentId = event.detail.value;
  }

  handleTeamChange(event) {
    this.modalTeam = event.detail.value;
  }

  handleModalCancel() {
    this.showModal = false;
    this.taskType = '';
    this.formData = {};
    this.modalTemplateName = '';
    this.modalCategoryId = '';
    this.modalCategory = '';
    this.modalStatus = '';
    this.selectedUserId = null;
  }

  handleInputChange(event) {
    const { name, value } = event.target;
    this.formData = { ...this.formData, [name]: value };
  }

  handleTaskClick(event) {
    this.taskType = event.currentTarget.dataset.type;
    this.formData = {};
    this.showTaskTypes = false;
    this.modalCategoryId = '';
    this.modalHeader = this.taskType ? `Add ${this.taskType} Task` : 'Add Task';
    this.modalTemplateName = '';
    this.showModal = true;
  }

  handleSaveNewItem() {
    if (!this.modalTemplateName.trim()) {
      this.showError('Error', 'Task or Document name is required.');
      return;
    }
    this.isLoading = true;
    if (this.taskType) {
      const payload = {
        recordId: this.recordId,
        objectName: this.objectName,
        name: this.modalTemplateName,
        status: this.modalStatus,
        category: this.modalCategory,
        taskType: this.taskType,
        loanId: null,
        contactId: null,
        assignedTo: this.selectedUserId,
        categoryId: this.modalCategory
      };
      if (this.taskType === 'Y/N') {
        if (!this.formData.question?.trim()) {
          this.showError('Error', 'Question is required for Y/N task.');
          this.isLoading = false;
          return;
        }
        payload.question = this.formData.question;
      } else if (this.taskType === 'Credit Card Information') {
        const requiredFields = ['cardholderName', 'cardNumber', 'expirationDate', 'cvv', 'zipCode'];
        for (let field of requiredFields) {
          if (!this.formData[field]?.trim()) {
            this.showError('Error', `${field.replace(/([A-Z])/g, ' $1')} is required.`);
            this.isLoading = false;
            return;
          }
        }
        Object.assign(payload, {
          cardholderName: this.formData.cardholderName,
          cardNumber: this.formData.cardNumber,
          expirationDate: this.formData.expirationDate,
          cvv: this.formData.cvv,
          zipCode: this.formData.zipCode
        });
      } else if (this.taskType === 'Contact Information') {
        const requiredFields = ['fullName', 'email', 'phone', 'address'];
        for (let field of requiredFields) {
          if (!this.formData[field]?.trim()) {
            this.showError('Error', `${field.replace(/([A-Z])/g, ' $1')} is required.`);
            this.isLoading = false;
            return;
          }
        }
        Object.assign(payload, {
          fullName: this.formData.fullName,
          email: this.formData.email,
          phone: this.formData.phone,
          address: this.formData.address
        });
      }
      console.log('Create task payload:', JSON.stringify(payload));
      createTask({ payload })
        .then(newDocument => {
          this.showModal = false;
          this.isTemplateDropdownOpen = false;
          this.isDocumentDropdownOpen = false;
          this.showSuccess('Success', `Task ${newDocument.name} created.`);
          this.documentList = [...this.documentList, newDocument];
          this.sendDocumentsToParent([newDocument]);
        })
        .catch(error => {
          this.showError('Error', error.body?.message || 'Error creating task.');
          console.error('Error creating task:', error);
        })
        .finally(() => (this.isLoading = false));
    } else {
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
      createDocument({ inputJson: JSON.stringify(input) })
        .then(newDocument => {
          this.showModal = false;
          this.isTemplateDropdownOpen = false;
          this.isDocumentDropdownOpen = false;
          this.showSuccess('Success', `${newDocument.name} document created.`);
          this.documentList = [...this.documentList, newDocument];
          this.sendDocumentsToParent([newDocument]);
        })
        .catch(error => {
          this.showError('Error', error.body?.message || 'Error creating document.');
          console.error('Error creating document:', error);
        })
        .finally(() => (this.isLoading = false));
    }
  }

  handleTemplateNameChange(event) {
    this.editableTemplateName = event.target.value;
  }

  closeEditModal() {
    this.editableTemplateName = '';
    this.isEditModalOpen = false;
    this.newItemIds = [];
    this.deletedItemIds = [];
    this.templateDocumentList = [];
  }

  handleAddToTemplate(event) {
    const docId = event.currentTarget.dataset.id;
    let doc = this.availableDocuments.find(d => d.id === docId) || this.availableTasks.find(t => t.id === docId);
    if (doc) {
      this.templateDocumentList = [...this.templateDocumentList, doc];
      if (!this.newItemIds.includes(docId) && !this.originalDocumentIds?.includes(docId)) {
        this.newItemIds.push(docId);
      }
      if (this.isNewTemplate && !this.newItemIds.includes(docId)) {
        this.newItemIds.push(docId);
      }
      this.deletedItemIds = this.deletedItemIds.filter(id => id !== docId);
    }
  }

  handleRemoveFromTemplate(event) {
    const docId = event.currentTarget.dataset.id;
    const doc = this.templateDocumentList.find(d => d.id === docId);
    if (doc) {
      this.templateDocumentList = this.templateDocumentList.filter(d => d.id !== docId);
      this.newItemIds = this.newItemIds.filter(id => id !== docId);
      if (!this.newItemIds.includes(docId) && !this.deletedItemIds.includes(docId)) {
        this.deletedItemIds.push(docId);
      }
    }
  }

  handleAddNewTemplate(event) {
    event.preventDefault();
    this.editableTemplateName = '';
    this.isNewTemplate = true;
    this.isEditModalOpen = true;
    this.templateDocumentList = [];
    this.newItemIds = [];
    this.deletedItemIds = [];
    this.refreshDocuments();
  }

  handleEditTemplate(event) {
    event.preventDefault();
    this.refreshDocuments();
    this.isNewTemplate = false;
    const templateId = event.currentTarget.dataset.templateid;
    this.selectedTemplateId = templateId;
    if (!Array.isArray(this.templateCategoryOptions)) {
      console.error('templateCategoryOptions is not an array:', this.templateCategoryOptions);
      return;
    }
    this.selectedTemplateForEdit = this.templateCategoryOptions.find(t => t.templateId === templateId);
    if (!this.selectedTemplateForEdit) {
      console.error('No template found with templateId:', templateId);
      return;
    }
    this.isLoading = true;
    getDocumentsByTemplate({ templateId, recordId: null, objectName: null })
      .then(result => {
        this.isEditModalOpen = true;
        this.templateDocumentList = result;
        this.originalDocumentIds = result.map(doc => doc.id);
        this.editableTemplateName = this.selectedTemplateForEdit.templateName;
      })
      .catch(error => this.showError('Error', 'Failed to fetch template items.'))
      .finally(() => (this.isLoading = false));
  }

  get templateNameValue() {
    return this.isNewTemplate ? '' : this.selectedTemplateForEdit?.templateName || '';
  }

  handleSaveTemplateChanges() {
    if (!this.editableTemplateName.trim()) {
      this.showError('Error', 'Template name is required.');
      return;
    }
    this.isLoading = true;
    if (!this.isNewTemplate) {
      updateTemplateWithDocuments({
        templateId: this.selectedTemplateId,
        newTemplateName: this.editableTemplateName,
        newItemIds: this.newItemIds,
        deletedItemIds: this.deletedItemIds
      })
        .then(updatedTemplate => {
          this.refreshTemplateCategories();
          this.showSuccess('Success', `${updatedTemplate.name} Template updated.`);
          this.templateDocumentList = updatedTemplate.documents;
          this.originalDocumentIds = updatedTemplate.documents.map(doc => doc.id);
          this.newItemIds = [];
          this.deletedItemIds = [];
          this.closeEditModal();
        })
        .catch(error => this.showError('Error', error.body?.message || 'Error updating template.'))
        .finally(() => (this.isLoading = false));
    } else {
      createTemplateWithDocuments({
        templateName: this.editableTemplateName,
        documentIds: this.newItemIds
      })
        .then(createdTemplate => {
          this.refreshTemplateCategories();
          this.showSuccess('Success', `${createdTemplate.name} Template created.`);
          this.closeEditModal();
          this.editableTemplateName = '';
          this.newItemIds = [];
          this.deletedItemIds = [];
        })
        .catch(error => this.showError('Error', error.body?.message || 'Error creating template.'))
        .finally(() => (this.isLoading = false));
    }
  }

  handleStatusChange(event) {
    this.modalStatus = event.detail.value;
  }

  handleNotesChange(event) {
    this.modalNotes = event.detail.value;
  }

  handleUserChange(event) {
    this.selectedUserId = event.detail.value;
  }

  sendDocumentsToParent(documents) {
    if (!Array.isArray(documents) || documents.length === 0) {
      console.warn('Invalid or empty documents array:', documents);
      return;
    }
    const validDocuments = documents.filter(doc => doc && typeof doc === 'object' && doc.id);
    if (validDocuments.length !== documents.length) {
      console.warn('Some documents are invalid:', documents.filter(doc => !doc || typeof doc !== 'object' || !doc.id));
    }
    this.dispatchEvent(new CustomEvent('templateitemsloaded', {
      detail: { documents: validDocuments, append: true }
    }));
  }

  showError(title, error) {
    const message = typeof error === 'string' ? error : error.body?.message || 'An unknown error occurred.';
    this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'error' }));
  }

  showSuccess(title, message) {
    this.dispatchEvent(new ShowToastEvent({ title, message, variant: 'success' }));
  }

  // New Category Modal Handlers
  handleAddNewCategory() {
    this.showNewCategoryModal = true;
  }

  closeNewCategoryModal() {
    this.showNewCategoryModal = false;
    this.newCategoryName = '';
    this.newCategoryDescription = '';
  }

  handleNewCategoryInput(event) {
    this.newCategoryName = event.target.value;
  }

  handleNewCategoryDescriptionInput(event) {
    this.newCategoryDescription = event.target.value;
  }

  createNewCategory() {
    const categoryName = this.newCategoryName?.trim();
    if (!categoryName) {
      this.showError('Error', 'Category name cannot be empty.');
      return;
    }
    this.isLoading = true;
    createDocumentCategory({ name: categoryName })
      .then(newCategory => {
        this.refreshDocumentCategories();
        this.dispatchEvent(new CustomEvent('categorycreated', {
          detail: { category: newCategory },
          bubbles: true,
          composed: true
        }));
        this.showSuccess('Success', `Category "${newCategory.name}" created.`);
        this.closeNewCategoryModal();
      })
      .catch(error => this.showError('Error', error.body?.message || 'Failed to create category.'))
      .finally(() => (this.isLoading = false));
  }
}