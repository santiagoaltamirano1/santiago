import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Archive() {
    const containerRef = useRef<HTMLDivElement>(null);
    const card1Ref = useRef<HTMLDivElement>(null);
    const card2Ref = useRef<HTMLDivElement>(null);
    const card3Ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Pin the container to allow cards to stack
            ScrollTrigger.create({
                trigger: containerRef.current,
                start: 'top top',
                end: '+=200%', // Determines the total scroll distance for the stacking effect
                pin: true,
                scrub: true,
            });

            // Card 1 scales down and blurs as Card 2 comes in
            gsap.to(card1Ref.current, {
                scale: 0.9,
                filter: 'blur(10px)',
                opacity: 0.3,
                ease: 'none',
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top top',
                    end: '+=100%',
                    scrub: true,
                },
            });

            // Card 2 enters
            gsap.fromTo(
                card2Ref.current,
                { yPercent: 100 },
                {
                    yPercent: 0,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: 'top top',
                        end: '+=100%',
                        scrub: true,
                    },
                }
            );

            // Card 2 scales down and blurs as Card 3 comes in
            gsap.to(card2Ref.current, {
                scale: 0.9,
                filter: 'blur(10px)',
                opacity: 0.3,
                ease: 'none',
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: '+=100%',
                    end: '+=200%',
                    scrub: true,
                },
            });

            // Card 3 enters
            gsap.fromTo(
                card3Ref.current,
                { yPercent: 100 },
                {
                    yPercent: 0,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: containerRef.current,
                        start: '+=100%',
                        end: '+=200%',
                        scrub: true,
                    },
                }
            );
        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={containerRef} className="relative w-full h-[100dvh] overflow-hidden bg-cream">

            {/* Card 1: Historia */}
            <div
                ref={card1Ref}
                className="absolute inset-0 w-full h-full bg-moss text-cream flex items-center justify-center p-8 md:p-16 origin-top"
            >
                <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <span className="font-metrics text-clay mb-4 block">01 — ARCHIVO</span>
                        <h2 className="text-5xl md:text-7xl font-concept mb-8">Historia de<br />Marca</h2>
                        <p className="font-sans text-lg text-cream/80 max-w-md">
                            Desde 1913, las botellas Stanley han sobrevivido a temperaturas bajo cero, caídas desde aviones y generaciones de desgaste diario.
                        </p>
                    </div>
                    <div className="hidden lg:flex justify-center items-center h-full relative">
                        {/* Visual placeholder for Historia (e.g. vintage photo or rotating fan) */}
                        <div className="w-64 h-64 border border-cream/20 rounded-full flex items-center justify-center relative">
                            <div className="absolute inset-0 border border-clay rounded-full animate-[spin_10s_linear_infinite] border-t-transparent" />
                            <span className="font-metrics text-sm">1913</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card 2: Tecnología */}
            <div
                ref={card2Ref}
                className="absolute inset-0 w-full h-full bg-charcoal text-cream flex items-center justify-center p-8 md:p-16 origin-top z-10"
                style={{ transform: 'translateY(100%)' }}
            >
                <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <span className="font-metrics text-clay mb-4 block">02 — INGENIERÍA</span>
                        <h2 className="text-5xl md:text-7xl font-concept mb-8">Tecnología<br />QuadVac™</h2>
                        <p className="font-sans text-lg text-cream/70 max-w-md">
                            Aislamiento térmico llevado al límite de la física. Cuatro capas de protección para retención extrema de temperatura.
                        </p>
                    </div>
                    <div className="hidden lg:flex justify-center items-center h-full relative">
                        {/* Visual simulation for Laser Scan */}
                        <div className="w-full h-64 border border-cream/10 relative overflow-hidden flex items-center justify-center rounded-3xl bg-black">
                            <div className="absolute top-0 left-0 w-full h-1 bg-clay/80 shadow-[0_0_15px_rgba(204,88,51,0.8)] animate-[scan_3s_ease-in-out_infinite_alternate]" />
                            <style dangerouslySetInnerHTML={{
                                __html: `
                @keyframes scan {
                  0% { top: 0; }
                  100% { top: 100%; }
                }
              `}} />
                            <span className="font-metrics text-xs text-cream/30">SCAN.02</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Card 3: Comunidad */}
            <div
                ref={card3Ref}
                className="absolute inset-0 w-full h-full bg-clay text-cream flex items-center justify-center p-8 md:p-16 origin-top z-20"
                style={{ transform: 'translateY(100%)' }}
            >
                <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                    <div>
                        <span className="font-metrics text-charcoal mb-4 block">03 — EL MOVIMIENTO</span>
                        <h2 className="text-5xl md:text-7xl font-concept mb-8 text-charcoal">Comunidad<br />Global</h2>
                        <p className="font-sans text-lg text-charcoal/90 max-w-md">
                            El ícono que une a trabajadores del acero con alpinistas y exploradores urbanos. Un símbolo de resiliencia compartida.
                        </p>
                    </div>
                    <div className="hidden lg:flex justify-center items-center h-full relative">
                        {/* Pulsating Thermal Wave placeholder */}
                        <div className="relative flex items-center justify-center">
                            <div className="w-32 h-32 bg-cream/20 rounded-full absolute animate-ping" style={{ animationDuration: '3s' }} />
                            <div className="w-48 h-48 border border-cream/30 rounded-full absolute animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
                            <div className="w-16 h-16 bg-cream rounded-full z-10 flex items-center justify-center text-clay font-bold font-outfit">S</div>
                        </div>
                    </div>
                </div>
            </div>

        </section>
    );
}
