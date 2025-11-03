// DOCUMENTED BY SCRIPT - Phase 2
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { Webhook } from "svix";
import { WebhookEvent } from "@clerk/nextjs/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

http.route({
    path: "/lemon-squeezy-webhook",
    method: "POST",
    handler: httpAction(async (ctx, request) => {
        const payloadString = await request.text();
        const signature = request.headers.get("X-Signature");

        if (!signature) {
            return new Response("Missing X-Signature header", { status: 400 });
        }

        try {
            const payload = await ctx.runAction(internal.lemonSqueezy.verifyWebhook, {
                payload: payloadString,
                signature,
            });

            if (payload.meta.event_name === "order_created") {
                const { data } = payload;

                const { success } = await ctx.runMutation(api.users.upgradeToPro, {
                    email: data.attributes.user_email,
                    lemonSqueezyCustomerId: data.attributes.customer_id.toString(),
                    lemonSqueezyOrderId: data.id,
                    amount: data.attributes.total,
                });

                if (success) {
                    // Something
                }
            }

            return new Response("Webhook processed successfully", { status: 200 });
        } catch (error) {
            console.log("Webhook error:", error);
            return new Response("Error processing webhook", { status: 500 });
        }
    }),
});

http.route({
    path: "/clerk-webhook",
    method: "POST",

    handler: httpAction(async (context, request) => {
        const webHookSecret = process.env.CLERK_WEBHOOK_SECRET

        if (!webHookSecret) {
            throw new Error("CLERK_WEBHOOK_SECRET is not set");
        }

        const svix_id = request.headers.get("svix-id");
        const svix_signature = request.headers.get("svix-signature");
        const svix_timestamp = request.headers.get("svix-timestamp");

        if (!svix_id || !svix_signature || !svix_timestamp) {
            throw new Error("Missing svix headers");
        }

        const payload = await request.json();
        const body = JSON.stringify(payload);

        let wh = new Webhook(webHookSecret);

        let evt: WebhookEvent;

        try {
            evt = wh.verify(body, {
                "svix-id": svix_id,
                "svix-timestamp": svix_timestamp,
                "svix-signature": svix_signature,
            }) as WebhookEvent;
        } catch (err) {
            console.error("Error verifying webhook:", err);
            return new Response("Error occurred", { status: 400 });
        }

        const eventType = evt.type;

        if (eventType === "user.created") {
            const { id, email_addresses, first_name, last_name } = evt.data;

            const email = email_addresses[0].email_address;
            const name = `${first_name || ""} ${last_name || ""}`.trim();

            try {

                await context.runMutation(api.users.syncUser, {
                    userId: id,
                    email,
                    name
                })

            } catch (error: any) {
                return new Response(error.message, { status: 400 });
            }
        }

        return new Response("OK", { status: 200 });
    })
})

export default http;