'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarClock, Menu, Moon, X } from 'lucide-react';
import { Tooltip } from './Tooltip';
import { DatabaseStatusBadge } from './DatabaseStatusBadge';

export function AppNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const linkClass = (href: string) => {
    const isActive = href === '/' ? pathname === '/' : pathname?.startsWith(href);
    return 'nav-link' + (isActive ? ' active' : '');
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem('railsync-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const useDarkTheme = savedTheme ? savedTheme === 'dark' : prefersDark;
    document.documentElement.dataset.theme = useDarkTheme ? 'dark' : 'light';
  }, []);

  const toggleTheme = () => {
    const nextIsDark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = nextIsDark ? 'dark' : 'light';
    localStorage.setItem('railsync-theme', nextIsDark ? 'dark' : 'light');
  };

  return (
    <>
      <header className="app-nav">
        <Link href="/" className="nav-wordmark">
          <span className="nav-mark" aria-hidden="true"><CalendarClock size={17} /></span>
          <span>RAILSYNC</span>
        </Link>
        <nav className="nav-links">
          <Link href="/" className={linkClass('/')}>Dashboard</Link>
          <Link href="/schedule" className={linkClass('/schedule')}>Schedule</Link>
          <Link href="/database" className={linkClass('/database')}>Database Studio</Link>
          <Link href="/upload" className={linkClass('/upload')}>Upload & Optimize</Link>
        </nav>
        <div className="nav-right">
          <DatabaseStatusBadge />
          <div className="nav-status" aria-label="Current planning status">
            <span className="nav-status-dot" aria-hidden="true" />
            <span>Planning desk online</span>
          </div>
          <Tooltip title="Change theme">
            <button
              className="theme-toggle btn btn--ghost btn--icon"
              type="button"
              onClick={toggleTheme}
              aria-label="Change theme"
            >
              <Moon size={17} />
            </button>
          </Tooltip>
          <div className="nav-user" title="Alice Ng — alice.ng@nebula.rail">AN</div>
          <button
            className="nav-hamburger btn btn--ghost btn--icon"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <div className={'nav-mobile-menu' + (mobileOpen ? ' open' : '')} role="navigation" aria-label="Mobile navigation">
        <Link href="/" className={linkClass('/')} onClick={() => setMobileOpen(false)}>Dashboard</Link>
        <Link href="/schedule" className={linkClass('/schedule')} onClick={() => setMobileOpen(false)}>Schedule</Link>
        <Link href="/database" className={linkClass('/database')} onClick={() => setMobileOpen(false)}>Database Studio</Link>
        <Link href="/upload" className={linkClass('/upload')} onClick={() => setMobileOpen(false)}>Upload & Optimize</Link>
      </div>
    </>
  );
}
