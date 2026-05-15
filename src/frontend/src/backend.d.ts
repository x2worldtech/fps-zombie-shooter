import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface Clan {
    id: string;
    tag: string;
    members: Array<Principal>;
    ownerPrincipal: Principal;
    name: string;
    createdAt: bigint;
    description: string;
    inviteCode: string;
}
export interface ScoreEntry {
    wave: bigint;
    score: bigint;
    playerName: string;
}
export type ChatType = {
    __kind__: "clan";
    clan: string;
} | {
    __kind__: "global";
    global: null;
};
export interface SessionStats {
    shots: bigint;
    headshots: bigint;
    kills: bigint;
    points: bigint;
}
export interface ChatMessage {
    id: string;
    authorUsername: string;
    content: string;
    timestamp: bigint;
    chatType: ChatType;
    authorPrincipal: Principal;
}
export interface PlayerProfile {
    username?: string;
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
    createClan(name: string, tag: string, description: string): Promise<{
        __kind__: "ok";
        ok: Clan;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getAllClans(): Promise<Array<Clan>>;
    getCallerUserProfile(): Promise<PlayerProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClan(clanId: string): Promise<Clan | null>;
    getClanMessages(): Promise<{
        __kind__: "ok";
        ok: Array<ChatMessage>;
    } | {
        __kind__: "err";
        err: string;
    }>;
    getGlobalMessages(): Promise<Array<ChatMessage>>;
    getHighScores(): Promise<Array<ScoreEntry>>;
    getMyClan(): Promise<Clan | null>;
    getOrCreateProfile(): Promise<PlayerProfile>;
    getProfile(principal: Principal): Promise<PlayerProfile | null>;
    getUserProfile(user: Principal): Promise<PlayerProfile | null>;
    getUsername(): Promise<string | null>;
    isCallerAdmin(): Promise<boolean>;
    joinClanByCode(inviteCode: string): Promise<{
        __kind__: "ok";
        ok: Clan;
    } | {
        __kind__: "err";
        err: string;
    }>;
    leaveClan(): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    saveCallerUserProfile(profile: PlayerProfile): Promise<void>;
    sendClanMessage(content: string): Promise<{
        __kind__: "ok";
        ok: ChatMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    sendGlobalMessage(content: string): Promise<{
        __kind__: "ok";
        ok: ChatMessage;
    } | {
        __kind__: "err";
        err: string;
    }>;
    setUsername(username: string): Promise<{
        __kind__: "ok";
        ok: null;
    } | {
        __kind__: "err";
        err: string;
    }>;
    submitScore(score: bigint, wave: bigint): Promise<void>;
    updateProfile(principal: Principal, sessionStats: SessionStats): Promise<PlayerProfile>;
}
