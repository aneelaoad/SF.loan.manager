public with sharing class NotesController {

    // Mapping of object API names to Note__c lookup field names
    private static final Map<String, String> OBJECT_FIELD_MAP = new Map<String, String>{
        'Opportunity' => 'Loan__c',
        'Lead'        => 'Lead__c'
        // Add more object mappings as needed
    };

    private static String getLookupFieldForObject(String objectName) {
        if (!OBJECT_FIELD_MAP.containsKey(objectName)) {
            throw new AuraHandledException('Unsupported object: ' + objectName);
        }
        return OBJECT_FIELD_MAP.get(objectName);
    }

    // @AuraEnabled(cacheable=true)
    // public static List<NoteWrapper> getNotes(Id recordId, String objectName) {
    //     try {
    //         if (String.isBlank(recordId)) {
    //             throw new AuraHandledException('Record ID is required to fetch notes.');
    //         }

    //         // Dynamically determine the field name (Lead__c or Loan__c) based on objectName
    //         String fieldName = getLookupFieldForObject(objectName);
    //         System.Debug('fieldName: ' + fieldName);
            
    //         // Dynamically construct the query
    //         String query = 'SELECT Id, Subject__c, Body__c, Owner.Name, OwnerId, CreatedDate, Role__c, ' + fieldName + 
    //                        ' FROM Note__c WHERE ' + fieldName + ' = :recordId ORDER BY CreatedDate DESC';
    //         List<Note__c> notes = Database.query(query);

    //         List<NoteWrapper> results = new List<NoteWrapper>();
    //         for (Note__c note : notes) {
    //             results.add(new NoteWrapper(note));
    //         }
    //         return results;
    //     } catch (Exception e) {
    //         throw new AuraHandledException('Error fetching notes: ' + e.getMessage());
    //     }
    // }
    @AuraEnabled(cacheable=true)
public static List<NoteWrapper> getNotes(Id recordId, String objectName) {
    try {
        if (String.isBlank(recordId)) {
            throw new AuraHandledException('Record ID is required to fetch notes.');
        }

        // Dynamically determine the field name (Lead__c or Loan__c) based on objectName
        String fieldName = getLookupFieldForObject(objectName);
        System.debug('fieldName: ' + fieldName);

        // Dynamically construct the query
        // Ensure the relevant lookup field is included in the SELECT clause.
        // String query = 'SELECT Id, Subject__c, Body__c, Owner.Name, OwnerId, CreatedDate, Role__c, ' + fieldName + 
        //                ' FROM Note__c WHERE ' + fieldName + ' = :recordId ORDER BY CreatedDate DESC';
        String query = 'SELECT Id, Subject__c, Body__c, Owner.Name, OwnerId, CreatedDate, Role__c, Loan__c, Lead__c' + 
                       ' FROM Note__c WHERE ' + fieldName + ' = :recordId ORDER BY CreatedDate DESC';
        List<Note__c> notes = Database.query(query);

        // Prepare the result list
        List<NoteWrapper> results = new List<NoteWrapper>();
        for (Note__c note : notes) {
            results.add(new NoteWrapper(note));
        }

        return results;
    } catch (Exception e) {
        throw new AuraHandledException('Error fetching notes: ' + e.getMessage());
    }
}


    @AuraEnabled
    public static NoteWrapper createNote(Id recordId, String objectName, String subject, String body, String role) {
        try {
            if (String.isBlank(recordId)) {
                throw new AuraHandledException('Record ID is required to create a note.');
            }
            if (String.isBlank(subject)) {
                throw new AuraHandledException('Subject is required to create a note.');
            }

            // Determine the lookup field dynamically based on the object name (Lead or Opportunity)
            String fieldName = getLookupFieldForObject(objectName);

            List<String> roleList = String.isNotBlank(role) ? role.split(',') : new List<String>();
            String roleString = String.join(roleList, ';');

            // Create the new note object
            Note__c note = new Note__c(
                Subject__c = subject,
                Body__c = body,
                Role__c = roleString
            );

            // Dynamically assign the recordId to the correct lookup field (Lead__c or Loan__c)
            note.put(fieldName, recordId); // Dynamically assign the lookup field

            // Create the note in Salesforce
            NoteService.createNotes(new List<Note__c>{note});

            // Fetch the created note details
            Note__c createdNote = [
                SELECT Id, Subject__c, Body__c, Owner.Name, Role__c, Loan__c, Lead__c, OwnerId, CreatedDate 
                FROM Note__c 
                WHERE Id = :note.Id
                WITH SECURITY_ENFORCED
            ];

            return new NoteWrapper(createdNote);
        } catch (Exception e) {
            throw new AuraHandledException('Error creating note: ' + e.getMessage());
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
                SELECT Id, Subject__c, Body__c, Owner.Name, Role__c,Lead__c, Loan__c, OwnerId, CreatedDate 
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
        @AuraEnabled public String Loan; // Can be generalized to `ParentId` if needed

        public NoteWrapper(Note__c note) {
            Id = note.Id;
            Subject = note.Subject__c;
            Body = note.Body__c;
            OwnerName = note.Owner.Name;
            OwnerId = note.OwnerId;
            CreatedDate = note.CreatedDate;
            Role = note.Role__c;
            Loan = note.Loan__c != null ? String.valueOf(note.Loan__c) : note.Lead__c; // Extend if needed
        }
    }

    @AuraEnabled(cacheable=true)
    public static List<User> getActiveUsers() {
        // Query to fetch active users. You can add more filters as per your requirements.
        List<User> activeUsers = [
            SELECT Id, Name, Username, IsActive
            FROM User
            WHERE IsActive = TRUE
            ORDER BY Name
        ];
        return activeUsers;
    }


}