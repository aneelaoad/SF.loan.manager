/**
 * @description       : Controller for managing folders and file attachments related to Loan, Lead, or User records.
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @last modified on  : 06-14-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class DocumentManagerController {

    /**
     * @description Retrieves all folders and their associated documents for a given record.
     * @param recordId The ID of the Loan, Lead, or User record.
     * @param objectName The API name of the object ('Lead', 'Opportunity', or 'User').
     * @param isExperienceSite Indicates if the context is an Experience Site user.
     * @return A list of folder wrappers, each containing folder details and documents.
     */
    @AuraEnabled(cacheable=true)
    public static List<FolderWrapper> getFolders(Id recordId, String objectName, Boolean isExperienceSite) {
        List<FolderWrapper> folderList = new List<FolderWrapper>();

        // Query all folders related to the given record
        String folderQuery = 'SELECT Id, Name FROM Folder__c WHERE ';
        if (isExperienceSite || objectName == 'User') {
            folderQuery += 'User__c = :recordId';
        } else if (objectName == 'Opportunity') {
            folderQuery += 'Loan__c = :recordId';
        } else if (objectName == 'Lead') {
            folderQuery += 'Lead__c = :recordId';
        } else {
            throw new AuraHandledException('Invalid object type. Must be Lead, Opportunity, or User.');
        }
        folderQuery += ' ORDER BY CreatedDate DESC';

        List<Folder__c> folders = Database.query(folderQuery);

        // Query document links for this record
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId, LinkedEntityId 
            FROM ContentDocumentLink 
            WHERE LinkedEntityId = :recordId
        ];

        // Collect all related ContentDocumentIds
        Set<Id> contentDocIds = new Set<Id>();
        for (ContentDocumentLink link : links) {
            contentDocIds.add(link.ContentDocumentId);
        }
        
        // Get latest versions of the related documents
        Map<Id, ContentVersion> latestVersions = new Map<Id, ContentVersion>();
        if (!contentDocIds.isEmpty()) {
            for (ContentVersion v : [
                SELECT Id, Title, FileType, VersionNumber, ContentDocumentId, CreatedDate, CreatedBy.Name, Folder__c
                FROM ContentVersion 
                WHERE IsLatest = TRUE AND ContentDocumentId IN :contentDocIds
            ]) {
                latestVersions.put(v.ContentDocumentId, v);
            }
        }

        // Group documents by folder
        for (Folder__c folder : folders) {
            FolderWrapper fw = new FolderWrapper();
            fw.id = folder.Id;
            fw.name = folder.Name;
            fw.documents = new List<DocumentFile>();

            // Loop through document links and attach matching versions
            for (ContentDocumentLink link : links) {
                ContentVersion version = latestVersions.get(link.ContentDocumentId);
                if (version != null && version.Folder__c == folder.Id) {
                    fw.documents.add(new DocumentFile(version, folder.Name));
                }
            }

            fw.count = fw.documents.size();
            folderList.add(fw);
        }

        // Add "All" folder for documents not associated with any folder
        FolderWrapper allFolder = new FolderWrapper();
        allFolder.id = 'other';
        allFolder.name = 'Other';
        allFolder.documents = new List<DocumentFile>();
        for (ContentDocumentLink link : links) {
            ContentVersion version = latestVersions.get(link.ContentDocumentId);
            if (version != null && version.Folder__c == null) {
                allFolder.documents.add(new DocumentFile(version, 'Other'));
            }
        }
        allFolder.count = allFolder.documents.size();
        folderList.add(allFolder);

        return folderList;
    }

    /**
     * @description Retrieves documents for a specific folder.
     * @param folderId The ID of the folder, or null for unassociated documents.
     * @param recordId The ID of the Loan, Lead, or User record.
     * @return A list of document wrappers.
     */
    @AuraEnabled
    public static List<DocumentFile> getDocumentsForFolder(Id folderId, Id recordId) {
        List<DocumentFile> documents = new List<DocumentFile>();

        // Query document links for this record
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId 
            FROM ContentDocumentLink 
            WHERE LinkedEntityId = :recordId
        ];

        // Collect ContentDocumentIds
        Set<Id> contentDocIds = new Set<Id>();
        for (ContentDocumentLink link : links) {
            contentDocIds.add(link.ContentDocumentId);
        }

        // Query ContentVersions for the folder
        String query = 'SELECT Id, Title, FileType, VersionNumber, ContentDocumentId, CreatedDate, CreatedBy.Name, Folder__c ' +
                       'FROM ContentVersion ' +
                       'WHERE IsLatest = TRUE AND ContentDocumentId IN :contentDocIds';

        // Handle the case where we want to get all documents (folderId is null or blank)
        if (folderId != null) {
            query += ' AND Folder__c = :folderId';
        } else {
            query += ' AND Folder__c = NULL';
        }

        List<ContentVersion> versions = Database.query(query);

        // Loop through versions and add them to the documents list
        for (ContentVersion v : versions) {
            // If folderId is not null, find the folder name; otherwise, set to 'Other'
            String folderName = folderId != null ? [SELECT Name FROM Folder__c WHERE Id = :folderId LIMIT 1].Name : 'Other';
            documents.add(new DocumentFile(v, folderName));
        }
        System.debug('documents: ' + documents);
        return documents;
    }

    /**
     * @description Deletes a ContentDocument.
     * @param contentDocumentId The ID of the ContentDocument to delete.
     */
    @AuraEnabled
    public static void deleteContentDocument(Id contentDocumentId) {
       try {
            delete [SELECT Id FROM ContentDocument WHERE Id = :contentDocumentId];
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting document: ' + e.getMessage());
        }
    }

    /**
     * @description Deletes a ContentDocumentLink for a specific record.
     * @param contentDocumentId The ID of the ContentDocument.
     * @param recordId The ID of the associated record.
     */
     @AuraEnabled
    public static void deleteDocumentLink(Id contentDocumentId, Id recordId) {
        try {
            List<ContentDocumentLink> linksToDelete = [
                SELECT Id, Visibility, ShareType 
                FROM ContentDocumentLink 
                WHERE ContentDocumentId = :contentDocumentId AND LinkedEntityId = :recordId
            ];

            if (linksToDelete.isEmpty()) {
                throw new AuraHandledException('No document link found for the specified document and record.');
            }

            // Check if the user has permission to delete the ContentDocumentLink
            if (!Schema.sObjectType.ContentDocumentLink.isDeletable()) {
                throw new AuraHandledException('User does not have permission to delete document links.');
            }

            // For Experience Site users, ensure they can only delete links with appropriate visibility
            Boolean isExperienceSite = Site.getSiteId() != null;
            for (ContentDocumentLink link : linksToDelete) {
                if (isExperienceSite && link.Visibility != 'AllUsers') {
                    throw new AuraHandledException('Cannot delete document link: Insufficient visibility access for Experience Site user.');
                }
            }

            delete linksToDelete;
        } catch (Exception e) {
            throw new AuraHandledException('Error deleting document link: ' + e.getMessage());
        }
    }

    /**
     * @description Returns the download URL for the latest version of a document.
     * @param contentDocumentId The ID of the ContentDocument.
     * @return The download URL as a string.
     */
    @AuraEnabled(cacheable=true)
    public static String getDownloadUrl(Id contentDocumentId) {
        ContentVersion version = [
            SELECT Id 
            FROM ContentVersion 
            WHERE IsLatest = TRUE AND ContentDocumentId = :contentDocumentId 
            LIMIT 1
        ];
        return '/sfc/servlet.shepherd/version/download/' + version.Id;
    }

    /**
     * @description Retrieves download URLs for all files in a specified folder.
     * @param folderId The ID of the folder, or null for unassociated documents.
     * @param recordId The ID of the Loan, Lead, or User record.
     * @return A list of download URLs for the latest versions of the documents.
     */
    @AuraEnabled(cacheable=true)
    public static List<String> getAllFilesDownloadUrls(Id folderId, Id recordId) {
        List<String> downloadUrls = new List<String>();

        // Query document links for this record
        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId 
            FROM ContentDocumentLink 
            WHERE LinkedEntityId = :recordId
        ];

        // Collect ContentDocumentIds
        Set<Id> contentDocIds = new Set<Id>();
        for (ContentDocumentLink link : links) {
            contentDocIds.add(link.ContentDocumentId);
        }

        // Query ContentVersions for the folder
        String query = 'SELECT Id ' +
                       'FROM ContentVersion ' +
                       'WHERE IsLatest = TRUE AND ContentDocumentId IN :contentDocIds';

        if (folderId != null) {
            query += ' AND Folder__c = :folderId';
        } else {
            query += ' AND Folder__c = NULL';
        }

        List<ContentVersion> versions = Database.query(query);

        // Generate download URLs
        for (ContentVersion version : versions) {
            downloadUrls.add('/sfc/servlet.shepherd/version/download/' + version.Id);
        }

        return downloadUrls;
    }

    /**
     * @description Creates a new folder and associates it with a Lead, Loan, or User record.
     * @param name The name of the folder.
     * @param recordId The associated record ID.
     * @param objectName Must be 'Lead', 'Opportunity', or 'User'.
     * @param isExperienceSite Indicates if the context is an Experience Site user.
     * @return The newly created Folder__c record.
     */
    @AuraEnabled
    public static Folder__c createFolder(String name, Id recordId, String objectName, Boolean isExperienceSite) {
        Folder__c folder = new Folder__c(Name = name);
System.debug('isExperienceSite:'+isExperienceSite);
System.debug('objectName:'+objectName);
        if (isExperienceSite || objectName == 'User') {
            folder.User__c = recordId;
        } else if (objectName == 'Opportunity') {
            folder.Loan__c = recordId;
        } else if (objectName == 'Lead') {
            folder.Lead__c = recordId;
        } else {
            throw new AuraHandledException('Invalid object type. Must be Lead, Opportunity, or User.');
        }

        insert folder;
System.debug('folder:'+folder);

        return folder;
    }

    /**
     * @description Associates an uploaded document with a record and folder.
     * @param contentDocumentId The ID of the ContentDocument.
     * @param status Optional document status.
     * @param recordId The Loan, Lead, or User record ID.
     * @param folderId The ID of the folder, or null if not specified.
     * @param objectName The API name of the object ('Lead', 'Opportunity', or 'User').
     * @param isExperienceSite Indicates if the context is an Experience Site user.
     */
    @AuraEnabled
    public static void handleFileUpload(Id contentDocumentId, String status, Id recordId, Id folderId, String objectName, Boolean isExperienceSite) {
        try {
            // Validate object type
            if (!(isExperienceSite || objectName == 'User' || objectName == 'Lead' || objectName == 'Opportunity')) {
                throw new AuraHandledException('Invalid object type. Must be Lead, Opportunity, or User.');
            }

            // Check if the ContentDocument is already linked to the record
            List<ContentDocumentLink> existingLinks = [
                SELECT Id, LinkedEntityId 
                FROM ContentDocumentLink 
                WHERE ContentDocumentId = :contentDocumentId 
                AND LinkedEntityId = :recordId
            ];

            if (existingLinks.isEmpty()) {
                // Create a new ContentDocumentLink only if it doesn't already exist
                ContentDocumentLink contentDocLink = new ContentDocumentLink();
                contentDocLink.ContentDocumentId = contentDocumentId;
                contentDocLink.LinkedEntityId = recordId;
                contentDocLink.ShareType = 'V';
                contentDocLink.Visibility = 'AllUsers';
                insert contentDocLink;
            }

            // Update the Folder__c reference on the ContentVersion record
            List<ContentVersion> contentVersions = [
                SELECT Id, Folder__c 
                FROM ContentVersion 
                WHERE ContentDocumentId = :contentDocumentId 
                LIMIT 1
            ];

            if (!contentVersions.isEmpty()) {
                ContentVersion contentVersion = contentVersions[0];
                contentVersion.Folder__c = folderId;
                update contentVersion;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error linking file to folder: ' + e.getMessage());
        }
    }

    /**
     * @description Updates the status of a document (not yet implemented).
     * @param contentVersionId The ID of the ContentVersion.
     * @param status The new status to apply.
     */
    @AuraEnabled
    public static void updateDocumentStatus(Id contentVersionId, String status) {
        ContentVersion version = [
            SELECT Id 
            FROM ContentVersion 
            WHERE Id = :contentVersionId
        ];
        // TODO: Update a related custom object like Document__c with the new status
    }

  

    /**
     * @description Wrapper for a folder and its associated documents.
     */
    public class FolderWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public Integer count;
        @AuraEnabled public List<DocumentFile> documents;
    }

    /**
     * @description Wrapper for a ContentVersion document with simplified display fields.
     */
    public class DocumentFile {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String fileType;
        @AuraEnabled public String versionNumber;
        @AuraEnabled public String createdDate;
        @AuraEnabled public String createdBy;
        @AuraEnabled public String folderName;
        @AuraEnabled public String contentDocumentId;

        public DocumentFile(ContentVersion v, String folderName) {
            this.id = v.Id;
            this.title = v.Title;
            this.fileType = v.FileType;
            this.versionNumber = String.valueOf(v.VersionNumber);
            this.createdDate = String.valueOf(v.CreatedDate);
            this.createdBy = v.CreatedBy != null ? v.CreatedBy.Name : '';
            this.folderName = folderName;
            this.contentDocumentId = v.ContentDocumentId;
        }
    }
}