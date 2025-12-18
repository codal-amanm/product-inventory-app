import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);

  // Shopify product ID is a number → store as BigInt
  const productId = BigInt(payload.id);

  await prisma.product.upsert({
    where: {
      shopifyProductId: productId,
    },
    update: {
      title: payload.title,
      handle: payload.handle,
      vendor: payload.vendor,
      productType: payload.product_type,
      status: payload.status,
      updatedAt: new Date(payload.updated_at),
    },
    create: {
      shopifyProductId: productId,
      shop,
      title: payload.title,
      handle: payload.handle,
      vendor: payload.vendor,
      productType: payload.product_type,
      status: payload.status,
      createdAt: new Date(payload.created_at),
      updatedAt: new Date(payload.updated_at),
    },
  });

  return new Response(null, { status: 200 });
};
