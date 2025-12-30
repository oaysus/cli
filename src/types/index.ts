export interface Credentials {
  jwt: string;
  userId: string;
  email: string;
  websiteId: string;
  websiteName?: string;
  subdomain?: string;
  customDomain?: string;
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
  customDomain?: string;
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
  customDomain?: string;
  platforms?: string[];
  expiresIn?: number;
  message?: string;
}

export interface ApiError {
  error: string;
  statusCode?: number;
}

export interface ThemePack {
  id: string;
  name: string;
  displayName: string;
  version: string;
  componentCount: number;
  installationCount: number;
  r2_base_path?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ThemePackListResponse {
  success: boolean;
  themePacks: ThemePack[];
  error?: string;
}

export interface ThemePackDeleteResponse {
  success: boolean;
  message?: string;
  deletedId?: string;
  error?: string;
  activeInstallations?: number;
}
