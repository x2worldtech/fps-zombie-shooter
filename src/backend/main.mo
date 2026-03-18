import Array "mo:core/Array";
import Text "mo:core/Text";
import List "mo:core/List";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Map "mo:core/Map";



actor {
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

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let highScoresList = List.empty<ScoreEntry>();
  let profiles = Map.empty<Principal, PlayerProfile>();

  let hardXPThresholds : [Nat] = [
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

  public shared ({ caller }) func submitScore(playerName : Text, score : Nat, wave : Nat) : async () {
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Unauthorized: Only authenticated users can submit scores!");
    };

    if (playerName.size() > 16) { Runtime.trap("Player name must not exceed 16 characters") };
    let sanitizedPlayerName = sanitizePlayerName(playerName);
    if (sanitizedPlayerName == "") {
      Runtime.trap("Player name cannot be empty after sanitization");
    };

    let newEntry : ScoreEntry = {
      playerName = sanitizedPlayerName;
      score;
      wave;
    };
    highScoresList.add(newEntry);

    // Convert to array and sort
    let scoresArray = highScoresList.toArray().sort();

    // Clear current list and add top 10
    highScoresList.clear();
    let topScores = scoresArray.sliceToArray(0, Nat.min(scoresArray.size(), 10));
    for (entry in topScores.values()) {
      highScoresList.add(entry);
    };
  };

  public query ({ caller }) func getHighScores() : async [ScoreEntry] {
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
        };
      };
    };

    let updatedProfile = {
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

    let charsIter = playerName.chars();
    var nextChar = charsIter.next();
    while (nextChar != null) {
      let char = switch (nextChar) {
        case (null) { return sanitizedName };
        case (?c) { c };
      };
      if (validChars.contains(#char char)) {
        sanitizedName #= char.toText();
      };
      nextChar := charsIter.next();
    };
    sanitizedName;
  };
};
