import 'server-only';
import { createSupabaseAdminClient } from '@/lib/supabase-server';

/**
 * Writes into the panel's existing audit_logs table. Failures are swallowed by
 * the caller's console.warn so an audit hiccup never blocks an approved action.
 */
export async function writeAuditLog(args: {
  action: string;
  performedBy: string;
  targetId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from('audit_logs').insert({
      action: args.action,
      performed_by: args.performedBy,
      target_id: args.targetId,
      metadata: args.metadata || {},
    });
    if (error) console.warn('[audit] write failed:', error.message);
  } catch (err) {
    console.warn('[audit] write failed:', (err as Error).message);
  }
}
