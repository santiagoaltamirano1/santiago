import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Features() {
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs for Feature 1 (Thermal)
    const coldRef = useRef<HTMLSpanElement>(null);
    const hotRef = useRef<HTMLSpanElement>(null);
    const steelRef = useRef<HTMLDivElement>(null);
    const thermalPanelRef = useRef<HTMLDivElement>(null);

    // Refs for Feature 2 (Ritual)
    const ritualPanelRef = useRef<HTMLDivElement>(null);
    // Removed unused ref

    // Refs for Feature 3 (Customization)
    const customPanelRef = useRef<HTMLDivElement>(null);
    const cursorRef = useRef<HTMLDivElement>(null);
    const colorOptionRef = useRef<HTMLDivElement>(null);
    const engraveInputRef = useRef<HTMLDivElement>(null);

    const [terminalText, setTerminalText] = useState('');
    const fullText = "Preparando café 06:12 AM...\nTemperatura estable.\nListo para salir.";

    // Typewriter effect logic
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        let currentIndex = 0;

        const startTyping = () => {
            setTerminalText('');
            currentIndex = 0;

            const typeNextChar = () => {
                if (currentIndex < fullText.length) {
                    setTerminalText(fullText.substring(0, currentIndex + 1));
                    currentIndex++;
                    timeout = setTimeout(typeNextChar, 50 + Math.random() * 50); // Variable speed
                }
            };

            typeNextChar();
        };

        ScrollTrigger.create({
            trigger: ritualPanelRef.current,
            start: "top 80%",
            onEnter: startTyping,
        });

        return () => clearTimeout(timeout);
    }, [fullText]);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Feature 1: Thermal Engineering Animation
            const tlThermal = gsap.timeline({
                scrollTrigger: {
                    trigger: thermalPanelRef.current,
                    start: "top 80%",
                    toggleActions: "play none none reverse"
                }
            });

            tlThermal.fromTo(coldRef.current, { innerText: 0 }, {
                innerText: 11,
                duration: 2,
                snap: { innerText: 1 },
                ease: "power1.inOut"
            })
                .fromTo(hotRef.current, { innerText: 0 }, {
                    innerText: 7,
                    duration: 1.5,
                    snap: { innerText: 1 },
                    ease: "power1.inOut"
                }, "-=1.5")
                .fromTo(steelRef.current, { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: 1 }, "-=1");

            // Feature 3: Customization Simulation
            const tlCustom = gsap.timeline({
                scrollTrigger: {
                    trigger: customPanelRef.current,
                    start: "top 70%",
                    toggleActions: "play none none reverse"
                },
                repeat: -1, // Loop the simulation
                repeatDelay: 2
            });

            // Reset
            gsap.set(cursorRef.current, { x: 0, y: 0 });
            gsap.set(colorOptionRef.current, { scale: 1, borderColor: 'transparent' });
            gsap.set(engraveInputRef.current, { opacity: 0.5 });

            tlCustom
                // Move to color
                .to(cursorRef.current, { x: 60, y: 30, duration: 1, ease: "power2.inOut" })
                .to(colorOptionRef.current, { scale: 0.9, duration: 0.1 })
                .to(colorOptionRef.current, { scale: 1, borderColor: '#CC5833', duration: 0.1 })
                // Move to engrave
                .to(cursorRef.current, { x: -40, y: 100, duration: 1, ease: "power2.inOut", delay: 0.3 })
                .to(engraveInputRef.current, { opacity: 1, duration: 0.2 })
                // Move away
                .to(cursorRef.current, { x: 100, y: 150, duration: 1, ease: "power2.inOut", delay: 1 });

        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={containerRef} className="py-32 px-4 md:px-16 w-full max-w-7xl mx-auto space-y-32">

            {/* Feature 1: Ingeniería Térmica */}
            <div ref={thermalPanelRef} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h3 className="text-moss text-4xl mb-6 font-outfit uppercase tracking-tight">Ingeniería Térmica</h3>
                    <p className="text-charcoal/80 font-sans text-lg max-w-md">
                        Métricas de retención dictadas por las leyes de la termodinámica y un siglo de herencia técnica.
                    </p>
                </div>

                <div className="bg-charcoal text-cream p-10 rounded-3xl relative overflow-hidden flex flex-col justify-center border border-charcoal/20 shadow-2xl">
                    {/* Subtle grid background for lab feel */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(#F2F0E9 1px, transparent 1px), linear-gradient(90deg, #F2F0E9 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

                    <div className="relative z-10 flex flex-col gap-8">
                        <div className="flex items-end gap-4 border-b border-cream/10 pb-4">
                            <span className="font-metrics text-clay text-sm flex-1">Frío retenido</span>
                            <div className="flex items-baseline gap-1">
                                <span ref={coldRef} className="font-outfit text-6xl font-light">0</span>
                                <span className="font-metrics text-cream/50 text-xl">H</span>
                            </div>
                        </div>

                        <div className="flex items-end gap-4 border-b border-cream/10 pb-4">
                            <span className="font-metrics text-clay text-sm flex-1">Calor conservado</span>
                            <div className="flex items-baseline gap-1">
                                <span ref={hotRef} className="font-outfit text-6xl font-light">0</span>
                                <span className="font-metrics text-cream/50 text-xl">H</span>
                            </div>
                        </div>

                        <div ref={steelRef} className="flex items-center gap-3 pt-2">
                            <div className="w-2 h-2 rounded-full bg-clay animate-pulse" />
                            <span className="font-metrics text-xs text-cream/70">Acero Inoxidable 18/8</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Feature 2: Ritual cotidiano */}
            <div ref={ritualPanelRef} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="order-2 md:order-1 bg-moss text-cream p-10 rounded-3xl relative shadow-2xl h-[300px] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-8 opacity-50">
                        <span className="font-metrics text-xs">SYS.LOG</span>
                        <div className="flex items-center gap-2">
                            <span className="font-metrics text-xs">EN USO</span>
                            <div className="w-2 h-2 rounded-full bg-clay animate-ping" />
                        </div>
                    </div>

                    <div className="font-mono text-sm md:text-base leading-relaxed whitespace-pre-line relative">
                        {terminalText}
                        <span className="inline-block w-2.5 h-4 bg-clay ml-1 animate-pulse align-middle" />
                    </div>
                </div>

                <div className="order-1 md:order-2 md:pl-12">
                    <h3 className="text-charcoal text-4xl mb-6 font-outfit uppercase tracking-tight">Ritual Cotidiano</h3>
                    <p className="text-charcoal/80 font-sans text-lg max-w-md">
                        No es solo una botella. Es el ancla táctil de tu rutina diaria, diseñada para la consistencia absoluta.
                    </p>
                </div>
            </div>

            {/* Feature 3: Personalización */}
            <div ref={customPanelRef} className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div>
                    <h3 className="text-moss text-4xl mb-6 font-outfit uppercase tracking-tight">Identidad y Legado</h3>
                    <p className="text-charcoal/80 font-sans text-lg max-w-md">
                        Forja tu propia historia. Cada marca añade carácter. Cada grabado certifica su pertenencia.
                    </p>
                </div>

                <div className="bg-cream border-2 border-charcoal/10 p-10 rounded-3xl relative h-[350px] shadow-xl overflow-hidden flex flex-col justify-center items-center">

                    <div className="relative w-full max-w-[280px] bg-white rounded-2xl p-6 shadow-sm border border-charcoal/5">
                        <div className="font-sans text-sm font-semibold mb-4 text-charcoal">Configurar Edición</div>

                        {/* Color options */}
                        <div className="flex gap-3 mb-6">
                            <div className="w-8 h-8 rounded-full bg-moss border-2 border-transparent" />
                            <div ref={colorOptionRef} className="w-8 h-8 rounded-full bg-charcoal border-2 border-transparent transition-colors" />
                            <div className="w-8 h-8 rounded-full bg-cream border border-charcoal/20" />
                        </div>

                        {/* Engraving imitation */}
                        <div className="space-y-2">
                            <div className="text-xs font-sans text-charcoal/50">Grabado láser</div>
                            <div ref={engraveInputRef} className="w-full h-10 border-b-2 border-charcoal/20 flex items-center px-1 font-serif italic text-lg text-charcoal">
                                J. Doe
                            </div>
                        </div>

                        {/* Simulated Cursor */}
                        <div
                            ref={cursorRef}
                            className="absolute top-10 left-10 z-50 pointer-events-none drop-shadow-md"
                            style={{ width: '24px', height: '24px' }}
                        >
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5.5 3.21V20.8C5.5 21.45 6.27 21.8 6.75 21.36L11.44 17.06C11.69 16.83 12.02 16.7 12.36 16.7H19.5C20.17 16.7 20.53 15.91 20.08 15.42L5.5 3.21Z" fill="#1A1A1A" />
                                <path d="M5.5 3.21V20.8C5.5 21.45 6.27 21.8 6.75 21.36L11.44 17.06C11.69 16.83 12.02 16.7 12.36 16.7H19.5C20.17 16.7 20.53 15.91 20.08 15.42L5.5 3.21Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>

                    </div>

                </div>
            </div>

        </section>
    );
}
