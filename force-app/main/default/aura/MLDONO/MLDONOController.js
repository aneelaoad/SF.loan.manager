({
    navigateToListView: function (component, event, helper) {
        // Retrieve the object name from the clicked tile's data-object attribute
        var objectName = event.currentTarget.dataset.object;

        // Navigate to the object's list view
        var navEvent = $A.get("e.force:navigateToList");
        navEvent.setParams({
            "listViewId": null,
            "listViewName": "All",
            "scope": objectName
        });
        navEvent.fire();
    }
});