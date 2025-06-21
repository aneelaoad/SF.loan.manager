({ 
    init: function(component, event, helper) {
        let action = component.get("c.getEmailAddresses");

        action.setParams({
            recordId: component.get("v.recordId")
        });

        action.setCallback(this, function(res){
            if (res.getState() === 'SUCCESS') {
                let response = res.getReturnValue();
                console.log(response);
                component.set("v.borrowerEmail", response.borrowerEmail);
                component.set("v.coBorrowerEmail", response.coBorrowerEmail);
                component.set("v.emailTemplateBody", response.emailTemplateBody);
                component.set("v.selectedTemplateName", response.emailTemplateName);
                component.set("v.emailSubjectLine", response.emailSubjectLine);
            }
        });

        $A.enqueueAction(action);
    },

    sendEmail: function(component, event, helper) {
        console.log('sendEmail');
        let areInputsValid = helper.validateUserInputs(component);
        console.log(areInputsValid);

        if (!areInputsValid) {
            return;
        }

        component.set("v.loading", true);
        let sendToBorrower = component.get("v.sendToBorrower");
        let sendToCoBorrower = component.get("v.sendToCoBorrower");
        let action = component.get("c.handleEmailNotification");

        action.setParams({
            sendToBorrower: sendToBorrower,
            sendToCoBorrower: sendToCoBorrower,
            additionalEmail: component.get("v.additionalEmail") != ' ' ? component.get("v.additionalEmail") : null,
            recordId: component.get("v.recordId"),
            emailTemplateBody: component.get("v.emailTemplateBody"),
            emailSubjectLine: component.get("v.emailSubjectLine")
        });

        action.setCallback(this, function(res) {
            component.set("v.loading", false);
            let state = res.getState();
            if (state === 'SUCCESS') {
                component.set("v.additionalEmail",' ');
                let dismissActionPanel = $A.get("e.force:closeQuickAction");
                dismissActionPanel.fire();
                helper.showToast();

                let closeEvent = component.getEvent("closeEvent");
                closeEvent.fire();
            } else {
                let errorMessage = res.getError();

                if (errorMessage[0] && errorMessage[0].message) {
                    helper.showToast(errorMessage[0].message);
                } else {
                    helper.showToast('There was an error...');
                }
            }
        });

        $A.enqueueAction(action);
    },
});