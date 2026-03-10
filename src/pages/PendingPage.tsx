import { Link } from 'react-router-dom';
import { Clock } from 'lucide-react';

export default function PendingPage() {
    return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">

            <div className="flex flex-col items-center gap-6 max-w-md animate-fade-in">

                {/* Icon */}
                <div className="w-24 h-24 rounded-full bg-yellow-50 flex items-center justify-center">
                    <Clock size={52} className="text-yellow-500" />
                </div>

                {/* Brand */}
                <span className="font-outfit font-bold tracking-widest text-xl uppercase text-moss">
                    Stanley
                </span>

                {/* Message */}
                <h1 className="font-outfit text-4xl uppercase tracking-tight text-charcoal">
                    Pago en Revisión
                </h1>
                <p className="font-sans text-charcoal/60 text-lg leading-relaxed">
                    Tu pago está siendo procesado. Este proceso puede tomar hasta 2 días hábiles dependiendo de tu método de pago.
                </p>

                <div className="mt-4 p-6 bg-white rounded-2xl border border-yellow-200 w-full text-left space-y-3">
                    <p className="font-sans text-sm font-semibold text-charcoal">¿Qué pasa ahora?</p>
                    <ul className="font-sans text-sm text-charcoal/70 space-y-2 list-disc list-inside">
                        <li>Recibirás un correo cuando el pago sea confirmado.</li>
                        <li>Si pagaste en efectivo, revisa el plazo de acreditación de tu entidad.</li>
                        <li>No realices el pago nuevamente hasta recibir confirmación.</li>
                    </ul>
                </div>

                <Link
                    to="/"
                    className="mt-4 w-full py-4 rounded-full bg-charcoal text-cream font-sans font-semibold tracking-wide text-center hover:bg-opacity-90 transition-opacity"
                >
                    Volver al Inicio
                </Link>

                <Link
                    to="/shop"
                    className="font-sans text-sm text-charcoal/50 hover:text-charcoal transition-colors underline underline-offset-4"
                >
                    Seguir explorando
                </Link>
            </div>

            {/* Footer */}
            <p className="absolute bottom-8 font-sans text-xs text-charcoal/30">
                © Stanley. Transacción 256-bit protegida.
            </p>
        </div>
    );
}
