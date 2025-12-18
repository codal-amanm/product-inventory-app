import { authenticate } from "../shopify.server";
import db from "../db.server";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);

  console.log("SHOP INFO:", session);

  const shopRecord = await db.shop.upsert({
    where: { id: session.id },   // or `shop: session.shop` depending on your schema
    update: {
      shop: session.shop,
      // any other fields to update
    },
    create: {
      id: session.id,
      shop: session.shop,
      accessToken: session.accessToken,
      // any other required fields
    },
  });

  return shopRecord;
}
