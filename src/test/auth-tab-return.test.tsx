import { useEffect } from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from '@/hooks/useAuth';

const mocks = vi.hoisted(() => ({ listener: undefined as undefined | ((event: string, session: unknown) => void), rpc: vi.fn(), session: { user: { id: 'admin-a' }, access_token: 'test-token' } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    getSession: async () => ({ data: { session: mocks.session } }),
  },
  rpc: mocks.rpc,
  from: () => ({ update: () => ({ eq: async () => ({}) }) }),
} }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

async function setup() {
  mocks.rpc.mockResolvedValue({ data: ['admin'], error: null });
  const mounted = vi.fn(); const unmounted = vi.fn();
  let state: ReturnType<typeof useAuth> | undefined;
  function ExportWindow() {
    useEffect(() => { mounted(); return () => { unmounted(); }; }, []);
    return null;
  }
  function ProtectedExport() {
    state = useAuth();
    return state.loading || !state.rolesLoaded || !state.isAdmin ? null : <ExportWindow />;
  }
  render(<AuthProvider><ProtectedExport /></AuthProvider>);
  await waitFor(() => expect(mounted).toHaveBeenCalledTimes(1));
  return { mounted, unmounted, state: () => state };
}

describe('tab-return authentication', () => {
  it.each(['SIGNED_IN', 'TOKEN_REFRESHED'])('keeps the export mounted during same-account %s checks', async event => {
    const ui = await setup();
    let resolve: ((value: unknown) => void) | undefined;
    mocks.rpc.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    await act(async () => { mocks.listener?.(event, mocks.session); await new Promise(r => setTimeout(r, 10)); });
    expect(ui.unmounted).not.toHaveBeenCalled();
    expect(ui.state()?.loading).toBe(false);
    await act(async () => { resolve?.({ data: ['admin'], error: null }); });
    expect(ui.mounted).toHaveBeenCalledTimes(1);
  });
  it('removes protected content on sign-out', async () => {
    const ui = await setup();
    await act(async () => { mocks.listener?.('SIGNED_OUT', null); await new Promise(r => setTimeout(r, 10)); });
    expect(ui.unmounted).toHaveBeenCalledTimes(1);
    expect(ui.state()?.user).toBeNull();
  });
  it('checks permissions afresh when the account changes', async () => {
    const ui = await setup();
    mocks.rpc.mockResolvedValueOnce({ data: ['judge'], error: null });
    await act(async () => { mocks.listener?.('SIGNED_IN', { user: { id: 'judge-b' } } as Session); await new Promise(r => setTimeout(r, 10)); });
    expect(ui.unmounted).toHaveBeenCalledTimes(1);
    expect(ui.state()?.isAdmin).toBe(false);
  });
  it('still removes access when the background role check revokes administrator permission', async () => {
    const ui = await setup();
    mocks.rpc.mockResolvedValueOnce({ data: [], error: null });
    await act(async () => { mocks.listener?.('TOKEN_REFRESHED', mocks.session); await new Promise(r => setTimeout(r, 10)); });
    expect(ui.state()?.isAdmin).toBe(false);
    expect(ui.unmounted).toHaveBeenCalledTimes(1);
  });
});