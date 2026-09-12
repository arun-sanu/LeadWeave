package com.arun-sanu.leadweave.errors;

/** 401 Unauthorized — missing or invalid API key. */
public class LeadWeaveAuthError extends LeadWeaveApiError {
    public LeadWeaveAuthError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
