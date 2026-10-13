import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import {
  ChevronDown, ChevronsLeft, Search, Moon, Sun, Menu as MenuIcon, LogOut, User, KeyRound, Globe, Plus, Sparkles, CornerDownLeft, UserRoundX, Settings,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { cn } from '@/lib/cn';
import { fullName, label } from '@/lib/format';
import Logo, { LogoMark } from '@/components/Logo';
import { Avatar, Button, ButtonLink, Kbd, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Sheet, Tip } from '@/components/ui';
import { adminMenu, userMenu, flatten } from './menus';
import { AnnouncementsProvider, AnnouncementBell, AnnouncementBanner } from '@/components/Announcements';

function isActive(pathname, to) { return pathname === to || pathname.startsWith(`${to}/`); }

function NavItem({ item, collapsed, pathname, onNavigate }) {
  const childActive = item.children?.some((c) => isActive(pathname, c.to));
  const [open, setOpen] = useState(childActive);
  useEffect(() => { if (childActive) setOpen(true); }, [childActive]);
  const Icon = item.icon;
  const base = 'group relative flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[13.5px] font-medium transition-colors cursor-pointer';

  if (item.children) {
    return (
      <div>
        <Tip content={collapsed ? item.label : null} side="right">
          <button type="button" onClick={() => setOpen(!open)} className={cn(base, childActive ? 'text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
            <Icon className={cn('size-[18px] shrink-0', childActive && 'text-primary')} />
            {!collapsed && <><span className="flex-1 truncate text-left">{item.label}</span><ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} /></>}
          </button>
        </Tip>
        <AnimatePresence initial={false}>
          {open && !collapsed && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }} className="overflow-hidden">
              <div className="relative ml-[22px] space-y-0.5 border-l border-border py-1 pl-3">
                {item.children.map((c) => {
                  const a = isActive(pathname, c.to);
                  return (
                    <Link key={c.to} to={c.to} onClick={onNavigate} className={cn('relative flex h-8 items-center rounded-lg px-3 text-[13px] transition-colors', a ? 'font-medium text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
                      {a && <motion.span layoutId="nav-sub" className="absolute top-1.5 bottom-1.5 -left-[13.5px] w-[3px] rounded-full bg-primary" />}
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
  const a = isActive(pathname, item.to);
  return (
    <Tip content={collapsed ? item.label : null} side="right">
      <Link to={item.to} onClick={onNavigate} className={cn(base, a ? 'text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground', collapsed && 'justify-center px-0')}>
        {a && <motion.span layoutId="nav-active" className="absolute inset-0 rounded-xl bg-primary-soft" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
        <Icon className="relative size-[18px] shrink-0" />
        {!collapsed && <span className="relative truncate">{item.label}</span>}
      </Link>
    </Tip>
  );
}

function SidebarContent({ menu, collapsed, pathname, user, sub, home, onNavigate, appName }) {
  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 shrink-0 items-center px-5', collapsed && 'justify-center px-0')}>
        <Link to={home} onClick={onNavigate}>{collapsed ? <LogoMark /> : <Logo name={appName} />}</Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {menu.map((g) => (
          <div key={g.group}>
            {!collapsed ? <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-muted-foreground/70 uppercase">{g.group}</p> : <div className="mx-auto mb-2 h-px w-6 bg-border" />}
            <div className="space-y-0.5">{g.items.map((it) => <NavItem key={it.label} item={it} collapsed={collapsed} pathname={pathname} onNavigate={onNavigate} />)}</div>
          </div>
        ))}
      </nav>
      {!collapsed && (
        <div className="p-3">
          {sub !== undefined ? (
            <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-violet-600 to-fuchsia-600 p-4 text-white">
              <div className="absolute -top-6 -right-6 size-24 rounded-full bg-white/15 blur-xl" />
              <Sparkles className="mb-2 size-5" />
              <p className="text-sm font-semibold">{sub?.plan?.name || 'No plan'} plan</p>
              <p className="mt-0.5 text-xs text-white/75">{sub ? `Renews ${new Date(sub.ends_at).toLocaleDateString()}` : 'Choose a plan to get started'}</p>
              <Link to="/user/plans" onClick={onNavigate} className="mt-3 inline-flex h-8 items-center rounded-lg bg-white px-3 text-xs font-semibold text-violet-700 transition hover:bg-white/90">Upgrade</Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-border p-3">
              <Avatar src={user.avatar} name={fullName(user)} size={36} />
              <div className="min-w-0"><p className="truncate text-sm font-medium">{fullName(user)}</p><p className="truncate text-xs text-muted-foreground">{label(user.role)}</p></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CommandPalette({ open, setOpen, items }) {
  const navigate = useNavigate();
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <D.Portal>
        <D.Overlay className="anim-overlay fixed inset-0 z-50 bg-zinc-950/40 backdrop-blur-sm" />
        <D.Content className="anim-dialog fixed top-[18%] left-1/2 z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          <D.Title className="sr-only">Search</D.Title><D.Description className="sr-only">Jump to a page</D.Description>
          <Command loop>
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-4 text-muted-foreground" />
              <Command.Input autoFocus placeholder="Jump to..." className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground" />
              <Kbd>ESC</Kbd>
            </div>
            <Command.List className="max-h-[360px] overflow-y-auto p-2">
              <Command.Empty className="py-10 text-center text-sm text-muted-foreground">No results found.</Command.Empty>
              {[...new Set(items.map((i) => i.group))].map((g) => (
                <Command.Group key={g} heading={g} className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:uppercase">
                  {items.filter((i) => i.group === g).map((i) => (
                    <Command.Item key={i.to} value={`${i.group} ${i.label}`} onSelect={() => { navigate(i.to); setOpen(false); }}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm data-[selected=true]:bg-primary-soft data-[selected=true]:text-primary">
                      <i.icon className="size-4" />{i.label}<CornerDownLeft className="ml-auto size-3.5 opacity-0 [[data-selected=true]_&]:opacity-60" />
                    </Command.Item>
                  ))}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export default function PortalLayout({ area }) {
  const { user, settings } = useAuth();
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('sidebar') === 'collapsed'; } catch { return false; } });
  const [mobile, setMobile] = useState(false);
  const [cmd, setCmd] = useState(false);
  const [sub, setSub] = useState(area === 'user' ? null : undefined);
  const menu = useMemo(() => (area === 'admin' ? adminMenu(user) : userMenu(user)), [area, user]);
  const items = useMemo(() => flatten(menu), [menu]);
  const home = area === 'admin' ? '/admin/dashboard' : '/user/dashboard';
  const appName = settings.app_name || 'NFC Profile';

  useEffect(() => { try { localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* ignore */ } }, [collapsed]);
  useEffect(() => { setMobile(false); window.scrollTo({ top: 0 }); }, [pathname]);
  useEffect(() => { if (area === 'user') api.get('/user/plans').then(({ data }) => setSub(data.current)).catch(() => {}); }, [area]);
  useEffect(() => {
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((o) => !o); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = items.find((i) => isActive(pathname, i.to));
  const logout = async () => { await api.post('/auth/logout'); window.location.href = '/login'; };
  const leave = async () => { await api.post('/auth/leave-impersonation'); window.location.href = '/admin/users'; };
  const sidebarProps = { menu, pathname, user, sub, home, appName };

  return (
    <AnnouncementsProvider>
    <div className="min-h-screen bg-background">
      {/* desktop sidebar */}
      <motion.aside initial={false} animate={{ width: collapsed ? 76 : 268 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-border bg-sidebar lg:block">
        <SidebarContent {...sidebarProps} collapsed={collapsed} />
        <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar"
          className="absolute top-5 -right-3 grid size-6 cursor-pointer place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-soft transition hover:text-foreground">
          <ChevronsLeft className={cn('size-3.5 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      </motion.aside>
      <Sheet open={mobile} onOpenChange={setMobile}><SidebarContent {...sidebarProps} collapsed={false} onNavigate={() => setMobile(false)} /></Sheet>

      <motion.div initial={false} animate={{ paddingLeft: collapsed ? 76 : 268 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="min-h-screen max-lg:!pl-0">
        {user.impersonating && (
          <div className="flex items-center justify-center gap-3 bg-linear-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-medium text-white">
            <UserRoundX className="size-4" /> You are viewing the portal as {fullName(user)}.
            <button onClick={leave} className="cursor-pointer rounded-lg bg-white/20 px-2.5 py-1 text-xs font-semibold hover:bg-white/30">Back to {user.impersonator?.name}</button>
          </div>
        )}
        {/* top bar */}
        <header className="glass sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border px-4 md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobile(true)} aria-label="Menu"><MenuIcon className="!size-5" /></Button>
          <div className="hidden min-w-0 md:block">
            <p className="text-xs text-muted-foreground">{current?.group || (area === 'admin' ? 'Admin' : 'Portal')}</p>
            <p className="truncate text-sm font-semibold">{current?.label || 'Overview'}</p>
          </div>
          <button type="button" onClick={() => setCmd(true)} className="ml-auto flex h-9 w-full max-w-xs cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/60 px-3 text-sm text-muted-foreground transition hover:border-primary/40 md:ml-8">
            <Search className="size-4" /><span className="flex-1 text-left">Search pages...</span><Kbd>Ctrl K</Kbd>
          </button>
          <div className="ml-auto flex items-center gap-1.5 md:ml-0">
            {area === 'user' && <ButtonLink as={Link} to="/user/vcards/create" size="sm" className="hidden sm:inline-flex"><Plus />New vCard</ButtonLink>}
            <AnnouncementBell />
            <Tip content="View website"><a href={`${settings.app_url || ''}/`} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground"><Globe className="size-[18px]" /></a></Tip>
            <Tip content={dark ? 'Light mode' : 'Dark mode'}>
              <button type="button" onClick={toggle} className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label="Toggle theme">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span key={dark ? 'd' : 'l'} initial={{ y: 16, rotate: -90, opacity: 0 }} animate={{ y: 0, rotate: 0, opacity: 1 }} exit={{ y: -16, rotate: 90, opacity: 0 }} transition={{ duration: 0.25 }}>
                    {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
                  </motion.span>
                </AnimatePresence>
              </button>
            </Tip>
            <Menu>
              <MenuTrigger asChild>
                <button type="button" className="ml-1 flex cursor-pointer items-center gap-2 rounded-xl p-1 pr-2 transition hover:bg-muted">
                  <Avatar src={user.avatar} name={fullName(user)} size={32} />
                  <span className="hidden text-left sm:block"><span className="block text-[13px] leading-tight font-semibold">{user.first_name}</span><span className="block text-[11px] leading-tight text-muted-foreground">{label(user.role)}</span></span>
                  <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" />
                </button>
              </MenuTrigger>
              <MenuContent>
                <MenuLabel>{user.email}</MenuLabel>
                <MenuSeparator />
                <MenuItem icon={User} onSelect={() => navigate(`/${area}/profile`)}>My profile</MenuItem>
                <MenuItem icon={KeyRound} onSelect={() => navigate(`/${area}/profile?tab=password`)}>Change password</MenuItem>
                {area === 'admin' && <MenuItem icon={Settings} onSelect={() => navigate('/admin/settings/general')}>Settings</MenuItem>}
                <MenuSeparator />
                <MenuItem icon={LogOut} danger onSelect={logout}>Sign out</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        </header>

        <main className="mx-auto max-w-[1440px] px-4 py-6 md:px-8 md:py-8">
          {/* enter-only page transition: the new page never waits for the old one to leave */}
          <motion.div key={pathname} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {pathname === home && <AnnouncementBanner />}
            <Outlet />
          </motion.div>
        </main>
        <footer className="px-4 pb-6 text-center text-xs text-muted-foreground md:px-8">© {new Date().getFullYear()} {appName}. All rights reserved.</footer>
      </motion.div>
      <CommandPalette open={cmd} setOpen={setCmd} items={items} />
    </div>
    </AnnouncementsProvider>
  );
}

export { NavLink };
