import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandWorkspaceSelector } from './BrandWorkspaceSelector';

const request = vi.hoisted(() => vi.fn());
vi.mock('@/context/AuthProvider', () => ({ useAuth: () => ({ session: { user: { id: 'owner', role: 'brand' } }, authenticatedRequest: request }) }));
const rows = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Original Brand', isDefault: true, role: 'owner', canCreate: true },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Second Brand', isDefault: false, role: 'owner', canCreate: false },
];
beforeEach(() => { request.mockReset(); sessionStorage.clear(); });
afterEach(cleanup);

describe('owner brand selector', () => {
  it('shows both brands and retains the selected brand after a page reload', async () => {
    sessionStorage.setItem('thesi_workspace:owner', rows[1].id);
    request.mockResolvedValueOnce(rows);
    render(<BrandWorkspaceSelector />);
    expect(await screen.findByRole('combobox', { name: 'Active brand' })).toHaveValue(rows[1].id);
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(request).toHaveBeenCalledWith('/api/brand-workspaces');
  });
  it('requires an explicit new choice when a saved brand becomes unavailable', async () => {
    sessionStorage.setItem('thesi_workspace:owner', rows[1].id);
    request.mockResolvedValueOnce([rows[0]]);
    render(<BrandWorkspaceSelector />);
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    expect(sessionStorage.getItem('thesi_workspace:owner')).toBe(rows[1].id);
  });
  it('reuses the creation key when a failed request is retried', async () => {
    request.mockResolvedValueOnce(rows).mockRejectedValue(new Error('Connection interrupted'));
    render(<BrandWorkspaceSelector />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add brand' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Brand name' }), { target: { value: 'New Brand' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create brand' }));
    await screen.findByText('Connection interrupted');
    fireEvent.click(screen.getByRole('button', { name: 'Create brand' }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(3));
    expect(request.mock.calls[1][1].body.creationKey).toBeTruthy();
    expect(request.mock.calls[1][1].body).toEqual(request.mock.calls[2][1].body);
  });
  it('hides creation when paused but retains brand selection', async () => {
    request.mockResolvedValueOnce(rows.map(row => ({ ...row, canCreate: false })));
    render(<BrandWorkspaceSelector />);
    await screen.findByRole('combobox', { name: 'Active brand' });
    expect(screen.queryByRole('button', { name: 'Add brand' })).not.toBeInTheDocument();
  });
});
