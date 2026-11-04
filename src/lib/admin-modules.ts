import { NavigationTab } from '@/types';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve';

/** Lifecycle of a committee account as stored in committees.application_status. */
export type CommitteeStatus = 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DEACTIVATED';

export interface AdminModule {
  /** Stable key stored in committee_permissions.module_key. */
  key: string;
  label: string;
  /** Sidebar tabs unlocked by a VIEW grant on this module. */
  tabs: NavigationTab[];
  /** Actions the module actually supports — the matrix never shows the rest. */
  actions: PermissionAction[];
  /** Never assignable: reserved for Super Admin. */
  superAdminOnly?: boolean;
}

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
  approve: 'Approve',
};

export const ADMIN_MODULES: AdminModule[] = [
  { key: 'dashboard', label: 'Dashboard', tabs: ['dashboard'], actions: ['view'] },
  {
    key: 'events',
    label: 'Event Management',
    tabs: ['events'],
    actions: ['view', 'create', 'edit', 'delete'],
  },
  { key: 'parties', label: 'Opera Parties', tabs: ['parties'], actions: ['view', 'create', 'edit', 'delete'] },
  {
    key: 'tickets-types',
    label: 'Ticket Types & Pricing',
    tabs: ['tickets-types'],
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'seats',
    label: 'Seat Management',
    tabs: ['create-seat', 'diagram'],
    actions: ['view', 'create', 'edit', 'delete'],
  },
  {
    key: 'counter-booking',
    label: 'Counter Sales',
    tabs: ['counter-booking'],
    actions: ['view', 'create'],
  },
  {
    key: 'party-booking',
    label: 'Party Booking',
    tabs: ['party-booking'],
    actions: ['view', 'create', 'edit', 'approve'],
  },
  {
    key: 'booking-management',
    label: 'Booking Management',
    tabs: ['bookings', 'active-tickets', 'cancelled-tickets', 'cancellation-history', 'refunds'],
    actions: ['view', 'create', 'edit', 'delete', 'approve'],
  },
  { key: 'online-history', label: 'Online Bookings', tabs: ['online-history'], actions: ['view'] },
  { key: 'ticket-scanner', label: 'Ticket Scanner', tabs: ['tickets'], actions: ['view', 'approve'] },
  {
    key: 'scanner-members',
    label: 'Scanner Members',
    tabs: ['scanner-members', 'scan-history'],
    actions: ['view', 'create', 'edit', 'approve'],
  },
  { key: 'payments', label: 'Payments & Collections', tabs: ['payments'], actions: ['view'] },
  { key: 'customers', label: 'Customers', tabs: ['customers'], actions: ['view', 'edit'] },
  { key: 'reports', label: 'Reports', tabs: ['logs'], actions: ['view'] },
  {
    key: 'settings',
    label: 'Admin Settings',
    tabs: ['settings'],
    actions: ['view', 'edit'],
    superAdminOnly: true,
  },
  {
    key: 'committee-applications',
    label: 'Committee Applications',
    tabs: ['committee-applications'],
    actions: ['view', 'approve'],
    superAdminOnly: true,
  },
];

const MODULE_BY_KEY = new Map(ADMIN_MODULES.map((m) => [m.key, m]));

export function getModule(key: string): AdminModule | undefined {
  return MODULE_BY_KEY.get(key);
}

/** The module a sidebar tab belongs to. */
export function moduleForTab(tab: NavigationTab): AdminModule | undefined {
  return ADMIN_MODULES.find((m) => m.tabs.includes(tab));
}

/** Sidebar tabs a session may open; VIEW is the gate for every module. */
export function allowedTabs(isSuperAdmin: boolean, granted: string[]): Set<NavigationTab> {
  const tabs = new Set<NavigationTab>();
  ADMIN_MODULES.forEach((module) => {
    if (module.superAdminOnly) {
      if (isSuperAdmin) module.tabs.forEach((t) => tabs.add(t));
      return;
    }
    if (isSuperAdmin || granted.includes(module.key)) {
      module.tabs.forEach((t) => tabs.add(t));
    }
  });
  return tabs;
}
