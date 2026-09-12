package com.arun-sanu.leadweave.resources;

import static com.rmyndharis.leadweave.http.Http.encodeSegment;

import com.arun-sanu.leadweave.LeadWeaveClient;
import com.arun-sanu.leadweave.http.HttpMethod;
import com.arun-sanu.leadweave.model.CreateTemplateRequest;
import com.arun-sanu.leadweave.model.TemplateRecord;
import com.arun-sanu.leadweave.model.UpdateTemplateRequest;
import java.util.List;

/** Templates resource — stored message templates with {@code {{variable}}} placeholders. */
public final class TemplatesResource {
    private final LeadWeaveClient client;

    public TemplatesResource(LeadWeaveClient client) {
        this.client = client;
    }

    /** List all templates for a session. */
    public List<TemplateRecord> list(String sessionId) {
        return client.requestList(
            HttpMethod.GET,
            "/api/sessions/" + encodeSegment(sessionId) + "/templates",
            null,
            null,
            TemplateRecord.class);
    }

    /** Get a single template by id. */
    public TemplateRecord get(String sessionId, String id) {
        return client.request(
            HttpMethod.GET,
            "/api/sessions/" + encodeSegment(sessionId) + "/templates/" + encodeSegment(id),
            null,
            null,
            TemplateRecord.class);
    }

    /** Create a new template. */
    public TemplateRecord create(String sessionId, CreateTemplateRequest body) {
        return client.request(
            HttpMethod.POST,
            "/api/sessions/" + encodeSegment(sessionId) + "/templates",
            null,
            body,
            TemplateRecord.class);
    }

    /** Update a template. */
    public TemplateRecord update(String sessionId, String id, UpdateTemplateRequest body) {
        return client.request(
            HttpMethod.PUT,
            "/api/sessions/" + encodeSegment(sessionId) + "/templates/" + encodeSegment(id),
            null,
            body,
            TemplateRecord.class);
    }

    /** Delete a template. */
    public void delete(String sessionId, String id) {
        client.requestVoid(
            HttpMethod.DELETE,
            "/api/sessions/" + encodeSegment(sessionId) + "/templates/" + encodeSegment(id),
            null,
            null);
    }
}
