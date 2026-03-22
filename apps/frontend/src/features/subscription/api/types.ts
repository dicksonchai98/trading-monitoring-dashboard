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
  stripe_price_id?: string | null;
  current_period_end?: string | null;
  entitlement_active?: boolean;
}

export interface BillingCheckoutResponse {
  checkout_url: string;
  session_id: string;
}

export interface CheckoutSessionStatusResponse {
  session_id: string;
  payment_status: string;
  is_paid: boolean;
}

export interface BillingPortalResponse {
  portal_url: string;
}
