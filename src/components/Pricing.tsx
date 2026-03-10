import { ArrowRight, Check } from 'lucide-react';

export default function Pricing() {
    return (
        <section className="py-32 px-4 md:px-16 w-full max-w-7xl mx-auto bg-cream">
            <div className="text-center mb-24">
                <h2 className="text-4xl md:text-5xl font-outfit uppercase tracking-tight text-moss mb-4">Eligiendo tu Legado</h2>
                <p className="font-sans text-lg text-charcoal/70 max-w-2xl mx-auto">
                    No vendemos características, vendemos resistencia probada en el tiempo. Selecciona la herramienta adecuada para tu expedición.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center cursor-default">

                {/* Tier 1: Core */}
                <div className="bg-white rounded-3xl p-10 border border-charcoal/10 shadow-sm hover:shadow-xl transition-shadow relative">
                    <h3 className="font-outfit uppercase text-xl font-bold tracking-wider text-charcoal mb-2">Core Collection</h3>
                    <div className="font-mono text-sm text-charcoal/50 mb-8 pb-8 border-b border-charcoal/10">El estándar industrial.</div>

                    <ul className="space-y-4 mb-12 font-sans text-sm text-charcoal/80">
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Acero inoxidable 18/8</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Aislamiento de doble pared</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> 8h frío / 4h calor</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Tapa anti-fugas estándar</li>
                    </ul>

                    <button className="w-full py-4 rounded-full border border-charcoal text-charcoal font-sans font-semibold tracking-wide hover:bg-charcoal hover:text-cream transition-colors group flex justify-center items-center gap-2">
                        Explorar Core <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Tier 2: Pro (Highlighted) */}
                <div className="bg-moss rounded-3xl p-12 border border-transparent shadow-2xl relative z-10 scale-100 md:scale-105">
                    <div className="absolute top-0 right-0 bg-clay text-cream text-xs font-bold px-4 py-1 tracking-widest rounded-bl-3xl rounded-tr-3xl uppercase font-sans">
                        Más Vendida
                    </div>
                    <h3 className="font-outfit uppercase text-2xl font-bold tracking-wider text-cream mb-2">Master Series</h3>
                    <div className="font-mono text-sm text-cream/60 mb-8 pb-8 border-b border-cream/20">Ingeniería térmica extrema.</div>

                    <ul className="space-y-4 mb-12 font-sans text-base text-cream/90">
                        <li className="flex items-start gap-3"><Check size={20} className="text-clay shrink-0 mt-0.5" /> Pared de acero de 1.0mm</li>
                        <li className="flex items-start gap-3"><Check size={20} className="text-clay shrink-0 mt-0.5" /> Tecnología QuadVac™</li>
                        <li className="flex items-start gap-3"><Check size={20} className="text-clay shrink-0 mt-0.5" /> 27h frío / 27h calor</li>
                        <li className="flex items-start gap-3"><Check size={20} className="text-clay shrink-0 mt-0.5" /> Base reforzada para impacto</li>
                        <li className="flex items-start gap-3"><Check size={20} className="text-clay shrink-0 mt-0.5" /> Tapa tipo taza integrada</li>
                    </ul>

                    <button className="w-full py-5 rounded-full bg-clay text-cream font-sans font-semibold tracking-wide hover:bg-opacity-90 transition-opacity group flex justify-center items-center gap-2 shadow-[0_4px_14px_0_rgba(204,88,51,0.39)]">
                        Adquirir Master <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                {/* Tier 3: Special Edition */}
                <div className="bg-white rounded-3xl p-10 border border-charcoal/10 shadow-sm hover:shadow-xl transition-shadow relative">
                    <h3 className="font-outfit uppercase text-xl font-bold tracking-wider text-charcoal mb-2">Edición Limitada</h3>
                    <div className="font-mono text-sm text-charcoal/50 mb-8 pb-8 border-b border-charcoal/10">Colaboraciones y archivo.</div>

                    <ul className="space-y-4 mb-12 font-sans text-sm text-charcoal/80">
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Acabados exclusivos</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Grabado láser personalizado</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Empaque de colección</li>
                        <li className="flex items-start gap-3"><Check size={18} className="text-clay shrink-0 mt-0.5" /> Certificado de autenticidad</li>
                    </ul>

                    <button className="w-full py-4 rounded-full border border-charcoal text-charcoal font-sans font-semibold tracking-wide hover:bg-charcoal hover:text-cream transition-colors group flex justify-center items-center gap-2">
                        Ver Ediciones <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

            </div>
        </section>
    );
}
