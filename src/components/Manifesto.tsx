import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export default function Manifesto() {
    const containerRef = useRef<HTMLDivElement>(null);
    const text1Ref = useRef<HTMLHeadingElement>(null);
    const text2Ref = useRef<HTMLHeadingElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Background Parallax
            gsap.to(bgRef.current, {
                yPercent: 30, // Move down as we scroll down
                ease: "none",
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                }
            });

            // Text Reveal
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: "top 60%",
                    toggleActions: "play none none reverse"
                }
            });

            tl.fromTo(text1Ref.current,
                { y: 40, opacity: 0 },
                { y: 0, opacity: 1, duration: 1, ease: 'power2.out' }
            )
                .fromTo(text2Ref.current,
                    { y: 40, opacity: 0 },
                    { y: 0, opacity: 1, duration: 1.2, ease: 'power2.out' },
                    "-=0.6"
                );

        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={containerRef} className="relative w-full min-h-[80vh] bg-charcoal text-cream overflow-hidden py-32 flex items-center">

            {/* Background with slight scale for parallax buffer */}
            <div
                ref={bgRef}
                className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 scale-110 origin-top"
                style={{
                    backgroundImage: 'url("https://images.unsplash.com/photo-1542273917363-3b1817f69a2d?q=80&w=2074&auto=format&fit=crop")', // Raw nature / misty forest placeholder
                }}
            />

            {/* Overlay to ensure text readability and add texture */}
            <div className="absolute inset-0 bg-charcoal/60" />

            {/* Content */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-8 md:px-16 flex flex-col justify-center h-full">
                <div className="max-w-4xl">
                    <h2
                        ref={text1Ref}
                        className="text-3xl md:text-5xl lg:text-5xl font-sans font-light tracking-wide text-cream/70 mb-8"
                    >
                        Muchos hacen botellas.
                    </h2>
                    <h2
                        ref={text2Ref}
                        className="text-5xl md:text-7xl lg:text-8xl font-concept leading-tight text-white drop-shadow-xl"
                    >
                        Nosotros fabricamos <br className="hidden md:block" />legado.
                    </h2>
                </div>
            </div>

        </section>
    );
}
