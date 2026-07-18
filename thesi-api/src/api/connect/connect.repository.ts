export const CONNECT_REPOSITORY = Symbol('CONNECT_REPOSITORY');

export type ConnectUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  stripeConnectAccountId: string | null;
};

export interface ConnectRepository {
  getUser(userId: string): Promise<ConnectUser | null>;
  saveStripeConnectAccountId(
    userId: string,
    stripeConnectAccountId: string,
  ): Promise<void>;
}
