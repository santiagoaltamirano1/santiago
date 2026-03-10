import { Link, useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function FailurePage() {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">

            <div className="flex flex-col items-center gap-6 max-w-md animate-fade-in">

                {/* Icon */}
                <div className="w-24 h-24 rounded-full bg-red-50 flex items-center justify-center">
                    <XCircle size={52} className="text-red-400" />
                </div>

                {/* Brand */}
                <span className="font-outfit font-bold tracking-widest text-xl uppercase text-moss">
                    Stanley
                </span>

                {/* Message */}
                <h1 className="font-outfit text-4xl uppercase tracking-tight text-charcoal">
                    Pago No Completado
                </h1>
                <p className="font-sans text-charcoal/60 text-lg leading-relaxed">
                    Hubo un problema al procesar tu pago. Tu carrito sigue intacto — puedes intentarlo nuevamente cuando quieras.
                </p>

                <div className="mt-4 p-6 bg-white rounded-2xl border border-charcoal/10 w-full text-left">
                    <p className="font-sans text-sm text-charcoal/70 leading-relaxed">
                        Si el problema persiste, verifica que los datos de tu tarjeta sean correctos o contacta a tu banco. No se realizó ningún cobro.
                    </p>
                </div>

                <button
                    onClick={() => navigate('/checkout')}
                    className="mt-4 w-full py-4 rounded-full bg-clay text-cream font-sans font-semibold tracking-wide text-center hover:bg-opacity-90 transition-opacity"
                >
                    Intentar de Nuevo
                </button>

                <Link
                    to="/shop"
                    className="font-sans text-sm text-charcoal/50 hover:text-charcoal transition-colors underline underline-offset-4"
                >
                    Volver a la tienda
                </Link>
            </div>

            {/* Footer */}
            <p className="absolute bottom-8 font-sans text-xs text-charcoal/30">
                © Stanley. Transacción 256-bit protegida.
            </p>
        </div>
    );
}
