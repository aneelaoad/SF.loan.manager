import { LightningElement, track, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import { NavigationMixin } from 'lightning/navigation';
import { refreshApex } from '@salesforce/apex';
import getAssignedDocuments from '@salesforce/apex/DocumentTemplateController.getAssignedDocuments';
import getDocumentCategories from '@salesforce/apex/DocumentTemplateController.getDocumentCategories';
import getArchivedDocuments from '@salesforce/apex/DocumentTemplateController.getArchivedDocuments';
import archiveDocumentAssignment from '@salesforce/apex/DocumentTemplateController.archiveDocumentAssignment';
import deleteArchivedAssignments from '@salesforce/apex/DocumentTemplateController.deleteArchivedAssignments';
import restoreArchivedAssignments from '@salesforce/apex/DocumentTemplateController.restoreArchivedAssignments';
import createTask from '@salesforce/apex/DocumentTemplateController.createTask';
import sendReadyToSendDocuments from '@salesforce/apex/DocumentTemplateController.sendReadyToSendDocuments';
import getActiveUsers from '@salesforce/apex/DocumentTemplateController.getActiveUsers';
import getCurrentUserContext from '@salesforce/apex/UtilityClass.getCurrentUserContext';
import { getObjectInfo, getPicklistValues } from 'lightning/uiObjectInfoApi';
import DOCUMENT_OBJECT from '@salesforce/schema/Document__c';
import STATUS_FIELD from '@salesforce/schema/Document__c.Status__c';
import TASKTYPE_FIELD from '@salesforce/schema/Document__c.Task_Type__c';

export default class CustomTaskManager extends NavigationMixin(LightningElement) {
  // Properties
  @api recordId;
  @track objectName = '';
  @track isExperienceSite = false;
  @track users = [];
  @track selectedUserId;
  @track selectedCategories = [];
  @track showVerification = false;
  @track isArchived = false;
  @track masterDocumentList = [];
  @track archivedList = [];
  @track isEmailModalOpen = false;
  @track readyToSendDocuments = [];
  @track isLoading = false;
  @track documentCategoryOptions = [];
  @track selectedDocumentCategory;
  @track showModal = false;
  @track categoryList = [];
  @track taskTypeOptions = [];
  @track showTaskTypes = false;
  @track taskType = '';
  @track formData = {};
  @track modalTemplateName = '';
  @track selectedStatus = '';
  @api sendFlag = false;
  wiredDocumentResult;
  archivedWireResult;

  // Getters
  get groupedByStatus() {
    const groups = {};
    const archivedIds = new Set((this.archivedList || []).map(item => item.id));

    let filteredDocuments = (this.masterDocumentList || []).filter(item => {
      if (!item) return false;
      if (archivedIds.has(item.id)) return false;
      if (this.selectedCategories.length === 0) return true;
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

  get groupedByStatusWithReadyToSend() {
    return this.groupedByStatus.map(group => ({
      ...group,
      isReadyToSend: this.isReadyToSend(group.status)
    }));
  }

  get readyToSendDocsWithEmails() {
    const readyToSendDocs = (this.masterDocumentList || [])
      .filter(doc => doc && doc.status === 'Ready to Send' && doc.assignedToEmail && doc.id)
      .map(doc => ({
        id: doc.id,
        email: doc.assignedToEmail,
        name: doc.assignedTo || 'Customer'
      }));
    console.log('readyToSendDocs:', JSON.stringify(readyToSendDocs));
    return readyToSendDocs;
  }

  get statusKeys() {
    return this.groupedByStatus.map(group => group.status);
  }

  get isEmpty() {
    return this.masterDocumentList.length === 0;
  }

  get hasArchivedDocs() {
    return this.archivedList && this.archivedList.length > 0;
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

  get modalTitle() {
    return this.taskType ? `Add ${this.taskType} Task` : 'Add Task';
  }

  // Wired Methods
  @wire(CurrentPageReference)
  getPageReference(pageRef) {
    if (pageRef && !this.isExperienceSite) {
      console.log('CurrentPageReference:', pageRef);
      this.recordId = pageRef.attributes.recordId;
      this.objectName = pageRef.attributes.objectApiName;
      console.log('Internal User - recordId:', this.recordId, 'objectName:', this.objectName);
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

  @wire(getAssignedDocuments, { recordId: '$recordId', objectName: '$objectName' })
  wiredDocuments(result) {
    this.wiredDocumentResult = result;
    console.log('wiredDocuments:', result);
    const { data, error } = result;
    if (data) {
      this.masterDocumentList = data;
      this.error = undefined;
    } else if (error) {
      this.error = error;
      this.masterDocumentList = [];
      console.error('Error fetching assigned documents:', error);
    }
  }

  @wire(getArchivedDocuments, { recordId: '$recordId', objectName: '$objectName' })
  wiredArchivedDocs(result) {
    this.archivedWireResult = result;
    console.log('getArchivedDocuments:', JSON.stringify(result));
    const { data, error } = result;
    if (data) {
      this.archivedList = data;
    } else if (error) {
      console.error('Error fetching archived docs:', error);
    }
  }

  @wire(getObjectInfo, { objectApiName: DOCUMENT_OBJECT })
  objectInfo;

  @wire(getPicklistValues, {
    recordTypeId: '$objectInfo.data.defaultRecordTypeId',
    fieldApiName: STATUS_FIELD
  })
  wiredPicklistValues({ error, data }) {
    if (data) {
      this.statusOptions = data.values;
    } else if (error) {
      console.error('Error loading status picklist values:', error);
    }
  }

  @wire(getPicklistValues, {
    recordTypeId: '$objectInfo.data.defaultRecordTypeId',
    fieldApiName: TASKTYPE_FIELD
  })
  wiredTaskTypeValues({ error, data }) {
    if (data) {
      this.taskTypeOptions = data.values;
      console.log('Task types:', JSON.stringify(this.taskTypeOptions));
    } else if (error) {
      console.error('Error loading task type picklist values:', error);
    }
  }

  // Lifecycle Hook
  connectedCallback() {
    this.isLoading = true;
    getCurrentUserContext()
      .then(context => {
        console.log('CustomTaskManager - context:', context);
        this.isExperienceSite = context.isExperienceSite;
        if (this.isExperienceSite) {
          this.objectName = 'User';
          this.recordId = context.userId;
          console.log('Experience Site - objectName:', this.objectName, 'recordId:', this.recordId);
        }
        this.refreshDocumentCategories();
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

  // Helper Methods
  isReadyToSend(status) {
    return status === 'Ready to Send';
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
    return styleMap[name] || 'default-dot';
  }

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({
        title,
        message,
        variant
      })
    );
  }

  refreshDocumentCategories() {
    getDocumentCategories()
      .then(data => {
        console.log('Document categories:', data);
        this.documentCategoryOptions = data.map(item => ({
          label: item.name,
          value: item.id
        }));
        this.categoryList = data.map(cat => ({
          name: cat.name,
          circleClass: this.getCategoryClass(cat.name),
          labelClass: 'category-label'
        }));
        this.categoryList.push({
          name: 'Reset',
          icon: 'utility:refresh',
          isReset: true,
          labelClass: 'category-label'
        });
        console.log('categoryList:', JSON.stringify(this.categoryList));
        console.log('documentCategoryOptions:', JSON.stringify(this.documentCategoryOptions));
      })
      .catch(error => {
        console.error('Error loading categories:', error);
        this.categoryList = [];
        this.showToast('Error', 'Failed to load document categories.', 'error');
      });
  }

  // Event Handlers
  handleUserChange(event) {
    this.selectedUserId = event.detail.value;
  }

  handleCategoryCreated(event) {
    const newCategory = event.detail.category;
    this.refreshDocumentCategories();
    this.showToast('Success', `Category "${newCategory.name}" created.`, 'success');
  }

  deleteArchivedDocuments(documentIds, name = null) {
    if (!documentIds || documentIds.length === 0) return;
    this.isLoading = true;
    deleteArchivedAssignments({ documentIds, recordId: this.recordId, objectName: this.objectName })
      .then(() => {
        this.archivedList = this.archivedList.filter(doc => !documentIds.includes(doc.id));
        this.masterDocumentList = this.masterDocumentList.filter(doc => !documentIds.includes(doc.id));
        this.isArchived = this.archivedList.length > 0;
        this.showToast(
          'Deleted',
          name ? `Archived document "${name}" deleted.` : 'All archived documents deleted.',
          'success'
        );
        return Promise.all([
          refreshApex(this.archivedWireResult),
          refreshApex(this.wiredDocumentResult)
        ]);
      })
      .catch(error => {
        this.showToast('Error', error.body?.message || 'Failed to delete archived document(s).', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  handleDeleteArchived(event) {
    const documentId = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    this.deleteArchivedDocuments([documentId], name);
  }

  handleDeleteAllArchived() {
    const documentIds = this.archivedList.map(doc => doc.id);
    this.deleteArchivedDocuments(documentIds);
  }

  handleArchiveRecord(event) {
    const documentId = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    this.isLoading = true;
    archiveDocumentAssignment({ documentId, recordId: this.recordId, objectName: this.objectName })
      .then(() => {
        this.masterDocumentList = this.masterDocumentList.filter(row => row.id !== documentId);
        return Promise.all([
          refreshApex(this.archivedWireResult),
          refreshApex(this.wiredDocumentResult)
        ]);
      })
      .then(() => {
        this.showToast('Archived', `${name} archived successfully.`, 'info');
      })
      .catch(error => {
        this.showToast('Error', error.body?.message || 'Failed to archive document.', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  handleCloseModal() {
    this.isArchived = false;
    this.showModal = false;
    this.taskType = '';
    this.formData = {};
    this.modalTemplateName = '';
    this.selectedDocumentCategory = '';
    this.selectedStatus = '';
    this.selectedUserId = null;
  }

  restoreDocumentsHelper(documentIds, successMessage, skipArchiveReset = false) {
    if (!documentIds || documentIds.length === 0) return;
    this.isLoading = true;
    restoreArchivedAssignments({ documentIds, recordId: this.recordId, objectName: this.objectName })
      .then((restoredDocuments) => {
        this.archivedList = this.archivedList.filter(doc => !documentIds.includes(doc.id));
        if (!skipArchiveReset) {
          this.isArchived = false;
        }
        if (restoredDocuments && restoredDocuments.length > 0) {
          const existingIds = new Set(this.masterDocumentList.map(doc => doc.id));
          const newDocs = restoredDocuments.filter(doc => !existingIds.has(doc.id));
          this.masterDocumentList = [...this.masterDocumentList, ...newDocs];
        }
        return refreshApex(this.wiredDocumentResult);
      })
      .then(() => {
        this.showToast('Success', successMessage, 'success');
      })
      .catch(error => {
        this.showToast('Error', error.body?.message || 'Failed to restore document(s).', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  handleRestoreArchived(event) {
    const documentId = event.currentTarget.dataset.id;
    const name = event.currentTarget.dataset.name;
    this.restoreDocumentsHelper([documentId], `${name} restored successfully.`, true);
  }

  handleRestoreAllArchived() {
    const documentIds = this.archivedList.map(item => item.id);
    if (documentIds.length === 0) return;
    this.restoreDocumentsHelper(documentIds, 'All archived documents restored.');
  }

  handleEmailClick(event) {
    const readyToSendDocs = this.masterDocumentList.filter(
      doc => doc.status === 'Ready to Send' && !doc.isArchived
    );
    if (readyToSendDocs.length === 0) {
      this.showToast('Error', 'No documents are ready to send.', 'error');
      return;
    }
    const documentIds = readyToSendDocs.map(doc => doc.id);
    this.isLoading = true;
    sendReadyToSendDocuments({
      documentIds: documentIds,
      recordId: this.recordId,
      objectName: this.objectName
    })
      .then(result => {
        this.showToast(
          result.success ? 'Success' : 'Error',
          result.message,
          result.success ? 'success' : 'error'
        );
      })
      .catch(error => {
        this.showToast('Error', error.body?.message || 'Failed to send email.', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  closeEmailPopover() {
    this.isEmailPopoverOpen = false;
  }

  handleMenuSelect(event) {
    const selected = event.detail.value;
    if (selected === 'newTemplate') {
      this.handleNewTemplate();
    } else if (selected === 'fromExisting') {
      this.handleFromExisting();
    }
  }

  handleRefreshClick() {
    this.isLoading = true;
    Promise.all([
      refreshApex(this.wiredDocumentResult),
      refreshApex(this.archivedWireResult)
    ])
      .then(() => {
        this.showToast('Success', 'Document lists refreshed.', 'success');
      })
      .catch(error => {
        this.showToast('Error', 'Failed to refresh document lists.', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  handleArchiveClick() {
    this.isArchived = !this.isArchived;
    this.isLoading = true;
    if (this.archivedWireResult) {
      refreshApex(this.archivedWireResult)
        .then(() => {
          this.archivedList = this.archivedWireResult.data || [];
          console.log('Archived list refreshed');
        })
        .catch(error => {
          console.error('Error refreshing archived list:', error);
          this.showToast('Error', 'Failed to refresh archived documents.', 'error');
        })
        .finally(() => {
          this.isLoading = false;
        });
    } else {
      this.isLoading = false;
    }
  }

  handleMortgageAppClick() {
    console.log('Mortgage App button clicked!');
  }

  handleCategoryClick(event) {
    const clickedCategory = event.currentTarget.dataset.name;
    if (clickedCategory === 'Reset') {
      this.selectedCategories = [];
    } else {
      if (this.selectedCategories.includes(clickedCategory)) {
        this.selectedCategories = this.selectedCategories.filter(cat => cat !== clickedCategory);
      } else {
        this.selectedCategories = [...this.selectedCategories, clickedCategory];
      }
    }
    this.categoryList = this.categoryList.map(cat => ({
      ...cat,
      labelClass: this.selectedCategories.includes(cat.name) ? 'category-label selected' : 'category-label'
    }));
  }

  handleTemplateItems(event) {
    const items = event.detail.documents;
    console.log('Received document/s:', items);
    this.masterDocumentList = [...this.masterDocumentList, ...items];
    this.selectedCategories = [];
    this.categoryList = this.categoryList.map(cat => ({
      ...cat,
      labelClass: 'category-label'
    }));
  }

  handleTaskTypes(event) {
    event.preventDefault();
    this.showTaskTypes = !this.showTaskTypes;
    if (this.showTaskTypes) {
      this.sendFlag = true;
    }
  }

  handleModalInputChange(event) {
    const { name, value } = event.target;
    if (name === 'taskName') {
      this.modalTemplateName = value;
    }
  }

  handleDocumentCategoryChange(event) {
    this.selectedDocumentCategory = event.detail.value;
  }

  handleStatusChange(event) {
    this.selectedStatus = event.detail.value;
  }

  handleInputChange(event) {
    const { name, value } = event.target;
    this.formData = {
      ...this.formData,
      [name]: value
    };
    console.log('formData:', JSON.stringify(this.formData));
  }

  handleTaskClick(event) {
    this.taskType = event.currentTarget.dataset.type;
    this.formData = {};
    this.showTaskTypes = false;
    this.showModal = true;
  }

  handleSubmit() {
    if (!this.modalTemplateName.trim()) {
      this.showToast('Error', 'Task name is required.', 'error');
      return;
    }
    this.isLoading = true;
    const payload = {
      recordId: this.recordId,
      objectName: this.objectName,
      name: this.modalTemplateName,
      status: this.selectedStatus,
      category: this.selectedDocumentCategory,
      taskType: this.taskType,
      loanId: null,
      contactId: null,
      assignedTo: this.selectedUserId,
      categoryId: this.selectedDocumentCategory
    };
    if (this.taskType === 'Y/N') {
      if (!this.formData.question?.trim()) {
        this.showToast('Error', 'Question is required for Y/N task.', 'error');
        this.isLoading = false;
        return;
      }
      payload.question = this.formData.question;
    } else if (this.taskType === 'Credit Card Information') {
      const requiredFields = ['cardholderName', 'cardNumber', 'expirationDate', 'cvv', 'zipCode'];
      for (let field of requiredFields) {
        if (!this.formData[field]?.trim()) {
          this.showToast('Error', `${field.replace(/([A-Z])/g, ' $1')} is required.`, 'error');
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
          this.showToast('Error', `${field.replace(/([A-Z])/g, ' $1')} is required.`, 'error');
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
        this.showToast('Success', `Task ${newDocument.name} created successfully.`, 'success');
        this.masterDocumentList = [...this.masterDocumentList, newDocument];
        this.handleCloseModal();
      })
      .catch(error => {
        this.showToast('Error', error.body?.message || 'Failed to create task.', 'error');
        console.error('Error creating task:', error);
      })
      .finally(() => {
        this.isLoading = false;
      });
  }
}