import { LightningElement, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getGroups from '@salesforce/apex/CampaignController.getGroups';
import getCampaigns from '@salesforce/apex/CampaignController.getCampaigns';
import getCampaignsWithSteps from '@salesforce/apex/CampaignController.getCampaignsWithSteps';
import getGroupsWithMembers from '@salesforce/apex/CampaignController.getGroupsWithMembers';
import getCampaignsWithStepsByDate from '@salesforce/apex/CampaignController.getCampaignsWithStepsByDate';
import deleteEvent from '@salesforce/apex/CampaignController.deleteCampaignEventBased';
import CELEBRATION_GIF from '@salesforce/resourceUrl/celebrationGif';
const CAMPAIGNCOLUMNS = [
    { label: 'Name', fieldName: 'Name' },
    { label: 'Campaign Name', fieldName: 'Campaign_Name__c' },
    { label: 'Group', fieldName: 'GroupName' },
    { label: 'Last Sent', fieldName: 'Last_Sent__c', type: 'date' },
    { label: 'Start Date Time', fieldName: 'Start_Date_Time__c', type: 'date' }
];
export default class DripCampaginCreation extends LightningElement {

    @track campaignName = '';
    @track startDate = '';
    @track endDate = '';
    @track status = '';
    @track budget = '';
    @track currentStep = 1;
    @track isLoading = false;
    
    @track campaigns = [];
    @track campaignsteps = [];
    @track groups = [];
    @track allGroups = [];
    @track confettiItems = [];
    groupcolumns = CAMPAIGNCOLUMNS;
     gifUrl = CELEBRATION_GIF;

    @track groupNameFilter = '';
    @track basedOnFilter = '';
    filteredGroups = [];

    // Campaign filters
    campaignStartDateFrom;
    campaignStartDateTo;

    basedOnOptions = [
        { label: 'All', value: '' },
        { label: 'Account', value: 'Account' },
        { label: 'Lead', value: 'Lead' },
        { label: 'Leads & Contacts', value: 'Leads & Contacts' }
    ];

     @track showAnimation = false;

    // Group filters
    groupDateFrom;
    groupDateTo;

    @track showNewModeal = false;
    @track showNewGroupModal = false;
    @track showStepModal = false;
    @track showMemberModal = false;
    @track hoveredRowId = null;
    @track hoveredRowIdGroup = null;
    campaignStepsMap = {};
    @track campaignIdForStep;

    flowVariables = [];

    handleGroupNameChange(event) {
        this.groupNameFilter = event.target.value;
        this.filterGroups();
    }

     handleBasedOnChange(event) {
        try {
            this.basedOnFilter = event.detail.value;
            console.log('Selected:', this.basedOnFilter);
            this.filterGroups();
        } catch (error) {
            console.error('Combobox Change Error:', error);
        }
    }

    get backgroundStyle() {
        return `background-image: url(${CELEBRATION_GIF}); background-size: cover;`;
    }

    async deleteCampaignEventBased(event){
        this.isLoading=true;
        const button = event.currentTarget;
        const campId = button.dataset.id;
        await deleteEvent({ 
                    CampaignID: campId
                })
                .then(result => {
                        if(result===true){
                            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Campaign deleted successfully!',
                variant: 'success'
            }));
                        }
                    console.log('Campaigns Delete->' + JSON.stringify(result));
                })
                .catch(error => {
                    console.error('Error fetching filtered campaigns:', error);
                });

        this.getCampaignsSyncWithSteps();
        this.isLoading=false;

    }

    filterGroups() {
            let filtered = [...this.allGroups];

            if (this.groupNameFilter) {
                filtered = filtered.filter(group =>
                    group.name?.toLowerCase().includes(this.groupNameFilter)
                );
            }

            if (this.basedOnFilter) {
                filtered = filtered.filter(group =>
                    group.based === this.basedOnFilter
                );
            }

            this.groups = filtered;
     }


//     renderedCallback() {
//     if (this.scriptLoaded) return;

