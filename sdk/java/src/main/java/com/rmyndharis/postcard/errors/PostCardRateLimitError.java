package com.rmyndharis.leadweave.errors;

/** 429 Too Many Requests — rate limited. */
public class LeadWeaveRateLimitError extends LeadWeaveApiError {
    public LeadWeaveRateLimitError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
