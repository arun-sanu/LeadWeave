package com.arunsanu.leadweave.model;

/** Readiness probe payload — checks both DB connections. {@code details} is {@code null} when absent. */
public record HealthReadyResponse(String status, HealthReadyDetails details) {}
