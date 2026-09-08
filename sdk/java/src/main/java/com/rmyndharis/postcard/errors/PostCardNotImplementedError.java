package com.rmyndharis.leadweave.errors;

/** 501 Not Implemented — the active engine does not support this operation. */
public class LeadWeaveNotImplementedError extends LeadWeaveApiError {
    public LeadWeaveNotImplementedError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
