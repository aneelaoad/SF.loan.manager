({
    doInit: function (component, event, helper) {
        // Use interval to repeatedly apply until modal is fully rendered and styles are stabilized
        const intervalId = setInterval(() => {
            const modalContainer = document.querySelector('.slds-modal__container');
            const modalContent = document.querySelector('.slds-modal__content');

            if (modalContainer) {
                modalContainer.style.maxWidth = '80vw';
                modalContainer.style.width = '1200px';
            }

            if (modalContent) {
                // Remove any existing inline style first
                modalContent.style.removeProperty('height');
                modalContent.style.removeProperty('max-height');

                // Force override using !important
                modalContent.style.setProperty('height', 'auto', 'important');
                modalContent.style.setProperty('max-height', 'unset', 'important');
            }
        }, 100);

        // Optional: stop the interval after a few seconds for performance
        setTimeout(() => clearInterval(intervalId), 3000);
    }
})