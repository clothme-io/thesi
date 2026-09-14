import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MerchantLinkPage from './page';
const auth = vi.hoisted(() => ({
  session: { user: { id: 'owner', email: 'owner@example.test', role: 'brand', mustChangePassword: false } },
  authenticatedRequest: vi.fn(), signIn: vi.fn(), signUp: vi.fn(), signOut: vi.fn(), isLoading: false,
}));
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => auth }));
const workspaceId = '10000000-0000-4000-8000-000000000001';
beforeEach(() => {
  sessionStorage.clear(); history.replaceState(null, '', `/merchant-link#code=${'a'.repeat(43)}`);
  auth.authenticatedRequest.mockReset().mockImplementation(async (path: string) => {
    if (path === '/api/merchant-links/intent') return { vendorName: 'Vendor', brandName: 'Merchant Brand', action: 'link' };
    if (path === '/api/brand-workspaces') return [{ id: workspaceId, name: 'Thesi Brand', isDefault: true, canCreate: false }];
    throw new Error('Connection interrupted. Return to Merchant Hub.');
  });
});
afterEach(cleanup);
describe('Thesi side connection consent', () => {
  it('requires an explicit brand choice before approval and shows both sides', async () => {
    render(<MerchantLinkPage />);
    expect(await screen.findByText('Merchant Brand')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: 'Continue to Merchant Hub review' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Thesi brand to connect' }), { target: { value: workspaceId } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(auth.authenticatedRequest).toHaveBeenCalledWith('/api/merchant-links/approve', { method: 'POST', body: { code: 'a'.repeat(43), workspaceId } }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted');
  });
});
