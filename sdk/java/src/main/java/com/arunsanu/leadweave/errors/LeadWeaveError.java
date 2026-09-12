package com.arunsanu.leadweave.errors;

/** Base class for every error thrown by the SDK. */
public class LeadWeaveError extends RuntimeException {
    public LeadWeaveError(String message) {
        super(message);
    }
}
