package com.arun-sanu.leadweave.errors;

/** 409 Conflict — typically an engine-not-ready condition from the backend. */
public class LeadWeaveConflictError extends LeadWeaveApiError {
    public LeadWeaveConflictError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
