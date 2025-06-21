({
    doInit: function(component, event, helper) {
        console.log("Initializing component...");  // Log message to check if this is invoked
        // Call Apex method to get the community base URL on initialization
        var action = component.get("c.getCommunityUrl");
        action.setCallback(this, function(response) {
            var state = response.getState();
            console.log("Apex response state: " + state); // Log response state
            if (state === "SUCCESS") {
                var communityUrl = response.getReturnValue();
                console.log("Community URL: " + communityUrl); // Log the returned value
                if (communityUrl) {
                    component.set("v.communityUrl", communityUrl);
                } else {
                    console.error("Community URL not found in response");
                }
            } else if (state === "ERROR") {
                var errors = response.getError();
                if (errors && errors.length > 0) {
                    console.error("Error retrieving community URL: ", errors[0].message);
                } else {
                    console.error("Unknown error occurred while retrieving community URL");
                }
            }
        });
        $A.enqueueAction(action);
    },

    handleMenuSelect: function(component, event, helper) {
        // Get the community base URL and redirect to it
        var communityUrl = component.get("v.communityUrl");
        if (communityUrl) {
            console.log("Redirecting to: " + communityUrl + '/createrecord/NewLead');
            window.location.href = communityUrl + '/createrecord/NewLead';
        } else {
            console.error("Community URL not found");
        }
    },

    handleButtonClick: function(component, event, helper) {
        // Get the Flow name you want to invoke (for example, "Send_Newsletter_Flow")
        var flowName = "SocalEmailTest";

        // Create an instance of the flow
        var flow = component.find("flow");

        if (flow) {
            // Start the flow
            flow.startFlow(flowName);
            
            flow.stopFlow();

        } else {
            console.error("Flow component not found");
        }
    }
})