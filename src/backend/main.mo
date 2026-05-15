import Array "mo:core/Array";
import Text "mo:core/Text";
import List "mo:core/List";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import AccessControl "mo:caffeineai-authorization/access-control";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Time "mo:core/Time";
import Int "mo:core/Int";





persistent actor {
  type ScoreEntry = {
    playerName : Text;
    score : Nat;
    wave : Nat;
  };

  type PlayerProfile = {
    totalKills : Nat;
    totalRounds : Nat;
    totalHeadshots : Nat;
    totalShots : Nat;
    totalPoints : Nat;
    currentLevel : Nat;
    username : ?Text;
  };

  type SessionStats = {
    kills : Nat;
    headshots : Nat;
    shots : Nat;
    points : Nat;
  };

  module ScoreEntry {
    public func compare(entry1 : ScoreEntry, entry2 : ScoreEntry) : Order.Order {
      Nat.compare(entry2.score, entry1.score); // Higher scores first
    };
  };

  transient let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  transient let highScoresList = List.empty<ScoreEntry>();
  transient let profiles = Map.empty<Principal, PlayerProfile>();

  // ── Clan & Chat types ──────────────────────────────────────────────────

  type Clan = {
    id : Text;
    name : Text;
    tag : Text;
    description : Text;
    ownerPrincipal : Principal;
    members : [Principal];
    createdAt : Int;
    inviteCode : Text;
  };

  type ChatType = { #global; #clan : Text };

  type ChatMessage = {
    id : Text;
    authorPrincipal : Principal;
    authorUsername : Text;
    content : Text;
    timestamp : Int;
    chatType : ChatType;
  };

  // ── Clan & Chat state ────────────────────────────────────────────────────

  transient let clans = Map.empty<Text, Clan>();          // clanId → Clan
  transient let memberToClan = Map.empty<Principal, Text>(); // principal → clanId
  transient let globalMessages = List.empty<ChatMessage>();
  transient let clanMessages = Map.empty<Text, List.List<ChatMessage>>(); // clanId → messages
  transient let counters = { var nextId : Nat = 0 };

  func nextId() : Text {
    counters.nextId += 1;
    counters.nextId.toText();
  };

  func isValidTag(tag : Text) : Bool {
    let sz = tag.size();
    if (sz < 2 or sz > 5) { return false };
    var valid = true;
    for (c in tag.chars()) {
      if (not ((c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9'))) {
        valid := false;
      };
    };
    valid;
  };

  // ── Clan methods ─────────────────────────────────────────────────────────

  public shared ({ caller }) func createClan(name : Text, tag : Text, description : Text) : async { #ok : Clan; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized");
    };
    if (memberToClan.containsKey(caller)) {
      return #err("You are already in a clan");
    };
    if (clans.size() >= 50) {
      return #err("Maximum number of clans reached");
    };
    let nameSize = name.size();
    if (nameSize < 3 or nameSize > 30) {
      return #err("Clan name must be between 3 and 30 characters");
    };
    let upperTag = tag.toUpper();
    if (not isValidTag(upperTag)) {
      return #err("Tag must be 2–5 uppercase letters or digits");
    };
    let clanId = "clan-" # nextId();
    let inviteCode = "inv-" # nextId() # "-" # nextId();
    let newClan : Clan = {
      id = clanId;
      name;
      tag = upperTag;
      description;
      ownerPrincipal = caller;
      members = [caller];
      createdAt = Time.now();
      inviteCode;
    };
    clans.add(clanId, newClan);
    memberToClan.add(caller, clanId);
    #ok(newClan);
  };

  public shared ({ caller }) func joinClanByCode(inviteCode : Text) : async { #ok : Clan; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized");
    };
    if (memberToClan.containsKey(caller)) {
      return #err("You are already in a clan");
    };
    var found : ?(Text, Clan) = null;
    for ((cid, c) in clans.entries()) {
      if (c.inviteCode == inviteCode) { found := ?(cid, c) };
    };
    switch (found) {
      case (null) { #err("Invalid invite code") };
      case (?(clanId, clan)) {
        if (clan.members.size() >= 30) {
          return #err("Clan is full");
        };
        let updated : Clan = { clan with members = clan.members.concat([caller]) };
        clans.add(clanId, updated);
        memberToClan.add(caller, clanId);
        #ok(updated);
      };
    };
  };

  public shared ({ caller }) func leaveClan() : async { #ok; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized");
    };
    switch (memberToClan.get(caller)) {
      case (null) { #err("You are not in a clan") };
      case (?clanId) {
        switch (clans.get(clanId)) {
          case (null) {
            memberToClan.remove(caller);
            #ok;
          };
          case (?clan) {
            let remaining = clan.members.filter<Principal>(func(p : Principal) { not Principal.equal(p, caller) });
            if (remaining.size() == 0) {
              clans.remove(clanId);
              clanMessages.remove(clanId);
            } else {
              let newOwner = if (Principal.equal(clan.ownerPrincipal, caller)) { remaining[0] } else { clan.ownerPrincipal };
              clans.add(clanId, { clan with members = remaining; ownerPrincipal = newOwner });
            };
            memberToClan.remove(caller);
            #ok;
          };
        };
      };
    };
  };

  public query ({ caller }) func getMyClan() : async ?Clan {
    switch (memberToClan.get(caller)) {
      case (null) { null };
      case (?clanId) { clans.get(clanId) };
    };
  };

  public query func getClan(clanId : Text) : async ?Clan {
    clans.get(clanId);
  };

  public query func getAllClans() : async [Clan] {
    var result : [Clan] = [];
    for ((_, c) in clans.entries()) {
      result := result.concat<Clan>([c]);
    };
    result;
  };

  // ── Chat methods ──────────────────────────────────────────────────────────

  public shared ({ caller }) func sendGlobalMessage(content : Text) : async { #ok : ChatMessage; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized");
    };
    let contentSize = content.size();
    if (contentSize < 1 or contentSize > 200) {
      return #err("Message must be between 1 and 200 characters");
    };
    let authorUsername = switch (profiles.get(caller)) {
      case (?p) { switch (p.username) { case (?u) u; case (null) { return #err("Set a username first") } } };
      case (null) { return #err("Set a username first") };
    };
    let msg : ChatMessage = {
      id = "gm-" # nextId();
      authorPrincipal = caller;
      authorUsername;
      content;
      timestamp = Time.now();
      chatType = #global;
    };
    globalMessages.add(msg);
    if (globalMessages.size() > 100) {
      let keep = globalMessages.sliceToArray(globalMessages.size() - 100 : Int, globalMessages.size());
      globalMessages.clear();
      for (m in keep.values()) { globalMessages.add(m) };
    };
    #ok(msg);
  };

  public shared ({ caller }) func sendClanMessage(content : Text) : async { #ok : ChatMessage; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized");
    };
    let contentSize = content.size();
    if (contentSize < 1 or contentSize > 200) {
      return #err("Message must be between 1 and 200 characters");
    };
    let clanId = switch (memberToClan.get(caller)) {
      case (null) { return #err("You are not in a clan") };
      case (?id) { id };
    };
    let authorUsername = switch (profiles.get(caller)) {
      case (?p) { switch (p.username) { case (?u) u; case (null) { return #err("Set a username first") } } };
      case (null) { return #err("Set a username first") };
    };
    let msg : ChatMessage = {
      id = "cm-" # nextId();
      authorPrincipal = caller;
      authorUsername;
      content;
      timestamp = Time.now();
      chatType = #clan(clanId);
    };
    let msgs = switch (clanMessages.get(clanId)) {
      case (?existing) { existing };
      case (null) {
        let fresh = List.empty<ChatMessage>();
        clanMessages.add(clanId, fresh);
        fresh;
      };
    };
    msgs.add(msg);
    if (msgs.size() > 100) {
      let keep = msgs.sliceToArray(msgs.size() - 100 : Int, msgs.size());
      msgs.clear();
      for (m in keep.values()) { msgs.add(m) };
    };
    #ok(msg);
  };

  public query func getGlobalMessages() : async [ChatMessage] {
    let sz = globalMessages.size();
    if (sz <= 50) {
      globalMessages.toArray();
    } else {
      globalMessages.sliceToArray(sz - 50 : Int, sz);
    };
  };

  public query ({ caller }) func getClanMessages() : async { #ok : [ChatMessage]; #err : Text } {
    let clanId = switch (memberToClan.get(caller)) {
      case (null) { return #err("You are not in a clan") };
      case (?id) { id };
    };
    switch (clanMessages.get(clanId)) {
      case (null) { #ok([]) };
      case (?msgs) {
        let sz = msgs.size();
        if (sz <= 50) {
          #ok(msgs.toArray());
        } else {
          #ok(msgs.sliceToArray(sz - 50 : Int, sz));
        };
      };
    };
  };

  // ── XP thresholds ─────────────────────────────────────────────────────────

  transient let hardXPThresholds : [Nat] = [
    // 55 entries, extremely steep progression
    1000, // Level 1 to 2, 10x increase for slow initial progression
    3000, // Level 2 to 3, 3x per level
    9000, // Level 3 to 4
    27000, // Level 4 to 5
    81000, // Level 5 to 6
    243000, // Level 6 to 7
    729000, // Level 7 to 8
    2187000, // Level 8 to 9
    6560000, // Level 9 to 10
    19000000, // Level 10 to 11, increased to 19x of previous
    50000000, // Level 11 to 12
    100000000, // Level 12 to 13
    150000000, // Level 13 to 14
    210000000, // Level 14 to 15
    300000000, // Level 15 to 16
    500000000, // Level 16 to 17
    1000000000, // Level 17 to 18
    2000000000, // Level 18 to 19
    5000000000, // Level 19 to 20
    10000000000, // Level 20 to 21
    30000000000, // Level 21 to 22
    60000000000, // Level 22 to 23
    90000000000, // Level 23 to 24
    150000000000, // Level 24 to 25
    300000000000, // Level 25 to 26
    500000000000, // Level 26 to 27
    1000000000000, // Level 27 to 28
    1800000000000, // Level 28 to 29
    2500000000000, // Level 29 to 30
    4000000000000, // Level 30 to 31
    5700000000000, // Level 31 to 32
    7500000000000, // Level 32 to 33
    9000000000000, // Level 33 to 34
    12000000000000, // Level 34 to 35
    17000000000000, // Level 35 to 36
    23000000000000, // Level 36 to 37
    32000000000000, // Level 37 to 38
    40000000000000, // Level 38 to 39
    48000000000000, // Level 39 to 40
    57000000000000, // Level 40 to 41
    67000000000000, // Level 41 to 42
    80000000000000, // Level 42 to 43
    120000000000000, // Level 43 to 44
    200000000000000, // Level 44 to 45
    350000000000000, // Level 45 to 46
    500000000000000, // Level 46 to 47
    850000000000000, // Level 47 to 48
    1050000000000000, // Level 48 to 49
    1500000000000000, // Level 49 to 50
    3000000000000000, // Level 50 to 51
    5000000000000000, // Level 51 to 52
    10000000000000000, // Level 52 to 53
    30000000000000000, // Level 53 to 54
    80000000000000000, // Level 54 to 55
  ];

  public shared ({ caller }) func submitScore(score : Nat, wave : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authenticated users can submit scores!");
    };

    let callerProfile = profiles.get(caller);
    let playerName = switch (callerProfile) {
      case (?profile) {
        switch (profile.username) {
          case (?name) { name };
          case (null) { return }; // No username set — skip submission silently
        };
      };
      case (null) { return }; // No profile — skip submission silently
    };

    let newEntry : ScoreEntry = {
      playerName;
      score;
      wave;
    };
    highScoresList.add(newEntry);

    let scoresArray = highScoresList.toArray().sort();
    highScoresList.clear();
    let topScores = scoresArray.sliceToArray(0, Nat.min(scoresArray.size(), 10));
    for (entry in topScores.values()) {
      highScoresList.add(entry);
    };
  };

  public query func getHighScores() : async [ScoreEntry] {
    highScoresList.toArray();
  };

  // Users can only view their own profile; admins can view any profile
  public query ({ caller }) func getProfile(principal : Principal) : async ?PlayerProfile {
    if (caller != principal and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    profiles.get(principal);
  };

  // Users can only update their own profile; admins can update any profile
  public shared ({ caller }) func updateProfile(principal : Principal, sessionStats : SessionStats) : async PlayerProfile {
    if (caller != principal and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only update your own profile");
    };
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can update profiles");
    };

    let currentProfile = switch (profiles.get(principal)) {
      case (?profile) { profile };
      case (null) {
        {
          totalKills = 0;
          totalRounds = 0;
          totalHeadshots = 0;
          totalShots = 0;
          totalPoints = 0;
          currentLevel = 1;
          username = null;
        };
      };
    };

    let updatedProfile = {
      currentProfile with
      totalKills = currentProfile.totalKills + sessionStats.kills;
      totalRounds = currentProfile.totalRounds + 1;
      totalHeadshots = currentProfile.totalHeadshots + sessionStats.headshots;
      totalShots = currentProfile.totalShots + sessionStats.shots;
      totalPoints = currentProfile.totalPoints + sessionStats.points;
      currentLevel = calculateLevel(currentProfile.totalPoints + sessionStats.points);
    };

    profiles.add(principal, updatedProfile);
    updatedProfile;
  };

  // Only authenticated users can get or create their own profile
  public shared ({ caller }) func getOrCreateProfile() : async PlayerProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    switch (profiles.get(caller)) {
      case (?profile) { profile };
      case (null) {
        let newProfile = {
          totalKills = 0;
          totalRounds = 0;
          totalHeadshots = 0;
          totalShots = 0;
          totalPoints = 0;
          currentLevel = 1;
          username = null;
        };
        profiles.add(caller, newProfile);
        newProfile;
      };
    };
  };

  // Required by instructions: current user's profile
  public query ({ caller }) func getCallerUserProfile() : async ?PlayerProfile {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    profiles.get(caller);
  };

  // Save current user's profile
  public shared ({ caller }) func saveCallerUserProfile(profile : PlayerProfile) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    profiles.add(caller, profile);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?PlayerProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    profiles.get(user);
  };

  func calculateLevel(totalPoints : Nat) : Nat {
    func binarySearch(low : Nat, high : Nat) : Nat {
      if (low >= high) {
        return Nat.max(1, low + 1);
      };
      let mid = (low + high) / 2;
      if (totalPoints < hardXPThresholds[mid]) {
        binarySearch(low, mid);
      } else {
        binarySearch(mid + 1, high);
      };
    };
    Nat.min(binarySearch(0, hardXPThresholds.size()), 55);
  };

  func sanitizePlayerName(playerName : Text) : Text {
    let validChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_";
    var sanitizedName = "";

    for (char in playerName.chars()) {
      let charText = Text.fromChar(char);
      if (validChars.contains(#text charText)) {
        sanitizedName #= charText;
      };
    };
    sanitizedName;
  };

  public shared ({ caller }) func setUsername(username : Text) : async { #ok; #err : Text } {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      return #err("Unauthorized: Only authenticated users can set a username");
    };

    let size = username.size();
    if (size < 3 or size > 20) {
      return #err("Username must be between 3 and 20 characters");
    };

    let sanitized = sanitizePlayerName(username);
    if (sanitized != username or sanitized == "") {
      return #err("Username may only contain letters, digits, hyphens, and underscores");
    };

    let currentProfile = switch (profiles.get(caller)) {
      case (?profile) { profile };
      case (null) {
        {
          totalKills = 0;
          totalRounds = 0;
          totalHeadshots = 0;
          totalShots = 0;
          totalPoints = 0;
          currentLevel = 1;
          username = null;
        };
      };
    };

    switch (currentProfile.username) {
      case (?_) { return #err("Username is already set and cannot be changed") };
      case (null) {};
    };

    profiles.add(caller, { currentProfile with username = ?sanitized });
    #ok;
  };

  public query ({ caller }) func getUsername() : async ?Text {
    switch (profiles.get(caller)) {
      case (?profile) { profile.username };
      case (null) { null };
    };
  };
};
