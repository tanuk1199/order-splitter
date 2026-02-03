import { CONFIG } from "../config";
import { getAccessToken } from "./token-store";

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export async function adminGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = getAccessToken();
  const endpoint = `https://${CONFIG.shopDomain}/admin/api/${CONFIG.apiVersion}/graphql.json`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}`
    );
  }

  const json: GraphQLResponse<T> = await response.json();

  if (json.errors?.length) {
    throw new Error(
      `Shopify GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`
    );
  }

  if (!json.data) {
    throw new Error("Shopify GraphQL response missing data");
  }

  return json.data;
}
