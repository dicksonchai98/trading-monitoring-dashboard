export interface LoginRequest {
  user_id: string;
  password: string;
}

export interface RegisterRequest {
  user_id: string;
  email: string;
  password: string;
  verification_token: string;
}

export interface SendEmailOtpRequest {
  email: string;
}

export interface VerifyEmailOtpRequest {
  email: string;
  otp_code: string;
}

export interface VerifyEmailOtpResponse {
  verification_token: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}
