import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { getProductImage } from '../data/products';
import ImageSafe from '../components/ImageSafe';
import { supabase } from '../lib/supabase';

// --- Quiz Configuration ---
interface Answer {
    label: string;
    scores: Partial<Record<string, number>>;
}

interface QuizQuestion {
    id: string;
    question: string;
    answers: Answer[];
}

const QUESTIONS: QuizQuestion[] = [
    {
        id: 'temperature',
        question: '¿Qué tan importante es mantener tu bebida en la temperatura perfecta?',
        answers: [
            { label: '🔥 Es esencial, no negocio eso.', scores: { 'quencher-protour': 3, 'iceflow-flip-straw-tumbler-2': 2, 'wellspring-bottle': 2 } },
            { label: '🌡️ Me gusta, pero no es prioridad.', scores: { 'classic-flask-easy-fill': 2, 'adventure-all-in-one-food-jar': 1 } },
            { label: '☕ Lo uso solo en ocasiones específicas.', scores: { 'classic-flask-easy-fill': 3, 'adventure-all-in-one-food-jar': 2 } },
        ],
    },
    {
        id: 'usage',
        question: '¿Cuál sería el uso principal que le darías?',
        answers: [
            { label: '🏋 Gym o deporte', scores: { 'iceflow-flip-straw-tumbler-2': 4, 'quencher-protour': 2 } },
            { label: '🏢 Oficina o estudio', scores: { 'quencher-protour': 4, 'wellspring-bottle': 2 } },
            { label: '🏔 Viajes y montaña', scores: { 'wellspring-bottle': 4, 'iceflow-flip-straw-tumbler-2': 2 } },
            { label: '🥂 Eventos sociales', scores: { 'classic-flask-easy-fill': 4, 'quencher-protour': 1 } },
            { label: '🥗 Llevar comida', scores: { 'adventure-all-in-one-food-jar': 5 } },
        ],
    },
    {
        id: 'size',
        question: '¿Cuánta capacidad prefieres?',
        answers: [
            { label: '🤏 Compacto y ligero', scores: { 'classic-flask-easy-fill': 3, 'wellspring-bottle': 2 } },
            { label: '🫙 Tamaño medio', scores: { 'iceflow-flip-straw-tumbler-2': 3, 'adventure-all-in-one-food-jar': 2, 'wellspring-bottle': 1 } },
            { label: '🪣 Grande, que dure todo el día', scores: { 'quencher-protour': 4, 'iceflow-flip-straw-tumbler-2': 1 } },
        ],
    },
    {
        id: 'style',
        question: '¿Te importa más el diseño o la resistencia extrema?',
        answers: [
            { label: '✨ Diseño moderno', scores: { 'quencher-protour': 3, 'classic-flask-easy-fill': 2 } },
            { label: '💪 Resistencia ante todo', scores: { 'wellspring-bottle': 3, 'iceflow-flip-straw-tumbler-2': 2, 'adventure-all-in-one-food-jar': 2 } },
            { label: '⚖️ Equilibrio entre ambos', scores: { 'quencher-protour': 2, 'iceflow-flip-straw-tumbler-2': 2, 'wellspring-bottle': 1 } },
        ],
    },
    {
        id: 'lifestyle',
        question: '¿Qué describe mejor tu estilo de vida?',
        answers: [
            { label: '🏃 Activo y en movimiento', scores: { 'iceflow-flip-straw-tumbler-2': 4 } },
            { label: '💼 Profesional urbano', scores: { 'quencher-protour': 4 } },
            { label: '🧗 Aventurero', scores: { 'wellspring-bottle': 4 } },
            { label: '🥳 Social y relajado', scores: { 'classic-flask-easy-fill': 4 } },
            { label: '📦 Práctico y organizado', scores: { 'adventure-all-in-one-food-jar': 4 } },
        ],
    },
];

