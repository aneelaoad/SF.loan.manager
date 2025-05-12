/**
 * @description       : 
 * @author            : ChangeMeIn@UserSettingsUnder.SFDoc
 * @group             : 
 * @last modified on  : 05-08-2025
 * @last modified by  : ChangeMeIn@UserSettingsUnder.SFDoc
**/
public with sharing class NotesController {
    @AuraEnabled(cacheable=true)
    public static List<NoteWrapper> getNotes(Id recordId) {
        try {
            if (String.isBlank(recordId)) {
                throw new AuraHandledException('Record ID is required to fetch notes.');
            }

            List<NoteWrapper> results = new List<NoteWrapper>();
            for (Note__c note : [
                SELECT Id, Subject__c, Loan__c, Body__c, Owner.Name, OwnerId, CreatedDate, Role__c
                FROM Note__c
                WHERE Loan__c = :recordId
               
                ORDER BY CreatedDate DESC
            ]) {
                results.add(new NoteWrapper(note));
            }
            System.debug(LoggingLevel.DEBUG, 'Fetched notes for recordId ' + recordId + ': ' + results.size() + ' notes');
            return results;
        } catch (Exception e) {
            String errorMessage = 'Error fetching notes: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, errorMessage);
            throw new AuraHandledException(errorMessage);
        }
    }

    @AuraEnabled
    public static NoteWrapper createNote(Id recordId, String subject, String body, String role) {
    

        try {
            //  List<String> roles = role != null ? role.split(',') : new List<String>();
            System.debug('role: ' +role);

            List<String> roleList = role.split(',');
            String roleString = String.join(roleList, ';'); 
            
            System.debug('roleString: ' +roleString);

            
            if (String.isBlank(recordId)) {
                throw new AuraHandledException('Record ID is required to create a note.');
            }
            if (String.isBlank(subject)) {
                throw new AuraHandledException('Subject is required to create a note.');
            }

            Note__c note = new Note__c(
                Loan__c = recordId,
                Subject__c = subject,
                Body__c = body,
                Role__c = roleString
            );
            NoteService.createNotes(new List<Note__c>{note});

            Note__c createdNote = [
                SELECT Id, Subject__c, Body__c, Owner.Name, Role__c, Loan__c, OwnerId, CreatedDate 
                FROM Note__c 
                WHERE Id = :note.Id
                WITH SECURITY_ENFORCED
            ];
            NoteWrapper wrapper = new NoteWrapper(createdNote);
            System.debug(LoggingLevel.DEBUG, 'Created note for recordId ' + recordId + ': ' + wrapper);
            return wrapper;
        } catch (Exception e) {
            String errorMessage = 'Error creating note: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, errorMessage);
            throw new AuraHandledException(errorMessage);
        }
    }

    @AuraEnabled
    public static NoteWrapper updateNote(Id noteId, String subject, String body) {
        try {
            if (String.isBlank(noteId)) {
                throw new AuraHandledException('Note ID is required to update a note.');
            }
            if (String.isBlank(subject)) {
                throw new AuraHandledException('Subject is required to update a note.');
            }

            Note__c note = new Note__c(
                Id = noteId,
                Subject__c = subject,
                Body__c = body
            );
            NoteService.updateNotes(new List<Note__c>{note});

            Note__c updatedNote = [
                SELECT Id, Subject__c, Body__c, Owner.Name, Role__c, Loan__c, OwnerId, CreatedDate 
                FROM Note__c 
                WHERE Id = :noteId
                WITH SECURITY_ENFORCED
            ];
            NoteWrapper wrapper = new NoteWrapper(updatedNote);
            System.debug(LoggingLevel.DEBUG, 'Updated note with Id ' + noteId + ': ' + wrapper);
            return wrapper;
        } catch (Exception e) {
            String errorMessage = 'Error updating note: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, errorMessage);
            throw new AuraHandledException(errorMessage);
        }
    }

@AuraEnabled
public static void deleteNote(Id noteId) {
    Note__c noteToDelete = [SELECT Id FROM Note__c WHERE Id = :noteId LIMIT 1];
    delete noteToDelete;
}

    public class NoteWrapper {
        @AuraEnabled public String Id;
        @AuraEnabled public String Subject;
        @AuraEnabled public String Body;
        @AuraEnabled public String OwnerName;
        @AuraEnabled public String OwnerId;
        @AuraEnabled public DateTime CreatedDate;
        @AuraEnabled public String Role;
        @AuraEnabled public String Loan;

        public NoteWrapper(Note__c note) {
            Id = note.Id;
            Subject = note.Subject__c;
            Body = note.Body__c;
            OwnerName = note.Owner.Name;
            OwnerId = note.OwnerId;
            CreatedDate = note.CreatedDate;
            Role = note.Role__c;
            Loan = note.Loan__c;
        }
    }

 @AuraEnabled(cacheable=true)
    public static List<User> getActiveUsers() {
        // Query to fetch active users. You can add more filters as per your requirements.
        List<User> activeUsers = [
            SELECT Id, Name, Username, Email
            FROM User
            WHERE IsActive = TRUE
            ORDER BY Name
        ];
        return activeUsers;
    }

}