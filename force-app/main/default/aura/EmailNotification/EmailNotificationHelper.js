({
    showToast : function (errorMsg) {
        const toastEvent = $A.get("e.force:showToast");
        toastEvent.setParams({
            mode: 'dismissible',
            type : errorMsg ? 'error': 'success',
            message: errorMsg ? errorMsg : 'You have successfully sent the letter.',
            title : errorMsg ? 'Uh oh..' : 'Letter sent!'
        });
        toastEvent.fire();
    },

    validateUserInputs : function (component) {
        let allInputsValid = true;
        let recipientSelected = false;
        let recipients = component.find('recipient');
        let selects = component.find('select1');

        for (let i = 0; i < selects.length; i++) {
            if (!selects[i].checkValidity()) {
                selects[i].showHelpMessageIfInvalid();
                allInputsValid = false;
            }
        }

        for (let i = 0; i < recipients.length; i++) {
            if (recipients[i].get("v.checked") || recipients[i].get("v.value")) {
                recipientSelected = true;
                break;
            }
        }

        if (!recipientSelected) {
            component.set("v.isRecipientSelected", false);
        } else {
            component.set("v.isRecipientSelected", true);
        }

        return allInputsValid && recipientSelected;
    },
});