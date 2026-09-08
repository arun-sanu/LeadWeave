package com.rmyndharis.leadweave.errors;

/** 404 Not Found. */
public class LeadWeaveNotFoundError extends LeadWeaveApiError {
    public LeadWeaveNotFoundError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
