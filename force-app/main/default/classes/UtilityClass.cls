/**
 * @description       : Utility class providing common methods including user context info.
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : Utilities
 * @last modified on  : 06-16-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class UtilityClass {

    /**
     * @description Wrapper for user context information.
     */
    public class UserContextWrapper {
        @AuraEnabled public Id userId;
        @AuraEnabled public Boolean isExperienceSite;
        @AuraEnabled public String objectName;
        @AuraEnabled public String profileName;
        @AuraEnabled public String userName;
    }

    /**
     * @description Retrieves the context for the current user, including Experience Site details.
     * @return A wrapper containing user context information.
     */
    @AuraEnabled(cacheable=true)
    public static UserContextWrapper getCurrentUserContext() {
        UserContextWrapper context = new UserContextWrapper();
        context.userId = UserInfo.getUserId();
        context.isExperienceSite = Site.getSiteId() != null;
        context.objectName = context.isExperienceSite ? 'User' : null;

        // Additional context information
        User currentUser = [SELECT Name, Profile.Name FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
        context.userName = currentUser.Name;
        context.profileName = currentUser.Profile.Name;
        System.Debug('context: '+context);
        return context;
    }

    /**
     * @description Logs a debug message with optional label.
     * @param label Optional label for grouping logs.
     * @param message The message to log.
     */
    public static void log(String label, String message) {
        System.debug(label + ' => ' + message);
    }

    /**
     * @description Checks if the running user has a specific profile name.
     * @param profileName The profile name to check.
     */
    public static Boolean isUserInProfile(String profileName) {
        User u = [SELECT Profile.Name FROM User WHERE Id = :UserInfo.getUserId()];
        return u.Profile.Name == profileName;
    }
    @AuraEnabled(cacheable=true)

    public static String getObjectNameFromId(Id recordId) {
        if (recordId == null) return null;

        // Get prefix (first 3 characters) of the record ID
        String keyPrefix = String.valueOf(recordId).substring(0, 3);

        // Use the Describe API to map the prefix to the object
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        for (Schema.SObjectType sobjectType : globalDescribe.values()) {
            Schema.DescribeSObjectResult describe = sobjectType.getDescribe();
            if (describe.getKeyPrefix() == keyPrefix) {
                System.Debug(describe.getName());
                return describe.getName(); // Return object API name
            }
        }

        return null; // If no match found
    }
}