const PRODUCT_REASONS: Record<string, string> = {
    'quencher-protour': 'Tu estilo profesional y necesidad de hidratación constante hace del Quencher ProTour tu aliado perfecto. El mango ergonómico y su capacidad XL te acompañan todo el día.',
    'iceflow-flip-straw-tumbler-2': 'Tu ritmo activo y deportivo necesita el IceFlow Flip Straw 2.0. Su pitillo de acción rápida y diseño deportivo están hechos para no detenerte.',
    'wellspring-bottle': 'Para tu espíritu aventurero y profesional, la Wellspring Bottle es perfecta. Clásica, resistente y elegante: lista para la montaña y la oficina.',
    'classic-flask-easy-fill': 'Tu personalidad social y sofisticada encontrará en la Classic Flask el accesorio ideal. Compacta, premium y perfecta para los momentos especiales.',
    'adventure-all-in-one-food-jar': 'Tu vida práctica y organizada tiene su herramienta perfecta: el Food Jar con cuchara integrada. Lleva tus comidas calientes o frías a donde vayas.',
};

type QuizState = 'intro' | 'quiz' | 'result';

export default function Quiz() {
    const [state, setState] = useState<QuizState>('intro');
    const [currentQ, setCurrentQ] = useState(0);
    const [scores, setScores] = useState<Record<string, number>>({});
    const [answers, setAnswers] = useState<Record<string, string>>({}); // guarda label por pregunta
    const [animating, setAnimating] = useState(false);

    const { products, addToCart } = useStore();

    const progress = ((currentQ) / QUESTIONS.length) * 100;

    function handleAnswer(answer: Answer) {
        if (animating) return;
        setAnimating(true);

        // Track answer label by question id
        const qId = QUESTIONS[currentQ].id;
        const newAnswers = { ...answers, [qId]: answer.label };
        setAnswers(newAnswers);

        // Accumulate scores
        const newScores = { ...scores };
        Object.entries(answer.scores).forEach(([slug, pts]) => {
            newScores[slug] = (newScores[slug] || 0) + (pts as number);
        });
        setScores(newScores);

        setTimeout(() => {
            if (currentQ < QUESTIONS.length - 1) {
                setCurrentQ(q => q + 1);
                setAnimating(false);
            } else {
                // Determine winner now (same logic as render-time)
                const winnerSlug = Object.entries(newScores).sort((a, b) => b[1] - a[1])[0]?.[0]
                    ?? 'quencher-protour';

                // Fire-and-forget: guardar lead en Supabase sin bloquear la UI
                supabase.from('quiz_leads').insert({
                    recommended_product: winnerSlug,
                    answers: newAnswers,
                }).then(({ error }) => {
                    if (error) console.warn('Quiz lead not saved:', error.message);
                    else console.log('Quiz lead saved:', winnerSlug);
                });

                setState('result');
                setAnimating(false);
            }
        }, 300);
    }

    function restart() {
        setCurrentQ(0);
        setScores({});
        setAnswers({});
        setState('intro');
    }

    // Determine winner
    const winnerSlug = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0]
        ?? 'quencher-protour';
    const winnerProduct = products.find(p => p.slug === winnerSlug)
        ?? products[1]; // fallback to quencher

    return (
        <div className="w-full min-h-screen bg-[#F2F0E9] pt-20 pb-24 relative overflow-hidden">
            {/* Decorative background blobs */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-moss/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-clay/5 rounded-full blur-[100px] pointer-events-none" />

            <div className="max-w-2xl mx-auto px-4">

                {/* ── INTRO ─────────────────────────────────── */}
                {state === 'intro' && (
                    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center">
                        <span className="text-6xl mb-6 animate-bounce">🧪</span>
                        <span className="font-sans text-xs tracking-widest uppercase text-clay mb-3">Test de personalidad</span>
                        <h1 className="font-outfit text-4xl md:text-5xl uppercase tracking-tight text-charcoal mb-4 leading-tight">
                            Descubre tu<br />Stanley Perfecto
                        </h1>
                        <p className="font-sans text-charcoal/60 max-w-sm mb-10 leading-relaxed">
                            5 preguntas rápidas. Te recomendaremos el producto ideal para tu estilo de vida.
                        </p>
                        <button
                            onClick={() => setState('quiz')}
                            className="bg-moss text-cream font-sans font-semibold px-10 py-4 rounded-full text-base hover:bg-moss/90 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-moss/20"
                        >
                            Empezar test →
                        </button>
                    </div>
                )}

                {/* ── QUIZ ──────────────────────────────────── */}
                {state === 'quiz' && (
                    <div className="flex flex-col min-h-[80vh] justify-center">
                        {/* Progress bar */}
                        <div className="mb-10">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-sans text-xs text-charcoal/40 uppercase tracking-widest">
                                    Pregunta {currentQ + 1} de {QUESTIONS.length}
                                </span>
                                <span className="font-sans text-xs text-charcoal/40">{Math.round(progress)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-charcoal/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-moss rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>

                        {/* Question card */}
                        <div
                            className={`transition-all duration-300 ${animating ? 'opacity-0 translate-y-4' : 'opacity-100 translate-y-0'}`}
                        >
                            <h2 className="font-outfit text-2xl md:text-3xl text-charcoal tracking-tight mb-8 leading-snug">
                                {QUESTIONS[currentQ].question}
                            </h2>

                            <div className="flex flex-col gap-3">
                                {QUESTIONS[currentQ].answers.map((ans, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(ans)}
                                        className="group text-left w-full bg-white border border-charcoal/10 rounded-2xl px-6 py-4 font-sans text-charcoal hover:border-moss hover:bg-moss/5 hover:shadow-md transition-all duration-200 active:scale-[0.98]"
                                    >
                                        <span className="text-base">{ans.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ── RESULT ────────────────────────────────── */}
                {state === 'result' && winnerProduct && (
                    <div className="flex flex-col items-center text-center animate-[fadeIn_0.6s_ease-out]">
                        <span className="font-sans text-xs tracking-widest uppercase text-clay mt-8 mb-3">Tu resultado</span>
                        <h2 className="font-outfit text-3xl md:text-4xl uppercase tracking-tight text-charcoal mb-2">
                            Tu Stanley Perfecto Es:
                        </h2>
                        <p className="font-outfit text-2xl text-moss mb-8 font-medium">{winnerProduct.name}</p>

                        {/* Product Card */}
                        <div className="w-full max-w-md bg-white rounded-3xl border border-charcoal/10 shadow-2xl overflow-hidden mb-8">
                            <div className="bg-cream/50 min-h-[280px] flex items-center justify-center p-10">
                                <ImageSafe
                                    src={getProductImage(winnerProduct.slug)}
                                    alt={winnerProduct.name}
                                    className="h-56 w-full mix-blend-multiply drop-shadow-2xl"
                                />
                            </div>
                            <div className="p-6 text-left">
                                <p className="font-sans text-charcoal/70 text-sm leading-relaxed mb-4">
                                    {PRODUCT_REASONS[winnerProduct.slug]}
                                </p>
                                <div className="flex items-center justify-between">
                                    <span className="font-metrics text-moss text-xl">
                                        ${winnerProduct.variants[0]?.price_cop.toLocaleString('es-CO')} COP
                                    </span>
                                    <div className="flex gap-1.5">
                                        {winnerProduct.colorSwatches.map(hex => (
                                            <div key={hex} className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ backgroundColor: hex }} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
                            <button
                                onClick={() => addToCart(winnerProduct, winnerProduct.variants[0], 1)}
                                className="flex-1 bg-moss text-cream font-sans font-semibold py-3.5 rounded-full hover:bg-moss/90 transition-all hover:scale-105 active:scale-95"
                            >
                                Comprar Ahora
                            </button>
                            <Link
                                to="/personalizacion"
                                className="flex-1 border border-charcoal/20 text-charcoal font-sans font-semibold py-3.5 rounded-full hover:border-charcoal/40 transition-colors text-center"
                            >
                                Ver otras opciones
                            </Link>
                        </div>

                        <button
                            onClick={restart}
                            className="mt-6 font-sans text-sm text-charcoal/40 hover:text-charcoal transition-colors underline"
                        >
                            Repetir el test
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
