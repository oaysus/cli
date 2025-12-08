export interface Credentials {
  jwt: string;
  userId: string;
  email: string;
  websiteId: string;
  websiteName?: string;
  subdomain?: string;
  platforms: string[];
  expiresAt: string;
}

export interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
}

export interface Website {
  id: string;
  name: string;
  subdomain: string;
}

export interface DeviceStatusResponse {
  status: 'pending' | 'approved' | 'denied' | 'expired';
  needsWebsiteSelection?: boolean;
  websites?: Website[];
  jwt?: string;
  userId?: string;
  email?: string;
  websiteId?: string;
  websiteName?: string;
  subdomain?: string;
  platforms?: string[];
  expiresIn?: number;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode?: number;
}
