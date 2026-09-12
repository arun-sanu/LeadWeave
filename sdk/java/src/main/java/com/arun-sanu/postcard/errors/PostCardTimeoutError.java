package com.arun-sanu.leadweave.errors;

/** Thrown when a request exceeds the configured timeout. */
public class LeadWeaveTimeoutError extends LeadWeaveError {
    public LeadWeaveTimeoutError(long timeoutMs) {
        super("Request timed out after " + timeoutMs + "ms");
    }
}
