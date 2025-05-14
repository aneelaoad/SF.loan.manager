import { LightningElement } from 'lwc';
import INFORMECHS_ICONS from '@salesforce/resourceUrl/informechsIcons';

export default class NotesAccordion extends LightningElement {
   isOpen = false;
    downChevronImg = INFORMECHS_ICONS + '/downchevron.png';  // Path to the image
    upChevronImg = INFORMECHS_ICONS + '/rightchevron.png';  // Path to the image

    // Dynamically set the icon name based on whether the accordion is open or closed
    get arrowIcon() {
        return this.isOpen ? this.downChevronImg : this.upChevronImg;
        // return this.isOpen ? 'utility:chevrondown' : 'utility:chevronright';
    }

    toggleAccordion() {
        this.isOpen = !this.isOpen;
    }

    connectedCallback() {
        console.log('INFORMECHS_ICONS : ',INFORMECHS_ICONS);
        console.log('downChevronImg : ',this.downChevronImg);
    }
}