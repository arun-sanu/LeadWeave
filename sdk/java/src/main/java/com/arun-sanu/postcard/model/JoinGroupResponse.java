package com.arun-sanu.leadweave.model;

/** Returned when joining a group via an invite code — carries the joined group id. */
public record JoinGroupResponse(boolean success, String groupId) {}
