import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  const productId = String(payload.id);

  await prisma.product.deleteMany({
    where: { shopifyProductId: productId },
  });

  return new Response("OK", { status: 200 });
};
