import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { payload } = await authenticate.webhook(request);

  await prisma.product.delete({
    where: {
      shopifyProductId: BigInt(payload.id),
    },
  });

  return new Response(null, { status: 200 });
};
