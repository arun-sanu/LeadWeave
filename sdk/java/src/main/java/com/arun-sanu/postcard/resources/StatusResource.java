package com.arun-sanu.leadweave.resources;

import static com.rmyndharis.leadweave.http.Http.encodeSegment;

import com.arun-sanu.leadweave.LeadWeaveClient;
import com.arun-sanu.leadweave.http.BinaryResponse;
import com.arun-sanu.leadweave.http.HttpMethod;
import com.arun-sanu.leadweave.model.SendImageStatusRequest;
import com.arun-sanu.leadweave.model.SendTextStatusRequest;
import com.arun-sanu.leadweave.model.SendVideoStatusRequest;
import com.arun-sanu.leadweave.model.SendVoiceStatusRequest;
import com.arun-sanu.leadweave.model.StatusListResult;
import com.arun-sanu.leadweave.model.StatusResult;

/**
 * Status (Stories) resource — WhatsApp status updates.
 *
 * <p>NOTE: this is WhatsApp "Status/Stories", distinct from session lifecycle status.
 */
public final class StatusResource {
    private final LeadWeaveClient client;

    public StatusResource(LeadWeaveClient client) {
        this.client = client;
    }

    /** Get all status updates. */
    public StatusListResult list(String sessionId) {
        return client.request(
            HttpMethod.GET,
            "/api/sessions/" + encodeSegment(sessionId) + "/status",
            null,
            null,
            StatusListResult.class);
    }

    /** Get status updates from a specific contact. */
    public StatusListResult fromContact(String sessionId, String contactId) {
        return client.request(
            HttpMethod.GET,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/" + encodeSegment(contactId),
            null,
            null,
            StatusListResult.class);
    }

    /** Fetch the stored media bytes for a status update (404 when there is no stored media). */
    public BinaryResponse media(String sessionId, String statusId) {
        return client.requestBytes(
            HttpMethod.GET,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/" + encodeSegment(statusId) + "/media",
            null);
    }

    /** Post a text status update. */
    public StatusResult sendText(String sessionId, SendTextStatusRequest body) {
        return client.request(
            HttpMethod.POST,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/send-text",
            null,
            body,
            StatusResult.class);
    }

    /** Post an image status update. */
    public StatusResult sendImage(String sessionId, SendImageStatusRequest body) {
        return client.request(
            HttpMethod.POST,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/send-image",
            null,
            body,
            StatusResult.class);
    }

    /** Post a video status update. */
    public StatusResult sendVideo(String sessionId, SendVideoStatusRequest body) {
        return client.request(
            HttpMethod.POST,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/send-video",
            null,
            body,
            StatusResult.class);
    }

    /**
     * Post an audio status as a voice note. WhatsApp plays one only as Ogg/Opus and neither engine
     * transcodes, so convert first with {@code MediaResource.convertVoice}. Requires an OPERATOR key.
     */
    public StatusResult sendVoice(String sessionId, SendVoiceStatusRequest body) {
        return client.request(
            HttpMethod.POST,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/send-voice",
            null,
            body,
            StatusResult.class);
    }

    /** Delete a status update by id. */
    public void delete(String sessionId, String statusId) {
        client.requestVoid(
            HttpMethod.DELETE,
            "/api/sessions/" + encodeSegment(sessionId) + "/status/" + encodeSegment(statusId),
            null,
            null);
    }
}
