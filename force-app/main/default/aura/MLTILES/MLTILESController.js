({
    init: function (component, event, helper) {
        helper.getRecordCounts(component);
    },

    navigateToListView: function (component, event, helper) {
        var objectName = event.currentTarget.dataset.object;

        var navEvent = $A.get("e.force:navigateToList");
        navEvent.setParams({
            "listViewId": null,
            "listViewName": "All",
            "scope": objectName
        });
        navEvent.fire();
    }
});