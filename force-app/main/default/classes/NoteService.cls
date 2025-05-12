public with sharing class NoteService {
    public static void createNotes(List<Note__c> notes) {
        if (notes == null || notes.isEmpty()) {
            throw new AuraHandledException('No notes provided to create.');
        }

        try {
            insert notes;
            System.debug(LoggingLevel.DEBUG, 'Successfully created ' + notes.size() + ' notes: ' + notes);
        } catch (DmlException e) {
            String errorMessage = 'Error creating notes: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, errorMessage);
            throw new AuraHandledException(errorMessage);
        }
    }

    public static void updateNotes(List<Note__c> notes) {
        if (notes == null || notes.isEmpty()) {
            throw new AuraHandledException('No notes provided to update.');
        }

        try {
            update notes;
            System.debug(LoggingLevel.DEBUG, 'Successfully updated ' + notes.size() + ' notes: ' + notes);
        } catch (DmlException e) {
            String errorMessage = 'Error updating notes: ' + e.getMessage();
            System.debug(LoggingLevel.ERROR, errorMessage);
            throw new AuraHandledException(errorMessage);
        }
    }
}