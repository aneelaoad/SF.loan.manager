({
    doInit: function (component, event, helper) {
        var redirectUrl = component.get("v.redirectUrl");
        
        if (redirectUrl) {
            window.location.href = redirectUrl;
        }
    }
})