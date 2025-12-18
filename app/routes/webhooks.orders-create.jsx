import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, payload } =
    await authenticate.webhook(request);

  console.log("Webhook received:", topic, payload.id);

  return new Response(null, { status: 200 });
};
