import { LightningElement, track } from 'lwc';

export default class NotesManager extends LightningElement {

    /* ---------- Hard‑coded data ---------- */
    allNotes = [
        { id: 1, name: 'Kick‑off Call', body: 'Discussed loan docs.', owner: 'A. Khan', role: 'Loan Officer', created: '2025‑06‑01' },
        { id: 2, name: 'Income Review', body: 'Need pay‑stubs.', owner: 'B. Aziz', role: 'Underwriter', created: '2025‑06‑03' },
        { id: 3, name: 'Appraisal', body: 'Ordered 6/4', owner: 'A. Khan', role: 'Processor', created: '2025‑06‑04' },
        { id: 4, name: 'Compliance', body: 'TRID checked.', owner: 'C. Shah', role: 'Compliance', created: '2025‑06‑05' },
        { id: 5, name: 'Funding', body: 'Docs with title.', owner: 'A. Khan', role: 'Closer', created: '2025‑06‑06' },
    ];

   roleFilters = [
    { label: 'Processor',            icon: 'utility:user',      color: '#39b54a' },
    { label: 'Loan Officer',         icon: 'utility:briefcase', color: '#ff6f25' },
    { label: 'Closer',               icon: 'utility:task',      color: '#ff6f25' },
    { label: 'Loan Officer Assistant', icon: 'utility:user',    color: '#1b96ff' },
    { label: 'Funder',               icon: 'utility:user',      color: '#1b96ff' },
    { label: 'Owner',                icon: 'utility:user',      color: '#1b96ff' },
    { label: 'Team Lead',            icon: 'utility:user',      color: '#1b96ff' },
];

/* ---------- Computed helpers for template ---------- */
get roleFiltersComputed() {
    // returns a copy with variant + dynamic style token
    return this.roleFilters.map(r => ({
        ...r,
        variant: this.selectedRoles.has(r.label) ? 'brand' : 'neutral',
    }));
}
get hasSelectedRoles()  { return this.selectedRoles.size > 0; }
get selectedRolesArr()  { return [...this.selectedRoles]; }

    /* ---------- UI state ---------- */
    showSearch = false;
    searchTerm = '';
    filterByUser = false;
    selectedRoles = new Set();

    @track visibleNotes = [];

    /* Modal state */
    showEditor = false;
    showDeleteConfirm = false;
    isNew = false;           // true=new, false=edit
    draft = { id: null, name: '', body: '' };
    deleteTarget = {};

    connectedCallback() {
        this.applyFilters();
    }

    /* ---------- Row 1 actions ---------- */
    toggleSearch() {
        this.showSearch = !this.showSearch;
        if (!this.showSearch) {
            this.searchTerm = '';
            this.applyFilters();
        }
    }

    toggleUserFilter() {
        this.filterByUser = !this.filterByUser;
        this.applyFilters();
    }
    get userFilterVariant() {
        return this.filterByUser ? 'brand' : 'neutral';
    }

    handleSearch(event) {
        this.searchTerm = event.target.value.toLowerCase();
        this.applyFilters();
    }

    openNewModal() {
        this.isNew = true;
        this.draft = { id: null, name: '', body: '' };
        this.showEditor = true;
    }

    /* ---------- Row 2 actions ---------- */
    handleRoleClick(event) {
        const role = event.target.dataset.role;
        if (this.selectedRoles.has(role)) {
            this.selectedRoles.delete(role);
        } else {
            this.selectedRoles.add(role);
        }
        this.applyFilters();
    }
    roleButtonVariant = ({ dataset }) => (
        this.selectedRoles.has(dataset.role) ? 'brand' : 'neutral'
    );

    /* ---------- Row 3+ filtering ---------- */
    applyFilters() {
        const curUser = 'A. Khan'; // hard‑coded current user
        const roleSet = this.selectedRoles;
        const term = this.searchTerm;

        this.visibleNotes = this.allNotes.filter(n => {
            const userOk   = this.filterByUser ? n.owner === curUser : true;
            const roleOk   = roleSet.size ? roleSet.has(n.role) : true;
            const searchOk = term ? (n.name.toLowerCase().includes(term) || n.body.toLowerCase().includes(term)) : true;
            return userOk && roleOk && searchOk;
        });

    }
    get isEmpty() { return !this.visibleNotes.length; }

    /* ---------- Edit / Delete handlers ---------- */
    openEditModal(event) {
        const id = Number(event.target.dataset.id);
        const note = this.allNotes.find(n => n.id === id);
        this.draft = { ...note };
        this.isNew = false;
        this.showEditor = true;
    }

    saveNote() {
        if (this.isNew) {
            // quick mock id
            const nextId = Math.max(...this.allNotes.map(n => n.id)) + 1;
            this.allNotes = [ ...this.allNotes, { ...this.draft, id: nextId, owner: 'A. Khan', role: 'Loan Officer', created: new Date().toISOString().slice(0,10) } ];
        } else {
            this.allNotes = this.allNotes.map(n => n.id === this.draft.id ? { ...n, name: this.draft.name, body: this.draft.body } : n);
        }
        this.closeEditor();
        this.applyFilters();
    }
    updateDraft(event) {
        const field = event.target.dataset.field;
        this.draft = { ...this.draft, [field]: event.target.value };
    }
    closeEditor() { this.showEditor = false; }

    /* ---------- Delete flow ---------- */
    openDeleteModal(event) {
        const id = Number(event.target.dataset.id);
        this.deleteTarget = this.allNotes.find(n => n.id === id);
        this.showDeleteConfirm = true;
    }
    confirmDelete() {
        this.allNotes = this.allNotes.filter(n => n.id !== this.deleteTarget.id);
        this.closeDelete();
        this.applyFilters();
    }
    closeDelete() { this.showDeleteConfirm = false; }

    /* ---------- Modal helpers ---------- */
    get modalTitle() { return this.isNew ? 'New Note' : 'Edit Note'; }
    get saveLabel()  { return this.isNew ? 'Create'  : 'Save'; }

}