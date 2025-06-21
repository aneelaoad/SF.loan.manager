({
    doInit : function(component, event, helper) {
        // Delay to ensure modal is rendered
        // 
        var modalContainer = document.querySelector('.slds-modal__container');
        setTimeout(()=>{
               if (modalContainer) {
                modalContainer.style.maxWidth = '90vw';
                modalContainer.style.width = '1500px';
            }

      
        }, 100)
       
    }
})