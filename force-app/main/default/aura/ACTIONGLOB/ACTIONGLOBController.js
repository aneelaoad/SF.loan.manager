({
    openModal: function(component, event, helper) {
        var recordType = event.getSource().get("v.label"); // Get label as record type
        component.set("v.recordType", recordType);
        component.set("v.isOpen", true);
        component.set("v.newRecord", {});
    },
    
    closeModal: function(component, event, helper) {
        component.set("v.isOpen", false);
    },
    
    handleChange: function(component, event, helper) {
        var field = event.getSource().get("v.name");
        var value = event.getSource().get("v.value");
        var newRecord = component.get("v.newRecord");
        newRecord[field] = value;
        component.set("v.newRecord", newRecord);
    },
    
    createRecord: function(component, event, helper) {
        var action = component.get("c.saveRecord");
        action.setParams({
            recordData: component.get("v.newRecord"),
            recordType: component.get("v.recordType")
        });
        action.setCallback(this, function(response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                component.set("v.isOpen", false);
                $A.get("e.force:refreshView").fire();
            } else {
                console.error("Error saving record: ", response.getError());
            }
        });
        $A.enqueueAction(action);
    }
})