package com.arunsanu.leadweave.resources;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.arunsanu.leadweave.ClientConfig;
import com.arunsanu.leadweave.LeadWeaveClient;
import com.arunsanu.leadweave.http.HttpMethod;
import com.arunsanu.leadweave.model.HealthReadyResponse;
import com.arunsanu.leadweave.model.HealthResponse;
import com.arunsanu.leadweave.support.MockTransport;
import org.junit.jupiter.api.Test;

class HealthResourceTest {
    final MockTransport tx = new MockTransport();
    final LeadWeaveClient client = new LeadWeaveClient(
        ClientConfig.builder().baseUrl("http://h").apiKey("k").transport(tx).build());

    @Test
    void checkHitsHealthRoot() {
        tx.respond(200, "{\"status\":\"ok\",\"version\":\"1.2.3\"}");
        HealthResponse res = client.health.check();
        assertEquals("http://h/api/health", tx.lastRequest().url());
        assertEquals(HttpMethod.GET, tx.lastRequest().method());
        assertEquals("1.2.3", res.version());
    }

    @Test
    void liveHitsLivePath() {
        tx.respond(200, "{\"status\":\"ok\"}");
        client.health.live();
        assertEquals("http://h/api/health/live", tx.lastRequest().url());
        assertEquals(HttpMethod.GET, tx.lastRequest().method());
    }

    @Test
    void readyHitsReadyPath() {
        tx.respond(200, "{\"status\":\"ok\",\"details\":{\"mainDatabase\":\"up\",\"dataDatabase\":\"up\"}}");
        HealthReadyResponse res = client.health.ready();
        assertEquals("http://h/api/health/ready", tx.lastRequest().url());
        assertEquals(HttpMethod.GET, tx.lastRequest().method());
        assertEquals("up", res.details().mainDatabase());
    }
}
