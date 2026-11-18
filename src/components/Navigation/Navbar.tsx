import React from 'react';
import { useFinanceStore } from '../../store/useFinanceStore';
import { ActiveTab } from '../../types';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab } = useFinanceStore();

  const navItems: { id: ActiveTab; label: string; icon: string }[] = [
    { id: 'calculator', label: 'Calculadora', icon: 'calculate' },
    { id: 'register', label: 'Anotar', icon: 'edit_note' },
    { id: 'debts_goals', label: 'Metas y Deudas', icon: 'flag' },
    { id: 'analytics', label: 'Analítica', icon: 'insights' },
  ];

  return (
    // [U18] La altura suma la zona segura del iPhone en vez de comprimir los botones
    <nav aria-label="Secciones" className="fixed bottom-0 left-0 w-full z-50 flex justify-center items-center px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] bg-white border-t border-[#e5e5e5] min-h-[68px] shadow-[0_-1px_3px_rgba(0,0,0,0.04)]">
      <div className="max-w-md w-full flex justify-around items-center gap-1">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if ('vibrate' in navigator) navigator.vibrate(8);
                setActiveTab(item.id);
              }}
              className={`flex flex-col items-center justify-center transition-all duration-150 flex-1 h-[52px] rounded-[18px] px-2 py-1 ${
                isActive
                  ? 'bg-[#0a0a0a] text-[#fafafa] font-medium shadow-sm'
                  : 'text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5]'
              }`}
            >
              <span
                aria-hidden="true"
                className="material-symbols-outlined text-[20px] mb-0.5"
                style={{ fontVariationSettings: isActive ? '"FILL" 1' : '"FILL" 0' }}
              >
                {item.icon}
              </span>
              <span className="text-[11px] tracking-tight whitespace-nowrap">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
