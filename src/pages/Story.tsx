import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export default function Story() {
    const explosionRef = useRef<HTMLDivElement>(null);
    const lidRef = useRef<HTMLDivElement>(null);
    const outerRef = useRef<HTMLDivElement>(null);
    const vacuumRef = useRef<HTMLDivElement>(null);
    const innerRef = useRef<HTMLDivElement>(null);
    const baseRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({ repeat: -1 });

            gsap.set([baseRef.current, outerRef.current, innerRef.current, vacuumRef.current, lidRef.current], { opacity: 0 });

            tl.fromTo(baseRef.current, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" })
                .fromTo(outerRef.current, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 0.8, ease: "power2.out" }, "+=0.2")
                .fromTo(innerRef.current, { opacity: 0, y: -40 }, { opacity: 1, y: -120, duration: 1, ease: "power2.out" }, "+=0.2")
                .fromTo(vacuumRef.current, { opacity: 0, scale: 0.9, y: 0 }, { opacity: 1, scale: 1, y: -60, duration: 0.8, ease: "back.out(1.2)" }, "+=0.2")
                .fromTo(lidRef.current, { opacity: 0, y: -180 }, { opacity: 1, y: -150, duration: 0.8, ease: "bounce.out" }, "+=0.2")
                .to([innerRef.current, vacuumRef.current, lidRef.current], {
                    y: 0,
                    duration: 1.2,
                    ease: "power2.inOut",
                    stagger: 0.1
                }, "+=0.5")
                .to({}, { duration: 3 })
                .to([baseRef.current, outerRef.current, innerRef.current, vacuumRef.current, lidRef.current], { opacity: 0, duration: 0.5 });

        }, explosionRef);

        return () => ctx.revert();
    }, []);

    return (
        <section className="w-full bg-[#0A0A0A] text-white py-24 overflow-hidden">
            <div className="max-w-7xl mx-auto px-6">

                <div className="grid lg:grid-cols-2 gap-24 items-center">

                    {/* Text content */}
                    <div className="space-y-12">
                        <div className="space-y-4">
                            <span className="font-metrics tracking-widest text-clay uppercase text-sm block">Historia de la Marca</span>
                            <h2 className="text-5xl md:text-8xl font-outfit uppercase tracking-tight leading-[0.85]">
                                Desde 1913,<br />construyendo<br />legados.
                            </h2>
                        </div>

                        <div className="space-y-6 text-xl text-gray-400 leading-relaxed max-w-xl">
                            <p>
                                Stanley revolucionó la conservación térmica con acero inoxidable al vacío. No era un accesorio. Era una herramienta de resistencia.
                            </p>
                            <p>
                                Un Stanley no se reemplaza. Se hereda. Diseñado para durar décadas, no temporadas.
                            </p>
                        </div>

                        <div className="flex gap-12 pt-8 border-t border-white/10">
                            <div>
                                <span className="block text-4xl font-metrics text-clay">40h</span>
                                <span className="text-xs uppercase tracking-widest text-gray-500">Frío Extremo</span>
                            </div>
                            <div>
                                <span className="block text-4xl font-metrics text-clay">11h</span>
                                <span className="text-xs uppercase tracking-widest text-gray-500">Calor Intenso</span>
                            </div>
                        </div>
                    </div>

                    {/* Animation content */}
                    <div className="relative h-[600px] flex items-center justify-center" ref={explosionRef}>
                        <div className="relative w-64 h-[450px]">
                            {/* Parts of the assembly */}
                            <div ref={baseRef} className="absolute bottom-0 w-40 h-10 left-12 border-b-4 border-x-4 border-white/20 bg-white/5 rounded-b-3xl z-40" />
                            <div ref={outerRef} className="absolute bottom-8 w-48 h-[280px] left-8 border-2 border-white/10 bg-white/5 rounded-[2rem] z-30 flex items-center justify-center">
                                <span className="text-[10px] uppercase tracking-widest text-white/20">Cuerpo Externo</span>
                            </div>
                            <div ref={vacuumRef} className="absolute bottom-12 w-44 h-[250px] left-10 border-2 border-clay/30 bg-clay/5 rounded-2xl z-20 flex items-center justify-center">
                                <span className="text-[10px] uppercase tracking-widest text-clay/50">Vacío Patentado</span>
                            </div>
                            <div ref={innerRef} className="absolute bottom-14 w-36 h-[230px] left-14 border border-white/20 bg-white/10 rounded-xl z-10 flex items-center justify-center">
                                <span className="text-[10px] uppercase tracking-widest text-white/40">Cámara Interna</span>
                            </div>
                            <div ref={lidRef} className="absolute bottom-[288px] w-40 h-14 left-12 border-t-4 border-x-4 border-white/20 bg-white/5 rounded-t-3xl z-50 flex items-center justify-center">
                                <span className="text-[10px] uppercase tracking-widest text-white/20">Sellado Hermético</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
}
