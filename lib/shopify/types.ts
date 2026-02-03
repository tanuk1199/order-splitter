// --- Money ---

export interface MoneyV2 {
  amount: string;
  currencyCode: string;
}

export interface MoneyBag {
  shopMoney: MoneyV2;
}

// --- Address ---

export interface ShopifyAddress {
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  country: string | null;
  countryCodeV2: string | null;
  zip: string | null;
  phone: string | null;
}

// --- Product / Variant ---

export interface ShopifyProduct {
  id: string;
  tags: string[];
}

export interface ShopifyVariant {
  id: string;
}

// --- Line Item ---

export interface DiscountAllocation {
  allocatedAmountSet: MoneyBag;
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  quantity: number;
  originalUnitPriceSet: MoneyBag;
  discountAllocations: DiscountAllocation[];
  variant: ShopifyVariant | null;
  product: ShopifyProduct | null;
}

// --- Shipping ---

export interface ShopifyShippingLine {
  title: string;
  originalPriceSet: MoneyBag;
}

// --- Order ---

export interface ShopifyOrder {
  id: string;
  name: string;
  tags: string[];
  note: string | null;
  email: string | null;
  customer: { id: string } | null;
  shippingAddress: ShopifyAddress | null;
  billingAddress: ShopifyAddress | null;
  totalShippingPriceSet: MoneyBag;
  totalDiscountsSet: MoneyBag;
  shippingLines: {
    nodes: ShopifyShippingLine[];
  };
  lineItems: {
    nodes: ShopifyLineItem[];
  };
}

// --- Draft Order Input ---

export interface MailingAddressInput {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  address1?: string | null;
  address2?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
  countryCode?: string | null;
  zip?: string | null;
  phone?: string | null;
}

export interface DraftOrderLineItemInput {
  variantId: string;
  quantity: number;
}

export interface DraftOrderAppliedDiscountInput {
  title: string;
  value: number;
  valueType: "FIXED_AMOUNT" | "PERCENTAGE";
  description: string;
}

export interface ShippingLineInput {
  title: string;
  price: string;
}

export interface DraftOrderInput {
  customerId?: string;
  email?: string | null;
  note?: string;
  tags?: string[];
  shippingAddress?: MailingAddressInput;
  billingAddress?: MailingAddressInput;
  shippingLine?: ShippingLineInput;
  lineItems: DraftOrderLineItemInput[];
  appliedDiscount?: DraftOrderAppliedDiscountInput;
}

// --- Mutation Results ---

export interface UserError {
  field: string[] | null;
  message: string;
}

export interface OrderCancelResult {
  orderCancel: {
    job: { id: string } | null;
    orderCancelUserErrors: UserError[];
  };
}

export interface DraftOrderCreateResult {
  draftOrderCreate: {
    draftOrder: { id: string; name: string } | null;
    userErrors: UserError[];
  };
}

export interface DraftOrderCompleteResult {
  draftOrderComplete: {
    draftOrder: {
      order: { id: string; name: string } | null;
    } | null;
    userErrors: UserError[];
  };
}

export interface TagsAddResult {
  tagsAdd: {
    node: { id: string } | null;
    userErrors: UserError[];
  };
}

export interface OrderUpdateResult {
  orderUpdate: {
    order: { id: string } | null;
    userErrors: UserError[];
  };
}

// --- Query Results ---

export interface GetOrderResult {
  order: ShopifyOrder | null;
}

export interface GetOrderByNumberResult {
  orders: {
    nodes: Array<{ id: string; name: string }>;
  };
}
