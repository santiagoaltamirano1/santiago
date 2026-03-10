import { useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { X, Minus, Plus, ShoppingBag, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { getProductImage } from '../data/products';

export default function Cart() {
    const { cart, isCartOpen, toggleCart, removeFromCart, updateQuantity, getCartTotal } = useStore();
    const overlayRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    useEffect(() => {
        if (isCartOpen) {
            document.body.style.overflow = 'hidden';
            gsap.to(overlayRef.current, { opacity: 1, pointerEvents: 'auto', duration: 0.3, ease: 'power2.out' });
            gsap.to(panelRef.current, { x: 0, duration: 0.4, ease: 'power3.out' });
        } else {
            document.body.style.overflow = '';
            gsap.to(overlayRef.current, { opacity: 0, pointerEvents: 'none', duration: 0.3, ease: 'power2.in' });
            gsap.to(panelRef.current, { x: '100%', duration: 0.4, ease: 'power3.in' });
        }
    }, [isCartOpen]);

    const handleCheckout = () => {
        toggleCart(); // Close cart
        navigate('/checkout'); // Push to checkout
    };

    return (
        <div className="fixed inset-0 z-[100] h-full pointer-events-none">

            {/* Backdrop */}
            <div
                ref={overlayRef}
                onClick={toggleCart}
                className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm opacity-0 pointer-events-none transition-opacity"
            />

            {/* Slide Panel */}
            <div
                ref={panelRef}
                className="absolute top-0 right-0 w-full md:w-[480px] h-[100dvh] bg-cream shadow-2xl flex flex-col pointer-events-auto border-l border-charcoal/10"
                style={{ transform: 'translateX(100%)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-charcoal/10 bg-cream z-10">
                    <div className="flex items-center gap-3 text-charcoal">
                        <ShoppingBag size={20} />
                        <h2 className="font-outfit uppercase tracking-tight text-xl">Tu Equipo</h2>
                    </div>
                    <button
                        onClick={toggleCart}
                        className="w-10 h-10 rounded-full bg-charcoal/5 flex items-center justify-center hover:bg-charcoal/10 transition-colors text-charcoal/70"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 no-scrollbar">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-charcoal/50 space-y-4">
                            <ShoppingBag size={48} className="opacity-50" />
                            <p className="font-sans text-lg">Tu carrito está vacío.</p>
                            <button onClick={toggleCart} className="mt-4 px-6 py-2 border border-charcoal rounded-full font-sans text-sm hover:bg-charcoal hover:text-cream transition-colors">
                                Seguir Explorando
                            </button>
                        </div>
                    ) : (
                        cart.map(item => (
                            <div key={item.id} className="flex gap-4 p-4 bg-white rounded-2xl border border-charcoal/5 shadow-sm">

                                {/* Image */}
                                <div className="w-24 h-24 bg-cream/40 rounded-xl overflow-hidden flex items-center justify-center p-2">
                                    <img src={getProductImage(item.product.slug)} alt={item.product.name} className="max-h-full object-contain mix-blend-multiply" />
                                </div>

                                {/* Details */}
                                <div className="flex-1 flex flex-col justify-between">

                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <h4 className="font-outfit text-charcoal uppercase tracking-wide text-sm line-clamp-2">{item.product.name}</h4>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="font-sans text-xs text-charcoal/60 capitalize">{item.selectedVariant.size}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => removeFromCart(item.id)}
                                            className="text-charcoal/40 hover:text-red-500 transition-colors p-1"
                                            aria-label="Remove item"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>

                                    <div className="flex justify-between items-end mt-2">
                                        <div className="flex items-center bg-cream rounded-full border border-charcoal/10 overflow-hidden">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="w-8 h-8 flex flex-col items-center justify-center text-charcoal/70 hover:bg-charcoal/5 transition-colors disabled:opacity-50"
                                                disabled={item.quantity <= 1}
                                            >
                                                <Minus size={14} />
                                            </button>
                                            <span className="w-8 text-center font-metrics text-sm text-charcoal">{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="w-8 h-8 flex flex-col items-center justify-center text-charcoal/70 hover:bg-charcoal/5 transition-colors"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                        <div className="font-metrics text-clay">
                                            ${(item.selectedVariant.price_cop * item.quantity).toLocaleString('es-CO')}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                {cart.length > 0 && (
                    <div className="p-6 bg-white border-t border-charcoal/10 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-10">
                        <div className="flex justify-between items-center mb-6">
                            <span className="font-outfit uppercase tracking-widest text-charcoal/70 text-sm">Subtotal</span>
                            <span className="font-metrics text-2xl text-charcoal">${getCartTotal().toLocaleString('es-CO')} COP</span>
                        </div>
                        <p className="font-sans text-xs text-charcoal/50 mb-6 text-center">Impuestos y envíos calculados en el checkout.</p>

                        <button
                            onClick={handleCheckout}
                            className="w-full py-4 rounded-full bg-clay text-cream font-sans font-semibold tracking-wide hover:bg-opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-lg group"
                        >
                            Finalizar Compra <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
}
