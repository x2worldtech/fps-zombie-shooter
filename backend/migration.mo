import Map "mo:core/Map";
import List "mo:core/List";
import Principal "mo:core/Principal";

module {
  public type PlayerProfile = {
    totalKills : Nat;
    totalRounds : Nat;
    totalHeadshots : Nat;
    totalShots : Nat;
    totalPoints : Nat;
    currentLevel : Nat;
  };

  public type ScoreEntry = {
    playerName : Text;
    score : Nat;
    wave : Nat;
  };

  public type OldActor = {
    highScoresList : List.List<ScoreEntry>;
    profiles : Map.Map<Principal, PlayerProfile>;
    xpThresholds : [Nat];
  };

  public type NewActor = {
    highScoresList : List.List<ScoreEntry>;
    profiles : Map.Map<Principal, PlayerProfile>;
    hardXPThresholds : [Nat];
  };

  public func run(old : OldActor) : NewActor {
    // Map old state to new state, discarding old xpThresholds
    {
      highScoresList = old.highScoresList;
      profiles = old.profiles;
      hardXPThresholds = [
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
    };
  };
};
