export interface IRegisterPayload {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export interface ILoginPayload {
  email: string;
  password: string;
}

export interface IRefreshTokenPayload {
  refreshToken: string;
}

export interface IJwtTokenPayload {
  userId: string;
  email: string;
  role: string;
  tokenType: 'access' | 'refresh';
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ISafeUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: string;
  plan: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAuthResponse {
  user: ISafeUser;
  tokens: IAuthTokens;
}
