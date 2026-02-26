import Array "mo:core/Array";
import Text "mo:core/Text";
import List "mo:core/List";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";
import Map "mo:core/Map";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

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

  let xpThresholds : [Nat] = Array.tabulate<Nat>(55, func(i) { 100 + (i * (i + 1)) * 80 });

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

  // Get another user's profile (admin or self)
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
      if (totalPoints < xpThresholds[mid]) {
        binarySearch(low, mid);
      } else {
        binarySearch(mid + 1, high);
      };
    };
    Nat.min(binarySearch(0, xpThresholds.size()), 55);
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
