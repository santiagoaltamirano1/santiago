import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, type User } from 'firebase/auth';
import { auth, firebaseConfigurado } from '../../services/firebase';
import { useFinanceStore } from '../../store/useFinanceStore';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, setSessionUser, hydrateFromServidor } = useFinanceStore();
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    // [E39][E40] onAuthStateChanged puede avisar más de una vez por el mismo usuario.
    // Solo se carga (y se siembra) cuando cambia el usuario.
    let usuarioCargado: string | null = null;
    let carga: Promise<void> = Promise.resolve(); // [N6] la segunda llamada espera a la primera
    const apply = async (u: User | null) => {
      if (!mounted) return;
      if (u) {
        if (usuarioCargado === u.uid) { await carga; if (mounted) setLoading(false); return; }
        usuarioCargado = u.uid;
        setSessionUser({
          id: u.uid,
          email: u.email || '',
          nombre: u.displayName || u.email || '',
          avatar_url: u.photoURL || undefined,
        });
        carga = hydrateFromServidor();
        await carga;
      } else {
        usuarioCargado = null;
        setSessionUser(null);
      }
      setLoading(false);
    };
    const baja = onAuthStateChanged(auth, (u) => { apply(u); });
    return () => { mounted = false; baja(); };
  }, [setSessionUser, hydrateFromServidor]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setInfo(null); setBusy(true);
    try {
      if (mode === 'signup') await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      // [U17] Mensajes de Firebase Auth traducidos
      const c = String(err?.code || '');
      setError(
        /invalid-credential|wrong-password|user-not-found|invalid-login/.test(c) ? 'Correo o contraseña incorrectos.'
        : /email-already-in-use/.test(c) ? 'Ese correo ya tiene cuenta. Inicia sesión.'
        : /weak-password/.test(c) ? 'La contraseña debe tener al menos 6 caracteres.'
        : /invalid-email/.test(c) ? 'Ese correo no es válido.'
        : /too-many-requests/.test(c) ? 'Demasiados intentos. Espera un momento.'
        : /network-request-failed/.test(c) ? 'Sin conexión. Revisa tu internet.'
        : /operation-not-allowed|configuration-not-found/.test(c) ? 'Falta activar "Correo/contraseña" en Firebase Authentication.'
        : 'No pudimos entrar. Intenta otra vez.'
      );
    } finally {
      setBusy(false);
    }
  };

  if (!firebaseConfigurado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4 text-center">
        <p className="max-w-sm text-sm text-[#525252]">Falta conectar Firebase: activa la integración de Firebase en AI Studio (crea <code>firebase-applet-config.json</code>).</p>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] text-[#737373]">Cargando…</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5] px-4">
        <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-[24px] p-8 border border-[#e5e5e5] shadow-sm">
          <h1 className="text-2xl font-semibold text-[#0a0a0a] tracking-tight text-center">Lumi Finance</h1>
          <p className="text-sm text-[#737373] mt-1 mb-6 text-center">
            {mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta'}
          </p>

          <label htmlFor="auth-email" className="text-xs font-medium text-[#737373] block mb-1">Correo</label>
          <input
            id="auth-email" autoComplete="email"
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm p-3 rounded-[14px] border border-[#e5e5e5] outline-none focus:bg-white mb-3"
          />
          <label htmlFor="auth-clave" className="text-xs font-medium text-[#737373] block mb-1">Contraseña</label>
          <input
            id="auth-clave" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="mínimo 6 caracteres"
            className="w-full bg-[#f5f5f5] text-[#0a0a0a] text-sm p-3 rounded-[14px] border border-[#e5e5e5] outline-none focus:bg-white mb-4"
          />

          <button
            type="submit" disabled={busy}
            className="w-full bg-[#0a0a0a] text-[#fafafa] py-3 rounded-[18px] font-medium active:scale-95 transition-all disabled:opacity-60"
          >
            {busy ? 'Procesando…' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>

          {error && <p role="alert" className="text-sm text-ember mt-3 text-center">{error}</p>}
          {info && <p role="status" className="text-sm text-income mt-3 text-center">{info}</p>}

          <button
            type="button"
            onClick={() => { setError(null); setInfo(null); setMode(mode === 'login' ? 'signup' : 'login'); }}
            className="w-full min-h-[44px] text-sm text-[#737373] hover:text-[#0a0a0a] mt-2"
          >
            {mode === 'login' ? '¿No tienes cuenta? Crear una' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>

          <p className="text-[11px] text-[#a3a3a3] mt-6 text-center">
            Tus datos quedan protegidos: solo tú puedes verlos.
          </p>
        </form>
      </div>
    );
  }

  return <>{children}</>;
};
