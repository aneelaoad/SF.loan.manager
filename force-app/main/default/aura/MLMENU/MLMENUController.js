({
    navigateToListView: function (component, event, helper) {
        // Retrieve the object name from the clicked menu item's data-object attribute
        var objectName = event.currentTarget.dataset.object;

        // Navigate to the object's list view
        var navEvent = $A.get("e.force:navigateToList");
        navEvent.setParams({
            "listViewId": null, // Default to 'All'
            "listViewName": "All",
            "scope": objectName
        });
        navEvent.fire();
    }
});