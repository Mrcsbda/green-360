import type { LucideIcon } from 'lucide-react-native';
import { Bot, BriefcaseBusiness, LayoutDashboard, PieChart, Settings, Users } from 'lucide-react-native';

export interface MenuItem { href: string; label: string; icon: LucideIcon; wideHidden?: boolean }
export interface MenuSection { label: string; items: MenuItem[] }

/** Las 6 secciones del dashboard. El asistente vive en el panel derecho en pantallas amplias. */
export const MENU: MenuSection[] = [
  { label: 'General', items: [{ href: '/', label: 'Resumen de operaciones', icon: LayoutDashboard }] },
  {
    label: 'Clientes 360°',
    items: [
      { href: '/clientes', label: 'Directorio de clientes', icon: Users },
      { href: '/segmentacion', label: 'Segmentación y analítica', icon: PieChart },
      { href: '/asistente', label: 'Asistente IA', icon: Bot, wideHidden: true },
    ],
  },
  { label: 'Operaciones', items: [{ href: '/servicios', label: 'Servicios y operaciones', icon: BriefcaseBusiness }] },
  { label: 'Sistema', items: [{ href: '/configuracion', label: 'Configuración e importación', icon: Settings }] },
];

export const BREAKPOINTS = { tablet: 768, wide: 1280 };
