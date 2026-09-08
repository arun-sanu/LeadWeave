package com.rmyndharis.leadweave.resources;

import com.rmyndharis.leadweave.LeadWeaveClient;
import com.rmyndharis.leadweave.http.HttpMethod;
import com.rmyndharis.leadweave.model.HealthReadyResponse;
import com.rmyndharis.leadweave.model.HealthResponse;

/** Health resource — connectivity and readiness probes. */
public final class HealthResource {
    private final LeadWeaveClient client;

    public HealthResource(LeadWeaveClient client) {
        this.client = client;
    }

    /** General health (also returns the running version). */
    public HealthResponse check() {
        return client.request(HttpMethod.GET, "/api/health", null, null, HealthResponse.class);
    }

    /** Kubernetes liveness probe. */
    public HealthResponse live() {
        return client.request(HttpMethod.GET, "/api/health/live", null, null, HealthResponse.class);
    }

    /** Kubernetes readiness probe — checks both DB connections. */
    public HealthReadyResponse ready() {
        return client.request(HttpMethod.GET, "/api/health/ready", null, null, HealthReadyResponse.class);
    }
}
