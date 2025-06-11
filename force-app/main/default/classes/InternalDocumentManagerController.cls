/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 06-11-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class InternalDocumentManagerController {

    @AuraEnabled(cacheable=true)
    public static List<FolderWrapper> getFolders(Id recordId) {
        List<Folder__c> folders = [
            SELECT Id, Name, CreatedDate
            FROM Folder__c
            WHERE Lead__c = :recordId OR Loan__c = :recordId
            WITH SECURITY_ENFORCED
        ];
        System.debug('folders: ' + folders);

        List<FolderWrapper> folderWrappers = new List<FolderWrapper>();
        for (Folder__c folder : folders) {
            FolderWrapper fw = new FolderWrapper();
            fw.id = folder.Id;
            fw.name = folder.Name;
            fw.createdDate = String.valueOf(folder.CreatedDate);
            folderWrappers.add(fw);
        }

        return folderWrappers;
    }

    @AuraEnabled(cacheable=true)
    public static List<FileWrapper> getFiles(Id folderId) {
        List<ContentVersion> versions = [
            SELECT Id, Title, FileType, CreatedDate,
                ContentDocument.LatestPublishedVersion.PublishStatus
            FROM ContentVersion 
            WHERE ContentDocument.ParentId = :folderId
            WITH SECURITY_ENFORCED
            ORDER BY CreatedDate DESC
        ];

        List<FileWrapper> fileWrappers = new List<FileWrapper>();
        for (ContentVersion version : versions) {
            FileWrapper fw = new FileWrapper();
            fw.id = version.Id;
            fw.title = version.Title;
            fw.fileType = version.FileType;
            fw.createdDate = String.valueOf(version.CreatedDate);
            fw.publishStatus = version.ContentDocument != null && version.ContentDocument.LatestPublishedVersion != null 
                ? version.ContentDocument.LatestPublishedVersion.PublishStatus 
                : 'Unknown';
            fileWrappers.add(fw);
        }

        return fileWrappers;
    }

    @AuraEnabled
    public static FolderWrapper createFolder(Id recordId, String folderName) {
        Folder__c folder = new Folder__c(Name = folderName);

        if (Schema.sObjectType.Lead.isAccessible() && [SELECT Id FROM Lead WHERE Id = :recordId LIMIT 1].size() > 0) {
            folder.Lead__c = recordId;
        } else if (Schema.sObjectType.Opportunity.isAccessible() && [SELECT Id FROM Opportunity WHERE Id = :recordId LIMIT 1].size() > 0) {
            folder.Loan__c = recordId;
        } else {
            throw new AuraHandledException('Invalid record ID or insufficient permissions.');
        }

        insert folder;

        FolderWrapper wrapper = new FolderWrapper();
        wrapper.id = folder.Id;
        wrapper.name = folder.Name;
        wrapper.createdDate = String.valueOf(folder.CreatedDate);
        System.Debug(wrapper);
        return wrapper;
    }

    // Wrapper for folders
    public class FolderWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String createdDate;
    }

    // Wrapper for files
    public class FileWrapper {
        @AuraEnabled public String id;
        @AuraEnabled public String title;
        @AuraEnabled public String fileType;
        @AuraEnabled public String createdDate;
        @AuraEnabled public String publishStatus;
    }
}
