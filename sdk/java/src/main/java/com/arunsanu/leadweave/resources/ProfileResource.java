package com.arunsanu.leadweave.resources;

import static com.arunsanu.leadweave.http.Http.encodeSegment;

import com.arunsanu.leadweave.LeadWeaveClient;
import com.arunsanu.leadweave.http.HttpMethod;
import com.arunsanu.leadweave.model.SetProfileNameRequest;
import com.arunsanu.leadweave.model.SetProfilePictureRequest;
import com.arunsanu.leadweave.model.SetProfileStatusRequest;
import com.arunsanu.leadweave.model.SuccessResult;

/** Profile resource — the linked account's display name, status text and picture. */
public final class ProfileResource {
    private final LeadWeaveClient client;

    public ProfileResource(LeadWeaveClient client) {
        this.client = client;
    }

    /** Set the account display name. */
    public SuccessResult setProfileName(String sessionId, String name) {
        return client.request(
            HttpMethod.PUT,
            "/api/sessions/" + encodeSegment(sessionId) + "/profile/name",
            null,
            new SetProfileNameRequest(name),
            SuccessResult.class);
    }

    /** Set the account about/status text (an empty string clears it). */
    public SuccessResult setProfileStatus(String sessionId, String status) {
        return client.request(
            HttpMethod.PUT,
            "/api/sessions/" + encodeSegment(sessionId) + "/profile/status",
            null,
            new SetProfileStatusRequest(status),
            SuccessResult.class);
    }

    /** Set the account profile picture from a {@code url} or a {@code base64} + {@code mimetype} pair. */
    public SuccessResult setProfilePicture(String sessionId, SetProfilePictureRequest body) {
        return client.request(
            HttpMethod.PUT,
            "/api/sessions/" + encodeSegment(sessionId) + "/profile/picture",
            null,
            body,
            SuccessResult.class);
    }

    /** Remove the account profile picture. */
    public SuccessResult deleteProfilePicture(String sessionId) {
        return client.request(
            HttpMethod.DELETE,
            "/api/sessions/" + encodeSegment(sessionId) + "/profile/picture",
            null,
            null,
            SuccessResult.class);
    }
}
