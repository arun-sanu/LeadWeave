package leadweave_test

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	leadweave "github.com/arun-sanu/LeadWeave/sdk/go"
)

func ExampleNew() {
	client, err := leadweave.New("http://localhost:2785", "owa_k1_…")
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	if _, err := client.Sessions.Start(ctx, "my-session"); err != nil {
		log.Fatal(err)
	}

	res, err := client.Messages.SendText(ctx, "my-session", leadweave.SendTextRequest{
		ChatID: "628123456789@c.us",
		Text:   "Hello from the LeadWeave Go SDK!",
	})
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(res.MessageID)
}

func ExampleClient_typedErrors() {
	client, _ := leadweave.New("http://localhost:2785", "owa_k1_…")

	_, err := client.Messages.SendText(context.Background(), "my-session", leadweave.SendTextRequest{
		ChatID: "628123456789@c.us",
		Text:   "hi",
	})
	switch {
	case errors.Is(err, leadweave.ErrConflict):
		// Engine not ready (409) — retry after the session reaches "ready".
	case errors.Is(err, leadweave.ErrNotFound):
		// Unknown session (404).
	case err != nil:
		var apiErr *leadweave.APIError
		if errors.As(err, &apiErr) {
			log.Printf("API %d: %s", apiErr.StatusCode, apiErr.Message)
		}
	}
}

func ExampleWithRetry() {
	// Opt into automatic retries with exponential backoff, and inject a custom
	// per-request timeout — dependencies flow through functional options.
	client, _ := leadweave.New("http://localhost:2785", "owa_k1_…",
		leadweave.WithRetry(leadweave.DefaultRetryPolicy()),
		leadweave.WithTimeout(15*time.Second),
	)
	_ = client
}

func ExampleClient_webhookEvents() {
	client, _ := leadweave.New("http://localhost:2785", "owa_k1_…")

	// Subscribe to the group and call events with the Event* constants — they
	// are the exact wire values, so a typo is a compile error, not a silent
	// no-delivery.
	_, err := client.Webhooks.Create(context.Background(), "my-session", leadweave.CreateWebhookRequest{
		URL: "https://example.com/hook",
		Events: []string{
			leadweave.EventGroupJoin,
			leadweave.EventGroupLeave,
			leadweave.EventGroupUpdate,
			leadweave.EventCallReceived,
		},
	})
	if err != nil {
		log.Fatal(err)
	}
}
