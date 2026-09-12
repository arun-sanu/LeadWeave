import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  LayoutDashboard,
  MessageSquare,
  Smartphone,
  FileSpreadsheet,
  CalendarClock,
  ClipboardList,
  Webhook,
  Puzzle,
  Server,
  HardDrive,
  FileText,
  User,
  Users,
  Send,
  Building2,
  CornerDownLeft,
} from 'lucide-react';
import './CommandPalette.css';

interface PaletteItem {
  id: string;
  title: string;
  category: string;
  icon: typeof LayoutDashboard;
  to?: string;
  action?: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items: PaletteItem[] = useMemo(
    () => [
      { id: 'nav-dashboard', title: 'Dashboard Overview', category: 'Navigation', icon: LayoutDashboard, to: '/' },
      {
        id: 'nav-chats',
        title: 'WhatsApp Live Chats',
        category: 'Navigation',
        icon: MessageSquare,
        to: '/chats?tab=chats',
        keywords: ['messages', 'inbox'],
      },
      {
        id: 'nav-sessions',
        title: 'Sessions & Device Pairing',
        category: 'Navigation',
        icon: Smartphone,
        to: '/chats?tab=sessions',
        keywords: ['qr', 'connect', 'phone', 'instances'],
      },
      {
        id: 'nav-campaigns',
        title: 'Broadcast & Campaign Studio',
        category: 'Navigation',
        icon: FileSpreadsheet,
        to: '/campaigns',
        keywords: ['excel', 'bulk', 'outreach'],
      },
      {
        id: 'nav-noticeboard',
        title: 'Notice Board & Calendar',
        category: 'Navigation',
        icon: CalendarClock,
        to: '/notice-board',
        keywords: ['agenda', 'tasks', 'reminders', 'callback'],
      },
      {
        id: 'nav-templates',
        title: 'Message Templates',
        category: 'Navigation',
        icon: ClipboardList,
        to: '/templates',
        keywords: ['saved messages', 'snippets'],
      },
      {
        id: 'nav-webhooks',
        title: 'Webhooks & Integrations',
        category: 'Navigation',
        icon: Webhook,
        to: '/profile?tab=webhooks',
        keywords: ['api', 'events'],
      },
      {
        id: 'nav-plugins',
        title: 'Plugins & Engine Store',
        category: 'Navigation',
        icon: Puzzle,
        to: '/plugins',
        keywords: ['addons', 'wwebjs', 'baileys'],
      },
      {
        id: 'nav-storage',
        title: 'Storage & Data Allocation',
        category: 'Navigation',
        icon: HardDrive,
        to: '/storage',
        keywords: ['disk', 'files', 'media', 'database', 'sqlite', 's3', 'cache', 'quota'],
      },
      {
        id: 'nav-infra',
        title: 'Infrastructure & Database Status',
        category: 'Navigation',
        icon: Server,
        to: '/infrastructure',
        keywords: ['redis', 'postgres', 'backup'],
      },
      {
        id: 'nav-tester',
        title: 'Message Tester & Simulator',
        category: 'Navigation',
        icon: Send,
        to: '/message-tester',
        keywords: ['sandbox', 'test send'],
      },
      {
        id: 'nav-logs',
        title: 'System Logs & Telemetry',
        category: 'Navigation',
        icon: FileText,
        to: '/logs',
        keywords: ['debug', 'audit'],
      },
      {
        id: 'nav-profile',
        title: 'My Profile & Account',
        category: 'Navigation',
        icon: User,
        to: '/profile',
        keywords: ['settings', 'password'],
      },
      {
        id: 'nav-team',
        title: 'Team & Global Users',
        category: 'Navigation',
        icon: Users,
        to: '/profile?tab=team',
        keywords: ['members', 'roles'],
      },
      {
        id: 'nav-companies',
        title: 'Companies & Multi-Tenancy',
        category: 'Navigation',
        icon: Building2,
        to: '/companies',
        keywords: ['tenants', 'clients'],
      },
    ],
    [],
  );

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase().trim();
    return items.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords?.some(k => k.toLowerCase().includes(q)),
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSelect = (item: PaletteItem) => {
    onClose();
    if (item.to) {
      navigate(item.to);
    } else if (item.action) {
      item.action();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div
      className="command-palette-overlay"
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="command-palette-card" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div className="command-palette-search-box">
          <Search size={18} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Type a command or jump to page..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <span className="command-palette-kbd">ESC</span>
        </div>

        <div className="command-palette-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="command-palette-empty">No matching pages or actions found</div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`command-palette-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="command-palette-item-left">
                    <div className="command-palette-item-icon">
                      <Icon size={16} />
                    </div>
                    <span>{item.title}</span>
                  </div>
                  <span className="command-palette-item-shortcut">{item.category}</span>
                </button>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <div className="command-palette-footer-shortcuts">
            <span>
              <span className="command-palette-kbd">↑</span> <span className="command-palette-kbd">↓</span> to navigate
            </span>
            <span>
              <span className="command-palette-kbd">
                <CornerDownLeft size={10} style={{ display: 'inline' }} />
              </span>{' '}
              to select
            </span>
          </div>
          <span>LeadWeave Quick Navigator</span>
        </div>
      </div>
    </div>
  );
}
