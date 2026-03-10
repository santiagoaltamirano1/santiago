import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { ShieldCheck, ArrowLeft, CreditCard, Truck, CheckCircle2 } from 'lucide-react';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';

// Declare gtag for TS
declare global {
    interface Window {
        gtag?: (...args: any[]) => void;
    }
}

export default function Checkout() {
    const { cart, getCartTotal } = useStore();

    // Multi-step State
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // Form and Shipping State
    const [formData, setFormData] = useState({
        email: '',
        nombre: '',
        apellidos: '',
        direccion: '',
        ciudad: '',
        codigoPostal: '',
        telefono: ''
    });

    const [shippingOption, setShippingOption] = useState<'standard' | 'express'>('standard');
    const [isProcessing, setIsProcessing] = useState(false);

    // Totals Calculation
    const cartTotal = getCartTotal();
    const tax = cartTotal * 0.19;
    const shippingCost = shippingOption === 'express' ? 15000 : 0;
    const finalTotal = cartTotal + tax + shippingCost;

    if (cart.length === 0) {
        return (
            <div className="min-h-screen bg-cream flex flex-col items-center justify-center">
                <h2 className="font-outfit text-2xl mb-4 text-charcoal">No hay orden activa.</h2>
                <Link to="/shop" className="text-clay hover:underline underline-offset-4 font-sans border border-clay rounded-full px-6 py-2">
                    Volver a la tienda
                </Link>
            </div>
        );
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const trackCheckoutStep = (stepNumber: number, stepName: string) => {
        if (window.gtag) {
            window.gtag('event', 'checkout_progress', {
                checkout_step: stepNumber,
                step_name: stepName
            });
        }
    };

    const handleInfoSubmit = (e: FormEvent) => {
        e.preventDefault();
        trackCheckoutStep(1, 'Informacion_Contacto');
        setStep(2);
    };

    const handleShippingSubmit = (e: FormEvent) => {
        e.preventDefault();
        trackCheckoutStep(2, 'Opciones_Envio');
        setStep(3);
    };

    const handlePayment = async () => {
        setIsProcessing(true);
        trackCheckoutStep(3, 'Confirmar_Pago');

        try {
            const orderTitle = `Orden Stanley (${cart.length} items)`;

            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: orderTitle,
                    price: finalTotal,
                    // Datos enriquecidos del cliente para estudio de mercado
                    customer_name: `${formData.nombre} ${formData.apellidos}`.trim(),
                    customer_email: formData.email,
                    shipping_address: `${formData.direccion}, ${formData.ciudad} ${formData.codigoPostal}`.trim(),
                    customer_phone: formData.telefono,
                })
            });

            const data = await response.json();

            if (response.ok && data.init_point) {
                window.location.href = data.init_point;
            } else {
                throw new Error(data.error || 'Error al generar preferencia de pago');
            }
        } catch (error) {
            console.error('Payment generation error:', error);
            alert('Hubo un problema al procesar el pago. Intenta nuevamente.');
            setIsProcessing(false);
        }
    };

    return (
        <div className="min-h-screen bg-cream flex flex-col md:flex-row">
            {/* Left: Form */}
            <div className="w-full md:w-3/5 p-8 md:p-16 lg:p-24 flex flex-col">
                <Link to="/" className="font-outfit font-bold tracking-widest text-2xl uppercase text-moss mb-16 inline-block">
                    Stanley
                </Link>

                {/* Progress indicator */}
                <div className="flex items-center gap-4 text-xs font-sans uppercase tracking-widest text-charcoal/40 mb-12">
                    <button onClick={() => setStep(1)} className={`${step >= 1 ? 'text-clay font-bold' : ''}`}>Información</button>
                    <span>/</span>
                    <button onClick={() => { if (step > 1) setStep(2) }} className={`${step >= 2 ? 'text-clay font-bold' : 'cursor-not-allowed'}`} disabled={step < 2}>Envío</button>
                    <span>/</span>
                    <span className={`${step === 3 ? 'text-clay font-bold' : ''}`}>Pago</span>
                </div>

                {/* STEP 1: INFORMACIÓN */}
                {step === 1 && (
                    <form className="max-w-xl w-full flex-1 animate-fade-in" onSubmit={handleInfoSubmit}>
                        <h2 className="text-2xl font-outfit uppercase tracking-tight text-charcoal mb-6">Información de Contacto</h2>
                        <input required type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Correo electrónico" className="w-full p-4 mb-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                        <input required type="tel" name="telefono" value={formData.telefono} onChange={handleInputChange} placeholder="Teléfono (ej. 3001234567)" className="w-full p-4 mb-8 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />

                        <h2 className="text-2xl font-outfit uppercase tracking-tight text-charcoal mb-6">Dirección de Envío</h2>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <input required type="text" name="nombre" value={formData.nombre} onChange={handleInputChange} placeholder="Nombre" className="p-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                            <input required type="text" name="apellidos" value={formData.apellidos} onChange={handleInputChange} placeholder="Apellidos" className="p-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                        </div>
                        <input required type="text" name="direccion" value={formData.direccion} onChange={handleInputChange} placeholder="Dirección completa" className="w-full p-4 mb-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                        <div className="grid grid-cols-2 gap-4 mb-12">
                            <input required type="text" name="ciudad" value={formData.ciudad} onChange={handleInputChange} placeholder="Ciudad" className="p-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                            <input required type="text" name="codigoPostal" value={formData.codigoPostal} onChange={handleInputChange} placeholder="Código Postal" className="p-4 bg-white border border-charcoal/20 rounded-xl font-sans focus:outline-none focus:border-moss transition-colors" />
                        </div>

                        <button type="submit" className="w-full py-5 rounded-xl bg-charcoal text-cream font-sans text-lg font-semibold tracking-wide hover:bg-opacity-90 transition-opacity flex justify-center items-center shadow-lg gap-3">
                            Continuar a Envío
                        </button>
                    </form>
                )}

                {/* STEP 2: ENVÍO */}
                {step === 2 && (
                    <form className="max-w-xl w-full flex-1 animate-fade-in" onSubmit={handleShippingSubmit}>
                        <div className="mb-8 p-4 border border-charcoal/10 rounded-xl bg-white text-sm">
                            <div className="flex justify-between border-b border-charcoal/10 pb-4 mb-4">
                                <span className="text-charcoal/50">Contacto</span>
                                <span className="font-medium">{formData.email}</span>
                                <button type="button" onClick={() => setStep(1)} className="text-clay hover:underline">Cambiar</button>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-charcoal/50">Enviar a</span>
                                <span className="font-medium text-right ml-4">{formData.direccion}, {formData.ciudad}</span>
                                <button type="button" onClick={() => setStep(1)} className="text-clay hover:underline">Cambiar</button>
                            </div>
                        </div>

                        <h2 className="text-2xl font-outfit uppercase tracking-tight text-charcoal mb-6">Método de Envío</h2>

                        <div className="space-y-4 mb-12">
                            <label className={`flex items-center justify-between p-5 border rounded-xl cursor-pointer transition-colors ${shippingOption === 'standard' ? 'border-moss bg-moss/5' : 'border-charcoal/20 bg-white'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="shipping" value="standard" checked={shippingOption === 'standard'} onChange={() => setShippingOption('standard')} className="w-4 h-4 text-moss accent-moss" />
                                    <Truck size={20} className="text-charcoal/70" />
                                    <div>
                                        <p className="font-semibold text-charcoal">Estándar (3-5 días hábiles)</p>
                                    </div>
                                </div>
                                <span className="font-medium text-charcoal">Gratis</span>
                            </label>

                            <label className={`flex items-center justify-between p-5 border rounded-xl cursor-pointer transition-colors ${shippingOption === 'express' ? 'border-moss bg-moss/5' : 'border-charcoal/20 bg-white'}`}>
                                <div className="flex items-center gap-3">
                                    <input type="radio" name="shipping" value="express" checked={shippingOption === 'express'} onChange={() => setShippingOption('express')} className="w-4 h-4 text-moss accent-moss" />
                                    <Truck size={20} className="text-clay" />
                                    <div>
                                        <p className="font-semibold text-charcoal">Express (1-2 días hábiles)</p>
                                    </div>
                                </div>
                                <span className="font-medium text-charcoal">$15.000</span>
                            </label>
                        </div>

                        <button type="submit" className="w-full py-5 rounded-xl bg-charcoal text-cream font-sans text-lg font-semibold tracking-wide hover:bg-opacity-90 transition-opacity flex justify-center items-center shadow-lg gap-3">
                            Continuar al Pago
                        </button>
                    </form>
                )}

                {/* STEP 3: PAGO */}
                {step === 3 && (
                    <div className="max-w-xl w-full flex-1 animate-fade-in">
                        <div className="mb-8 p-4 border border-charcoal/10 rounded-xl bg-white text-sm">
                            <div className="flex justify-between border-b border-charcoal/10 pb-4 mb-4">
                                <span className="text-charcoal/50">Contacto</span>
                                <span className="font-medium">{formData.email}</span>
                            </div>
                            <div className="flex justify-between border-b border-charcoal/10 pb-4 mb-4">
                                <span className="text-charcoal/50">Enviar a</span>
                                <span className="font-medium text-right ml-4">{formData.direccion}, {formData.ciudad}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-charcoal/50">Método</span>
                                <span className="font-medium">{shippingOption === 'standard' ? 'Estándar' : 'Express'}</span>
                                <button type="button" onClick={() => setStep(2)} className="text-clay hover:underline">Cambiar</button>
                            </div>
                        </div>

                        <h2 className="text-2xl font-outfit uppercase tracking-tight text-charcoal mb-6">Pago Seguro</h2>
                        <div className="p-6 border border-moss/30 bg-moss/5 rounded-xl mb-12">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 text-moss font-semibold">
                                    <CheckCircle2 size={18} /> Mercado Pago
                                </div>
                                <div className="flex gap-1">
                                    <CreditCard size={20} className="text-charcoal/50" />
                                </div>
                            </div>
                            <p className="text-sm text-charcoal/70">
                                Al hacer clic en "Pagar Ahora", serás redirigido a la plataforma segura de Mercado Pago para completar tu compra con tarjeta o efectivo.
                            </p>
                        </div>

                        <button onClick={handlePayment} disabled={isProcessing} className="w-full py-5 rounded-xl bg-moss text-cream font-sans text-lg font-semibold tracking-wide hover:bg-opacity-90 transition-opacity flex justify-center items-center shadow-lg gap-3 disabled:opacity-70 disabled:cursor-not-allowed">
                            {isProcessing ? (
                                'Redirigiendo a Mercado Pago...'
                            ) : (
                                <>
                                    <CreditCard size={20} />
                                    Pagar Ahora - ${(finalTotal).toLocaleString('es-CO')}
                                </>
                            )}
                        </button>
                    </div>
                )}

                <div className="mt-auto pt-12 flex justify-between items-center font-sans text-xs text-charcoal/50">
                    <button onClick={() => { if (step > 1) setStep(prev => prev - 1 as 1 | 2 | 3); else window.location.href = '/carrito' }} className="flex items-center gap-1 hover:text-charcoal transition-colors">
                        <ArrowLeft size={14} /> Volver
                    </button>
                    <p>© Stanley. Transacción 256-bit protegida.</p>
                </div>
            </div>

            {/* Right: Summary */}
            <div className="w-full md:w-2/5 bg-charcoal/5 border-l border-charcoal/10 p-8 md:p-16 lg:p-24 flex flex-col h-full md:sticky md:top-0 md:h-screen overflow-y-auto no-scrollbar">

                {/* Responsive toggle for summary could go here, omitting for breavity */}

                <div className="mb-12">
                    {cart.map(item => (
                        <div key={item.id} className="flex gap-4 items-center mb-6">
                            <div className="relative w-16 h-16 bg-cream rounded-xl border border-charcoal/10 overflow-hidden flex items-center justify-center p-1">
                                <ImageSafe src={getProductImage(item.product.slug)} alt={item.product.name} className="max-h-full mix-blend-multiply" />
                                <span className="absolute -top-2 -right-2 bg-charcoal text-cream text-[10px] w-5 h-5 flex items-center justify-center rounded-full z-10">{item.quantity}</span>
                            </div>
                            <div className="flex-1">
                                <h4 className="font-outfit text-sm uppercase text-charcoal tracking-wide">{item.product.name}</h4>
                                <span className="font-sans text-xs text-charcoal/60 capitalize">{item.selectedVariant.size}</span>
                            </div>
                            <div className="font-metrics text-sm text-charcoal">${(item.selectedVariant.price_cop * item.quantity).toLocaleString('es-CO')}</div>
                        </div>
                    ))}
                </div>

                <div className="border-t border-charcoal/10 pt-6 mb-6 space-y-4 font-sans text-sm text-charcoal/70">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-metrics">${cartTotal.toLocaleString('es-CO')}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Envíos</span>
                        <span className="font-metrics">{step === 1 ? 'Calculado en el sig. paso' : (shippingCost === 0 ? 'Gratis' : `$${shippingCost.toLocaleString('es-CO')}`)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Impuestos (19%)</span>
                        <span className="font-metrics">${tax.toLocaleString('es-CO')}</span>
                    </div>
                </div>

                <div className="border-t border-charcoal/10 pt-6 flex justify-between items-end mb-12">
                    <span className="font-outfit uppercase tracking-widest text-charcoal text-lg">Total</span>
                    <div className="flex items-end gap-2 text-charcoal">
                        <span className="font-metrics text-xs mb-1 text-charcoal/50">COP</span>
                        <span className="font-metrics text-3xl">${finalTotal.toLocaleString('es-CO')}</span>
                    </div>
                </div>

                <div className="mt-auto bg-white border border-moss/20 rounded-xl p-6 flex gap-4 items-center">
                    <ShieldCheck size={32} className="text-moss shrink-0" />
                    <p className="font-sans text-sm text-charcoal/80 leading-relaxed">
                        Estás invirtiendo en equipo diseñado para durar generaciones. Garantía de por vida incluida en cada compra.
                    </p>
                </div>
            </div>
        </div>
    );
}
