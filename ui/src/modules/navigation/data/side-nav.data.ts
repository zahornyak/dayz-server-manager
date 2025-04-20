import { SideNavItems, SideNavSection } from '../models';

export const sideNavSections: SideNavSection[] = [
    {
        text: 'CORE',
        items: ['dashboard'],
    },
    {
        text: 'DETAIL',
        items: [
            'system',
            'players',
            'audit',
            'logs',
            'settings',
            'backups',
            'maintenance',
            'map',
            'maploot',
        ],
    },
    {
        text: 'Files',
        items: [
            'types',
        ],
    },
];

export const sideNavItems: SideNavItems = {
    dashboard: {
        icon: 'tachometer-alt',
        text: 'Dashboard',
        link: '/dashboard',
    },
    system: {
        icon: 'chart-area',
        text: 'System',
        link: '/dashboard/system',
    },
    players: {
        icon: 'user',
        text: 'Players',
        link: '/dashboard/players',
    },
    audit: {
        icon: 'exclamation-triangle',
        text: 'Audit',
        link: '/dashboard/audit',
    },
    logs: {
        icon: 'clipboard-list',
        text: 'Logs',
        link: '/dashboard/logs',
    },
    settings: {
        icon: 'cogs',
        text: 'Settings',
        link: '/dashboard/settings',
    },
    backups: {
        icon: 'save',
        text: 'Backups',
        link: '/dashboard/backups',
    },
    maintenance: {
        icon: 'tools',
        text: 'Maintenance',
        link: '/dashboard/maintenance',
    },
    map: {
        icon: 'map',
        text: 'Map',
        link: '/dashboard/map',
    },
    maploot: {
        icon: 'map',
        text: 'MapLoot',
        link: '/dashboard/map/maploot',
    },
    types: {
        icon: 'wrench',
        text: 'Types',
        link: '/dashboard/files/types',
    },
};
