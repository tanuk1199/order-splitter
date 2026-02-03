export const ORDER_CANCEL = `
  mutation OrderCancel(
    $orderId: ID!
    $reason: OrderCancelReason!
    $restock: Boolean!
    $notifyCustomer: Boolean
    $staffNote: String
    $refundMethod: OrderCancelRefundMethodInput
  ) {
    orderCancel(
      orderId: $orderId
      reason: $reason
      restock: $restock
      notifyCustomer: $notifyCustomer
      staffNote: $staffNote
      refundMethod: $refundMethod
    ) {
      job {
        id
      }
      orderCancelUserErrors {
        field
        message
      }
    }
  }
`;

export const DRAFT_ORDER_CREATE = `
  mutation DraftOrderCreate($input: DraftOrderInput!) {
    draftOrderCreate(input: $input) {
      draftOrder {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const DRAFT_ORDER_COMPLETE = `
  mutation DraftOrderComplete($id: ID!) {
    draftOrderComplete(id: $id) {
      draftOrder {
        order {
          id
          name
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const TAGS_ADD = `
  mutation TagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const ORDER_UPDATE = `
  mutation OrderUpdate($input: OrderInput!) {
    orderUpdate(input: $input) {
      order {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;
