import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { CheckCircle2 } from 'lucide-react';

export default function SuccessPage() {
    const { clearCart } = useStore();

    // Vaciar el carrito al llegar a esta página post-pago exitoso
    useEffect(() => {
        clearCart();
    }, [clearCart]);

    return (
        <div className="min-h-screen bg-cream flex flex-col items-center justify-center px-6 text-center">

            <div className="flex flex-col items-center gap-6 max-w-md animate-fade-in">

                {/* Icon */}
                <div className="w-24 h-24 rounded-full bg-moss/10 flex items-center justify-center">
                    <CheckCircle2 size={52} className="text-moss" />
                </div>

                {/* Brand */}
                <span className="font-outfit font-bold tracking-widest text-xl uppercase text-moss">
                    Stanley
                </span>

                {/* Message */}
                <h1 className="font-outfit text-4xl uppercase tracking-tight text-charcoal">
                    ¡Compra Exitosa!
                </h1>
                <p className="font-sans text-charcoal/60 text-lg leading-relaxed">
                    Tu pedido ha sido confirmado. Pronto recibirás un correo con los detalles y el seguimiento de tu envío.
                </p>

                <div className="mt-4 p-6 bg-white rounded-2xl border border-moss/20 w-full text-left">
                    <p className="font-sans text-sm text-charcoal/80 leading-relaxed">
                        Recuerda que cada equipo Stanley está respaldado por nuestra{' '}
                        <span className="font-semibold text-charcoal">garantía de por vida</span>.
                        Si tienes algún problema, estamos aquí.
                    </p>
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
