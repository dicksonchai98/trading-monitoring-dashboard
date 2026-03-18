export interface BillingPlan {
  id: string;
  name: string;
  price: string;
}

export interface BillingPlansResponse {
  plans: BillingPlan[];
}

export interface BillingStatusResponse {
  status: string;
}

export interface BillingCheckoutResponse {
  checkout_url: string;
  session_id: string;
}