//     loadScript(this, FIREWORKS_JS)
//       .then(() => {
//         this.scriptLoaded = true;
//         console.log('Fireworks script loaded');
//       })
//       .catch((error) => {
//         console.error('Error loading fireworks script', error);
//       });
//   }

    





    get isStep1() {
        return this.currentStep === 1;
    }
    get isStep2() {
        return this.currentStep === 2;
    }
    get isStep3() {
        return this.currentStep === 3;
    }

    statusOptions = [
        { label: 'Planned', value: 'Planned' },
        { label: 'In Progress', value: 'In Progress' },
        { label: 'Completed', value: 'Completed' },
        { label: 'Cancelled', value: 'Cancelled' }
    ];

    handleChange(event) {
        this[event.target.name] = event.target.value;
    }

    nextStep() {
        if (this.currentStep < 3) {
            this.currentStep++;
        }
    }

    closeNewModal() {
        this.showNewModeal = false;
    }

    closeGroupModal() {
        this.showNewGroupModal = false;
    }

    showGroupModal() {
        this.showNewGroupModal = true;
    }

    showNewModel() {
        this.showNewModeal = true;
    }

    showNewMemberModal(event) {
        const button = event.currentTarget;
        const groupId = button.dataset.id;
        this.flowVariables = [
            {
                name: 'recordid',
                type: 'String',
                value: groupId
            }
        ];
        this.showMemberModal = true;
    }

    closeNewMemberModal() {
        this.showMemberModal = false;
    }

    handleFlowStatusChange(event) {
        if (event.detail.status === 'FINISHED') {
            this.showMemberModal = false;
        }
    }

    prevStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    handleCampaignDateChange(event) {
        const field = event.target.label;
        if (field === 'Start Date (From)') {
            this.campaignStartDateFrom = event.target.value;
        } else if (field === 'Start Date (To)') {
            this.campaignStartDateTo = event.target.value;
        }
        this.filterCampaigns();
    }

    async filterCampaigns() {
        
        alert(this.campaignStartDateFrom + ' ' + this.campaignStartDateTo);

                await getCampaignsWithStepsByDate({ 
                    startDateFrom: this.campaignStartDateFrom, 
                    startDateTo: this.campaignStartDateTo 
                })
                .then(result => {
                        this.campaigns = result.map((item) => ({
                        ...item,
                        isHovered: this.hoveredRowId === item.Id
                    }));
                    console.log('Campaigns Result With Steps Date Filters->' + JSON.stringify(result));
                })
                .catch(error => {
                    console.error('Error fetching filtered campaigns:', error);
                });
    }


    handleGroupDateChange(event) {
        const field = event.target.label;
        if (field === 'Created Date (From)') {
            this.groupDateFrom = event.target.value;
        } else if (field === 'Created Date (To)') {
            this.groupDateTo = event.target.value;
        }
        this.filterGroups();
    }

    

    showNewStepModal(event) {


        const button = event.currentTarget;


        const campaignId = button.dataset.id;
        this.campaignIdForStep = campaignId;



        this.showStepModal = true;


    }

    closeStepModal() {
        this.showStepModal = false;
    }

    connectedCallback() {
        //this.getCampaignsSync();
        this.getCampaignsSyncWithSteps();
        this.getGroupsSync();
        this.getGroupWithMemberSync();
    }

    handleSuccess(event) {
        this.getCampaignsSync();
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Campaign created successfully!',
                variant: 'success',
            })
        );

        this.closeNewModal();
    }

    handleSuccessStep(event) {

        this.getCampaignsSyncWithSteps();
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Step created successfully!',
                variant: 'success',
            })
        );

        this.closeStepModal();
    }

    handleSuccessGroup(event) {

        this.getGroupsSync();
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: 'Group created successfully!',
                variant: 'success',
            })
        );

        this.closeGroupModal();

    }

    getStepsForCampaign(campaignId) {
        return this.campaignStepsMap[campaignId] || [];
    }

    handleMouseOver(event) {
        const hoveredId = event.currentTarget.dataset.id;
        const icon = event.currentTarget;

        const iconRect = icon.getBoundingClientRect();
        const container = this.template.querySelector('.tbl-content');
        const containerRect = container.getBoundingClientRect();

        const spaceBelow = containerRect.bottom - iconRect.bottom;
        const position = spaceBelow < 250 ? 'top' : 'bottom';

        this.campaigns = this.campaigns.map(item => ({
            ...item,
            isHovered: item.Id === hoveredId,
            tooltipPosition: item.Id === hoveredId ? position : 'bottom',
            tooltipBoxClass: item.Id === hoveredId ? `tooltip-box tooltip-${position}` : ''
        }));

       

        this.showAnimation = true;

        
       


    }

    handleMouseOut() {
        this.campaigns = this.campaigns.map(item => ({
            ...item,
            isHovered: false,
            tooltipPosition: 'bottom',
            tooltipBoxClass: ''
        }));
        this.showAnimation = false;
    }

    randomColor() {
    const colors = ['#f94144', '#f3722c', '#f9c74f', '#43aa8b', '#577590'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

    updateHoverState() {
        this.campaigns = this.campaigns.map((item) => ({
            ...item,
            isHovered: item.Id === this.hoveredRowId
        }));
    }

    handleMouseOverGroup(event) {
        const hoveredId = event.currentTarget.dataset.id;
        const icon = event.currentTarget;

        const iconRect = icon.getBoundingClientRect();
        const container = this.template.querySelector('.tbl-content');
        const containerRect = container.getBoundingClientRect();

        const spaceBelow = containerRect.bottom - iconRect.bottom;
        const position = spaceBelow < 250 ? 'top' : 'bottom';
        const className = `tooltip-box tooltip-${position}`;

        this.groups = this.groups.map(item => ({
            ...item,
            isHovered: item.id === hoveredId,
            memberTooltipClass: item.id === hoveredId ? className : ''
        }));
    }

    handleMouseOutGroup() {
        this.groups = this.groups.map(item => ({
            ...item,
            isHovered: false,
            memberTooltipClass: ''
        }));
    }

    updateHoverStateGroup() {
        this.groups = this.groups.map((item) => ({
            ...item,
            isHovered: item.id === this.hoveredRowIdGroup
        }));
    }

    tooltipBoxClass(item) {
        return `tooltip-box tooltip-${item.tooltipPosition || 'bottom'}`;
    }

    async getGroupWithMemberSync() {
        this.isLoading = true;
        await getGroupsWithMembers()
            .then(result => {
                this.allGroups = result.map((item) => ({
                    ...item,
                    isHovered: this.hoveredRowIdGroup === item.id
                }));
                console.log('Groups With Members Result->' + JSON.stringify(result));
                this.error = undefined;
                this.groups=this.allGroups;
            })
            .catch(error => {
                this.error = error;
                console.error(error);
                //this.campaigns = undefined;
            });

        this.isLoading = false;
    }

    async getCampaignsSync() {
        this.isLoading = true;
        await getCampaigns()
            .then(result => {
                //this.campaigns = result;
                this.campaigns = result.map((item) => ({
                    ...item,
                    isHovered: this.hoveredRowId === item.Id
                }));
                console.log('Campaigns Result->' + JSON.stringify(result));
                this.error = undefined;
            })
            .catch(error => {
                this.error = error;
                this.campaigns = undefined;
            });

        this.isLoading = false;
    }

    async getCampaignsSyncWithSteps() {
        this.isLoading = true;
        await getCampaignsWithSteps()
            .then(result => {
                //this.campaigns = result;
                this.campaigns = result.map((item) => ({
                    ...item,
                    isHovered: this.hoveredRowId === item.Id
                }));
                console.log('Campaigns Result With Steps->' + JSON.stringify(result));
                this.error = undefined;
            })
            .catch(error => {
                this.error = error;
                this.campaigns = undefined;
            });

        this.isLoading = false;
    }



    async getGroupsSync() {
        this.isLoading = true;
        await getGroups()
            .then(result => {
                //this.groups = result;
                this.groups = result.map((item) => ({
                    ...item,
                    isHovered: this.hoveredRowIdGroup === item.Id
                }));
                console.log('Groups Result->' + JSON.stringify(result));
                this.error = undefined;
            })
            .catch(error => {
                this.error = error;
                this.groups = undefined;
            });

        this.isLoading = false;
    }

    async handleSubmit() {
        this.isLoading = true;
        try {
            const fields = {
                Name: this.campaignName,
                Start_Date__c: this.startDate,
                End_Date__c: this.endDate,
                Status__c: this.status,
                Budget__c: parseFloat(this.budget)
            };
            //await createCampaign({ campaignData: fields });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Success',
                message: 'Campaign created successfully!',
                variant: 'success'
            }));
        } catch (error) {
            this.dispatchEvent(new ShowToastEvent({
                title: 'Error',
                message: error.body?.message || 'Something went wrong.',
                variant: 'error'
            }));
        } finally {
            this.isLoading = false;
        }
    }
}