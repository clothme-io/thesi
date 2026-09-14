'use client';
import { useAuth } from '@/context/AuthProvider';
import { CreatorIntegrationsSettingsContent } from '@/components/settings/CreatorIntegrationsSettingsContent';
import { MerchantConnections } from '@/components/settings/MerchantConnections';
export default function IntegrationsSettingsPage() {
  const { session } = useAuth();
  if (!session) return null;
  return session.user.role === 'brand' ? <MerchantConnections /> : <CreatorIntegrationsSettingsContent />;
}
