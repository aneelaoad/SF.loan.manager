public without sharing class CampaignController {
    
     public class MemberData {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String email;
        @AuraEnabled public String sObjectType;
    }

    public class GroupData {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public Boolean isActive;
        @AuraEnabled public String based;
        @AuraEnabled public List<MemberData> members;
    }
    

    
    @Auraenabled(cacheable=true)
    public static List<Campaign__c> getCampaigns(){
        
        List<Campaign__c> campagins=[SELECT Id, Name, Campaign_Name__c, Is_Active__c, Group__c, Group__r.Name, Last_Sent__c, Start_Date_Time__c FROM Campaign__c Order By CreatedDate DESC LIMIT 5];
        
        return campagins;
        
    }
    
    @Auraenabled(cacheable=true)
    public static List<Group__c> getGroups(){
        
        List<Group__c> campagins=[SELECT Id, Group_Display_Name__c, Is_Active__c, 	Based_On__c FROM Group__c Order By CreatedDate DESC LIMIT 6];
        
        return campagins;
        
    }
    
    
    @Auraenabled(cacheable=true)
    public static List<Cust_Campaign_Step__c> getCampaignSteps(String campaignId){
        
        List<Cust_Campaign_Step__c> steps=[SELECT Id, Name FROM Cust_Campaign_Step__c ORDER BY CreatedDate DESC LIMIT 4];
        
        return steps;
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Campaign__c> getCampaignsWithSteps() {
        return [
            SELECT Id,
                   Campaign_Name__c,
                   Start_Date_Time__c,
                   Is_Active__c,
                   Campaign_Type__c,
                   Events__c,
                   Group__r.Name,
                   (SELECT Id, Name, Cust_Type__c,	Cust_Step__c FROM Cust_Campaign_Steps__r)
            FROM Campaign__c ORDER BY CreatedDate DESC
        ];
    }
    
    @AuraEnabled(cacheable=true)
    public static List<Campaign__c> getCampaignsWithStepsByDate(Date startDateFrom, Date startDateTo) {
        String baseQuery = 'SELECT Id, Campaign_Name__c, Start_Date_Time__c, Campaign_Type__c, Events__c, Is_Active__c, Group__r.Name, '
                         + '(SELECT Id, Name, Cust_Type__c, Cust_Step__c FROM Cust_Campaign_Steps__r) '
                         + 'FROM Campaign__c';
        
        List<String> whereClauses = new List<String>();
        if (startDateFrom != null) {
            whereClauses.add('Start_Date_Time__c >= :startDateFrom');
        }
        if (startDateTo != null) {
            whereClauses.add('Start_Date_Time__c <= :startDateTo');
        }
    
        if (!whereClauses.isEmpty()) {
            baseQuery += ' WHERE ' + String.join(whereClauses, ' AND ');
        }
    
        baseQuery += ' ORDER BY CreatedDate DESC';
    
        return Database.query(baseQuery);
    }
    
    
    @AuraEnabled(cacheable=true)
    public static List<GroupData> getGroupsWithMembers() {
        
        List<Group__c> groups = [SELECT Id, Name, Based_On__c, Group_Display_Name__c, Is_Active__c FROM Group__c ORDER BY CreatedDate DESC];
        Map<String, GroupData> groupMap = new Map<String, GroupData>();
        
         for (Group__c g : groups) {
            GroupData gd = new GroupData();
            gd.id = g.Id;
            gd.name = g.Group_Display_Name__c;
            gd.based=g.Based_On__c;
            gd.isActive = g.Is_Active__c;
            gd.members = new List<MemberData>();
        
            groupMap.put(g.Id, gd);
        }
        
         List<Group_Member__c> groupMembers = [SELECT Id, Group__c, MemberId__c FROM Group_Member__c WHERE Group__c IN :groupMap.keySet()];
    Set<Id> allMemberIds = new Set<Id>();

    for (Group_Member__c gm : groupMembers) {
        allMemberIds.add(gm.MemberId__c);
    }
        
           Map<Id, sObject> allMembers = new Map<Id, sObject>();
    for (Lead l : [SELECT Id, Name, Email FROM Lead WHERE Id IN :allMemberIds]) allMembers.put(l.Id, l);
    for (Contact c : [SELECT Id, Name, Email FROM Contact WHERE Id IN :allMemberIds]) allMembers.put(c.Id, c);
    for (Account a : [SELECT Id, Name FROM Account WHERE Id IN :allMemberIds]) allMembers.put(a.Id, a);

    for (Group_Member__c gm : groupMembers) {
        sObject sobj = allMembers.get(gm.MemberId__c);
        if (sobj != null) {
            MemberData md = new MemberData();
            md.id = sobj.Id;
            md.name = (String)sobj.get('Name');
            md.email = sobj.getSObjectType() == Contact.SObjectType || sobj.getSObjectType() == Lead.SObjectType
                ? (String)sobj.get('Email') : null;
            md.sObjectType = String.valueOf(sobj.getSObjectType().getDescribe().getName());

            if (groupMap.containsKey(gm.Group__c)) {
                groupMap.get(gm.Group__c).members.add(md);
            }
        }
    }

    return new List<GroupData>(groupMap.values());

        
    }
    
    
    
    @AuraEnabled
    public static Boolean deleteCampaignEventBased(String CampaignID){
        Boolean status=false;
        try{
            
         String jobName = 'CampaignJob_'+CampaignID; 
        
        Campaign__c c = [SELECT Id FROM Campaign__c WHERE Id= : CampaignID];

        for (CronTrigger ct : [
            SELECT Id, CronJobDetail.Name 
            FROM CronTrigger 
            WHERE CronJobDetail.Name = :jobName
        ]) {
            System.abortJob(ct.Id);
            status=true;
            
        }
            
            delete c;
            system.debug('CAMPAIGN DELETED SUCCESSFULLY!');
            
        }catch(Exception e){
            status=false;
            system.debug('ERROR WHILE ABORTING JOB->'+ e);
        }
        
       
        
        
        
        
        
        
        return status;
    }

}