export const GET_ORDER_WITH_PRODUCT_TAGS = `
  query GetOrderWithProductTags($id: ID!) {
    order(id: $id) {
      id
      name
      tags
      note
      email
      customer {
        id
      }
      shippingAddress {
        firstName
        lastName
        company
        address1
        address2
        city
        province
        provinceCode
        country
        countryCodeV2
        zip
        phone
      }
      billingAddress {
        firstName
        lastName
        company
        address1
        address2
        city
        province
        provinceCode
        country
        countryCodeV2
        zip
        phone
      }
      totalShippingPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      totalDiscountsSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      shippingLines(first: 10) {
        nodes {
          title
          originalPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
        }
      }
      lineItems(first: 50) {
        nodes {
          id
          title
          quantity
          originalUnitPriceSet {
            shopMoney {
              amount
              currencyCode
            }
          }
          discountAllocations {
            allocatedAmountSet {
              shopMoney {
                amount
                currencyCode
              }
            }
          }
          variant {
            id
          }
          product {
            id
            tags
          }
        }
      }
    }
  }
`;

export const GET_ORDER_BY_NUMBER = `
  query GetOrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      nodes {
        id
        name
      }
    }
  }
`;
