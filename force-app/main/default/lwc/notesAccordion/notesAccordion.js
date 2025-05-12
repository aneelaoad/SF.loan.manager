import { LightningElement } from 'lwc';
export default class NotesAccordion extends LightningElement {
   isOpen = false;

    // Dynamically set the icon name based on whether the accordion is open or closed
    get arrowIcon() {
        return this.isOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    toggleAccordion() {
        this.isOpen = !this.isOpen;
    }
}