({
    getRecordCounts: function (component) {
        var action = component.get("c.getRecordCounts");

        action.setCallback(this, function (response) {
            var state = response.getState();
            if (state === "SUCCESS") {
                component.set("v.recordCounts", response.getReturnValue());
            } else {
                console.error("Error retrieving record counts:", response.getError());
            }
        });

        $A.enqueueAction(action);
    }
});