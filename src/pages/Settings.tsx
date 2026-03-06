import React, { useRef, useState, useEffect, useCallback } from 'react';
import { User, Wifi, Key, Shield, AlertTriangle } from 'lucide-react';
import ProfilePreviewSection from '../components/settings/ProfilePreviewSection';
import ConnectionStatusSection from '../components/settings/ConnectionStatusSection';
import TokenImportSection from '../components/settings/TokenImportSection';
import AccountInfoSection from '../components/settings/AccountInfoSection';
import DangerZoneSection from '../components/settings/DangerZoneSection';

const SECTIONS = [
  { id: 'profile',    label: 'Profile',    icon: User },
  { id: 'connection', label: 'Connection', icon: Wifi },
  { id: 'token',      label: 'Token',      icon: Key },
  { id: 'account',    label: 'Account',    icon: Shield },
  { id: 'danger',     label: 'Danger Zone',icon: AlertTriangle },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

const Settings: React.FC = () => {
  const [activeSection, setActiveSection] = useState<SectionId>('profile');

  const profileRef    = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<HTMLDivElement>(null);
  const tokenRef      = useRef<HTMLDivElement>(null);
  const accountRef    = useRef<HTMLDivElement>(null);
  const dangerRef     = useRef<HTMLDivElement>(null);

  const sectionRefs: Record<SectionId, React.RefObject<HTMLDivElement>> = {
    profile:    profileRef,
    connection: connectionRef,
    token:      tokenRef,
    account:    accountRef,
    danger:     dangerRef,
  };

  const scrollTo = useCallback((id: SectionId) => {
    sectionRefs[id].current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // IntersectionObserver — highlights the anchor pill for the section most in view
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach(({ id }) => {
      const el = sectionRefs[id].current;
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { threshold: 0.25, rootMargin: '-80px 0px -40% 0px' }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="glass-morphism-card p-6 rounded-2xl">
        <h1 className="text-3xl font-bold text-white mb-1">Settings</h1>
        <p className="text-gray-300 text-sm">Manage your account, Instagram connection, and preferences.</p>
      </div>

      {/* Anchor Nav */}
      <div className="glass-morphism-card px-4 py-3 rounded-2xl sticky top-0 z-40">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
          {SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => scrollTo(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-shrink-0 border ${
                  isActive
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    : 'bg-gray-800/50 text-gray-400 border-gray-700 hover:text-white hover:border-gray-500'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sections */}
      <ProfilePreviewSection ref={profileRef} />
      <ConnectionStatusSection
        ref={connectionRef}
        onScrollToToken={() => scrollTo('token')}
      />
      <TokenImportSection ref={tokenRef} />
      <AccountInfoSection ref={accountRef} />
      <DangerZoneSection ref={dangerRef} />
    </div>
  );
};

export default Settings;
