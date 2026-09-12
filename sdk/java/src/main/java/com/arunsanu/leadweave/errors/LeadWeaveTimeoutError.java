package com.arunsanu.leadweave.errors;

/** Thrown when a request exceeds the configured timeout. */
public class LeadWeaveTimeoutError extends LeadWeaveError {
    public LeadWeaveTimeoutError(long timeoutMs) {
        super("Request timed out after " + timeoutMs + "ms");
    }
}
