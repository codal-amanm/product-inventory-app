import { useFetcher, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useEffect } from "react";
import { useAppBridge } from "@shopify/app-bridge-react";

export async function loader({ request }) {

    const { admin } = await authenticate.admin(request);

    const query = `#graphql
      query inventoryProducts($first: Int!) {
        products(first: $first) {
          edges {
            node {
              id
              title
              featuredImage { url }
              variants(first: 5) {
                edges {
                  node {
                    id
                    title
                    inventoryQuantity
                    inventoryItem { id tracked }
                  }
                }
              }
            }
          }
        }
        locations(first: 5) {
          edges {
            node { id name }
          }
        }
      }
    `;

    const response = await admin.graphql(query, { variables: { first: 50 } });
    const data = await response.json();
    console.log("Loader data:", data.data.locations.edges.map(e => e.node.id));
    if (data.errors) throw new Error(data.errors[0].message);

    const locationId = data.data.locations.edges[1]?.node.id;
    const products = data.data.products.edges.map(({ node }) => ({
      id: node.id,
      title: node.title,
      image: node.featuredImage?.url,
      variants: node.variants.edges.map((v) => ({
        id: v.node.id,
        title: v.node.title,
        qty: v.node.inventoryQuantity,
        inventoryItemId: v.node.inventoryItem?.id,
        tracked: v.node.inventoryItem?.tracked ?? false
      })),
    }));

    return { locationId, products, error: null };
}

export default function InventoryDashboard() {
  const { products, error, locationId } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  // Show toast after fetcher completes
  useEffect(() => {
    if (fetcher.data?.ok) {
      shopify.toast.show("Inventory updated");
    }
    if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const getStatus = (qty) => {
    if (qty === null || qty === undefined)
      return { label: "Not tracked", tone: "subdued" };
    if (qty <= 5) return { label: "Low", tone: "critical" };
    if (qty <= 20) return { label: "Medium", tone: "attention" };
    return { label: "High", tone: "success" };
  };

  if (error) {
    return (
      <s-page heading="Product Inventory">
        <s-banner tone="critical">
          <s-text>Error loading inventory: {error}</s-text>
        </s-banner>
      </s-page>
    );
  }

  if (products.length === 0) {
    return (
      <s-page heading="Product Inventory">
        <s-banner tone="info">
          <s-text>No products found in your store.</s-text>
        </s-banner>
      </s-page>
    );
  }

  return (
    <s-page heading="Product Inventory">
      <s-section padding="none">
        <s-table>
          <s-table-header-row>
            <s-table-header listSlot="primary">Product</s-table-header>
            <s-table-header>Variant</s-table-header>
            <s-table-header>Quantity</s-table-header>
            <s-table-header>Status</s-table-header>
          </s-table-header-row>

          <s-table-body>
            {products.map((p) =>
              p.variants.map((v) => {
                const status = getStatus(v.qty);
                const isUpdating =
                  fetcher.state !== "idle" &&
                  fetcher.formData?.get("variantId") === v.id;

                return (
                  <s-table-row key={v.id}>
                    <s-table-cell>
                      <s-stack direction="inline" gap="small">
                        <s-box
                          inlineSize="40px"
                          blockSize="40px"
                          borderRadius="base"
                          overflow="hidden"
                        >
                          {p.image ? (
                            <s-image src={p.image} objectFit="cover" />
                          ) : (
                            <s-icon type="image" />
                          )}
                        </s-box>
                        {p.title}
                      </s-stack>
                    </s-table-cell>

                    <s-table-cell>{v.title}</s-table-cell>

                    <s-table-cell>
                      <fetcher.Form method="post">
                        <input type="hidden" name="variantId" value={v.id} />
                        <input type="hidden" name="inventoryItemId" value={v.inventoryItemId} />
                        <input type="hidden" name="locationId" value={locationId} />
                        <input type="hidden" name="currentQty" value={v.qty ?? 0} />
                        <s-number-field
                          labelAccessibilityVisibility="exclusive"
                          label="Quantity"
                          name="quantity"
                          value={v.qty ?? 0}
                          step={1}
                          min={0}
                          disabled={isUpdating}
                          onChange={(e) => {
                            const form = e.target.closest("form");
                            fetcher.submit(form, { method: "post" });
                          }}
                        />
                      </fetcher.Form>
                    </s-table-cell>

                    <s-table-cell>
                      <s-badge tone={status.tone}>{status.label}</s-badge>
                    </s-table-cell>
                  </s-table-row>
                );
              })
            )}
          </s-table-body>
        </s-table>
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);

export async function action({ request }) {

    const { admin } = await authenticate.admin(request);

    const formData = await request.formData();
    const variantId = formData.get("variantId");
    const itemId = formData.get("inventoryItemId");
    const locationId = formData.get("locationId");
    const qty = Number(formData.get("quantity"));
    const currentQty = Number(formData.get("currentQty"));
    const delta = qty - currentQty;

    // If no change, do nothing
    if (delta === 0) {
      return { ok: true };
    }

    console.log("Updating:", { formData, variantId, itemId, qty, currentQty, delta });


    const mutation = `#graphql
      mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
        inventoryAdjustQuantities(input: $input) {
          userErrors { field message }
          inventoryAdjustmentGroup {
            createdAt
            reason
            referenceDocumentUri
            changes {
              name
              delta
            }
          }
        }
      }
    `;

    const response = await admin.graphql(mutation, {
      variables: {
        input: {
          reason: "other",
          name: "available",
          changes: [
            {
              inventoryItemId: itemId,
              locationId: locationId,
              delta,
            },
          ],
        },
      },
    });

    const data = await response.json();

    console.log("Mutation response:", data);
    const userErrors = data?.data?.inventoryAdjustQuantities?.userErrors;
    if (userErrors && userErrors.length > 0) {
      return { ok: false, error: userErrors[0].message };
    }

    return { ok: true };
}
