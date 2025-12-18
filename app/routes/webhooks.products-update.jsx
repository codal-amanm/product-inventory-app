import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  await prisma.product.update({
    where: {
      shopifyProductId: BigInt(payload.id),
    },
    data: {
      title: payload.title,
      status: payload.status,
      updatedAt: new Date(payload.updated_at),
    },
  });

  return new Response(null, { status: 200 });
};
