/**
 * @description       : Controller for managing folders and file attachments related to Loan or Lead records.
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @last modified on  : 06-11-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class DocumentManagerController {

    /**
     * @description Retrieves all folders and their associated documents for a given record.
     * @param recordId The ID of the Loan or Lead record.
     * @return A list of folder wrappers, each containing folder details and documents.
     */
    @AuraEnabled(cacheable=true)
    public static List<FolderWrapper> getFolders(Id recordId) {
        List<FolderWrapper> folderList = new List<FolderWrapper>();

        // Query all folders related to the given record
        List<Folder__c> folders = [
            SELECT Id, Name 
            FROM Folder__c 
            WHERE Loan__c = :recordId 
            ORDER BY CreatedDate DESC
        ];

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
        allFolder.id = 'all';
        allFolder.name = 'All';
        allFolder.documents = new List<DocumentFile>();
        for (ContentDocumentLink link : links) {
            ContentVersion version = latestVersions.get(link.ContentDocumentId);
            if (version != null && version.Folder__c == null) {
                allFolder.documents.add(new DocumentFile(version, 'All'));
            }
        }
        allFolder.count = allFolder.documents.size();
        folderList.add(allFolder);

        return folderList;
    }

    /**
     * @description Retrieves documents for a specific folder.
     * @param folderId The ID of the folder, or 'all' for unassociated documents.
     * @param recordId The ID of the Loan or Lead record.
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
        // If folderId is not null, find the folder name; otherwise, set to 'All'
        String folderName = folderId != null ? [SELECT Name FROM Folder__c WHERE Id = :folderId LIMIT 1].Name : 'All';

        documents.add(new DocumentFile(v, folderName));
    }
    System.Debug('documents: '+documents);
    return documents;
}


    /**
     * @description Creates a new folder and associates it with either a Lead or Loan record.
     * @param name The name of the folder.
     * @param recordId The associated record ID.
     * @param objectName Must be 'Lead' or 'Opportunity'.
     * @return The newly created Folder__c record.
     */
    @AuraEnabled
    public static Folder__c createFolder(String name, Id recordId, String objectName) {
        Folder__c folder = new Folder__c(Name = name);

        if (objectName == 'Lead') {
            folder.Lead__c = recordId;
        } else if (objectName == 'Opportunity') {
            folder.Loan__c = recordId;
        } else {
            throw new AuraHandledException('Invalid object type. Must be either Lead or Opportunity.');
        }

        insert folder;
        return folder;
    }

    /**
     * @description Associates an uploaded document with a record and folder.
     * @param contentDocumentId The ID of the ContentDocument.
     * @param status Optional document status.
     * @param recordId The Loan or Lead record ID.
     * @param folderId The ID of the folder, or null if not specified.
     */

     @AuraEnabled
    public static void handleFileUpload(Id contentDocumentId, String status, Id recordId, Id folderId) {
        try {
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
                contentDocLink.LinkedEntityId = recordId;  // Link it to the record (Loan, Lead, etc.)
                contentDocLink.ShareType = 'V';  // View access
                contentDocLink.Visibility = 'AllUsers';  // Visibility set to 'AllUsers'

                insert contentDocLink;
            }

            // Now update the Folder__c reference on the ContentVersion record
            List<ContentVersion> contentVersions = [SELECT Id, Folder__c FROM ContentVersion WHERE ContentDocumentId = :contentDocumentId LIMIT 1];

            if (!contentVersions.isEmpty()) {
                ContentVersion contentVersion = contentVersions[0];
                contentVersion.Folder__c = folderId;  // Assign the folder to this ContentVersion
                update contentVersion;
            }
        } catch (Exception e) {
            throw new AuraHandledException('Error linking file to folder: ' + e.getMessage());
        }
    }
    // @AuraEnabled
    // public static void handleFileUpload(Id contentDocumentId, String status, Id recordId, Id folderId) {
    //     // Create ContentDocumentLink
    //     List<ContentDocumentLink> existingLinks = [
    //         SELECT Id 
    //         FROM ContentDocumentLink 
    //         WHERE ContentDocumentId = :contentDocumentId AND LinkedEntityId = :recordId
    //     ];

    //     if (existingLinks.isEmpty()) {
    //         insert new ContentDocumentLink(
    //             ContentDocumentId = contentDocumentId,
    //             LinkedEntityId = recordId,
    //             ShareType = 'V',
    //             Visibility = 'AllUsers'
    //         );
    //     }

    //     // Update ContentVersion with folder association
    //     ContentVersion version = [
    //         SELECT Id, Folder__c 
    //         FROM ContentVersion 
    //         WHERE ContentDocumentId = :contentDocumentId AND IsLatest = TRUE
    //         LIMIT 1
    //     ];
    //     // if (folderId != null && folderId != 'all') {
    //     //     version.Folder__c = folderId;
    //     //     update version;
    //     // }
    // }

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

        public DocumentFile(ContentVersion v, String folderName) {
            this.id = v.Id;
            this.title = v.Title;
            this.fileType = v.FileType;
            this.versionNumber = String.valueOf(v.VersionNumber);
            this.createdDate = String.valueOf(v.CreatedDate);
            this.createdBy = v.CreatedBy != null ? v.CreatedBy.Name : '';
            this.folderName = folderName;
        }
    }
}