import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  const productId = String(payload.id);

  await prisma.product.upsert({
    where: { shopifyProductId: productId },
    update: {
      ...(payload.title && { title: payload.title }),
      ...(payload.status && { status: payload.status }),
      updatedAt: new Date(),
    },
    create: {
      shopifyProductId: productId,
      title: payload.title ?? "",
      status: payload.status ?? "active",
      shop: payload.shop_domain ?? "",
      handle: payload.handle ?? "",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return new Response("OK", { status: 200 });
};
