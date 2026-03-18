import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface SessionStats {
    shots: bigint;
    headshots: bigint;
    kills: bigint;
    points: bigint;
}
export interface ScoreEntry {
    wave: bigint;
    score: bigint;
    playerName: string;
}
export interface PlayerProfile {
    totalHeadshots: bigint;
    totalShots: bigint;
    totalRounds: bigint;
    currentLevel: bigint;
    totalPoints: bigint;
    totalKills: bigint;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<PlayerProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getHighScores(): Promise<Array<ScoreEntry>>;
    getOrCreateProfile(): Promise<PlayerProfile>;
    getProfile(principal: Principal): Promise<PlayerProfile | null>;
    getUserProfile(user: Principal): Promise<PlayerProfile | null>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: PlayerProfile): Promise<void>;
    submitScore(playerName: string, score: bigint, wave: bigint): Promise<void>;
    updateProfile(principal: Principal, sessionStats: SessionStats): Promise<PlayerProfile>;
}
