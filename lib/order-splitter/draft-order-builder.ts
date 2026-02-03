import { CONFIG } from "../config";
import type {
  ShopifyOrder,
  ShopifyLineItem,
  ShopifyAddress,
  DraftOrderInput,
  MailingAddressInput,
} from "../shopify/types";

interface BuildParams {
  order: ShopifyOrder;
  lineItems: ShopifyLineItem[];
  label: "US" | "non-US";
  shipping: { title: string; price: string };
  discount: { value: number; title: string } | null;
}

export function buildDraftOrderInput(params: BuildParams): DraftOrderInput {
  const { order, lineItems, label, shipping, discount } = params;
  const orderNumber = order.name.replace("#", "");

  const input: DraftOrderInput = {
    customerId: order.customer?.id,
    email: order.email,
    note: [
      `Split order (${label} items) from original order ${order.name}.`,
      order.note ?? "",
    ]
      .filter(Boolean)
      .join(" "),
    tags: [
      CONFIG.splitOrderTag,
      `${CONFIG.splitFromPrefix}${orderNumber}`,
      label === "US" ? "us-fulfillment" : "non-us-fulfillment",
    ],
    shippingAddress: order.shippingAddress
      ? mapAddress(order.shippingAddress)
      : undefined,
    billingAddress: order.billingAddress
      ? mapAddress(order.billingAddress)
      : undefined,
    shippingLine: {
      title: shipping.title,
      price: shipping.price,
    },
    lineItems: lineItems
      .filter((item) => item.variant !== null)
      .map((item) => ({
        variantId: item.variant!.id,
        quantity: item.quantity,
      })),
  };

  if (discount) {
    input.appliedDiscount = {
      title: discount.title,
      value: discount.value,
      valueType: "FIXED_AMOUNT",
      description: `Proportional split of discount from ${order.name}`,
    };
  }

  return input;
}

function mapAddress(addr: ShopifyAddress): MailingAddressInput {
  return {
    firstName: addr.firstName,
    lastName: addr.lastName,
    company: addr.company,
    address1: addr.address1,
    address2: addr.address2,
    city: addr.city,
    province: addr.province,
    countryCode: addr.countryCodeV2,
    zip: addr.zip,
    phone: addr.phone,
  };
}
