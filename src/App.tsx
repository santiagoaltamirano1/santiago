/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { useFinanceStore } from './store/useFinanceStore';
import { recoverPendingTransactions, subscribeToAll } from './services/financeService';
import { Navbar } from './components/Navigation/Navbar';
import { ExpressCalculator } from './components/Calculator/ExpressCalculator';
import { HybridRegister } from './components/Register/HybridRegister';
import { DebtsGoalsView } from './components/DebtsGoals/DebtsGoalsView';
import { AnalyticsView } from './components/Analytics/AnalyticsView';
import { UndoToast } from './components/Toast/UndoToast';
import { AuthGate } from './components/Auth/AuthGate';

export default function App() {
  const { activeTab, userProfile, appTheme, isAuthenticated, refreshFx, hydrateFromServidor } = useFinanceStore();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', appTheme);
    }
  }, [appTheme]);

  // Hydration bootstrapper: recupera transacciones huérfanas solo tras autenticar
  useEffect(() => {
    if (!isAuthenticated || !userProfile.id) return;
    refreshFx(); // TRM vigente desde el servidor al entrar
    const cadaMedia = setInterval(() => refreshFx(), 30 * 60 * 1000); // y cada 30 min con la app abierta
    recoverPendingTransactions(userProfile.id).then((r) => {
      if (r.recuperados > 0 || r.descartados.length > 0) hydrateFromServidor(); // [E26] la pantalla muestra lo recuperado
      // [N4] Lo que el servidor rechazó al recuperar se avisa (antes se perdía en silencio)
      if (r.descartados.length > 0) {
        useFinanceStore.setState((st) => ({
          avisos: [...st.avisos, ...r.descartados.map((t) => ({
            id: crypto.randomUUID(), tipo: 'error' as const, transaccion: t,
            mensaje: 'Un movimiento anotado sin conexión no se pudo guardar.',
          }))],
        }));
      }
    });
    // [E5][E43] Realtime: si algo cambia en otro dispositivo o pestaña, se recarga (sin pisar lo que está en sus 5 s).
    let espera: ReturnType<typeof setTimeout> | undefined;
    const cancelar = subscribeToAll(userProfile.id, () => {
      clearTimeout(espera);
      // [N12] Si hay movimientos en sus 5 s, se vuelve a intentar después (el cambio no se pierde)
      const intentar = () => {
        if (useFinanceStore.getState().pendingUndoList.length === 0) hydrateFromServidor();
        else espera = setTimeout(intentar, 1500);
      };
      espera = setTimeout(intentar, 1200);
    });
    return () => { clearInterval(cadaMedia); clearTimeout(espera); cancelar(); };
  }, [isAuthenticated, userProfile.id]);

  return (
    <AuthGate>
      <div
        data-theme={appTheme}
        className="min-h-screen bg-[#f5f5f5] text-[#0a0a0a] flex flex-col font-sans transition-colors duration-200"
      >
        <main className={`flex-1 max-w-[1280px] w-full mx-auto ${activeTab === 'calculator' ? 'pt-3 pb-28' : 'pt-5 pb-28'}`}>
          {activeTab === 'calculator' && <ExpressCalculator />}
          {activeTab === 'register' && <HybridRegister />}
          {activeTab === 'debts_goals' && <DebtsGoalsView />}
          {activeTab === 'analytics' && <AnalyticsView />}
        </main>

        {/* Floating 5-Second Optimistic Undo Toast Notification */}
        <UndoToast />

        <Navbar />
      </div>
    </AuthGate>
  );
}
