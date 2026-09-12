package com.arun-sanu.leadweave.errors;

/** 403 Forbidden — the API key's role is insufficient for this endpoint. */
public class LeadWeaveForbiddenError extends LeadWeaveApiError {
    public LeadWeaveForbiddenError(String message, int status, Object body, String errorKind) {
        super(message, status, body, errorKind);
    }
}
