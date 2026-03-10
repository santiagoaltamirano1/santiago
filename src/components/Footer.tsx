export default function Footer() {
    return (
        <footer className="w-full bg-charcoal text-cream border-t border-cream/10 py-8 px-8 flex items-center justify-center">
            <span className="font-sans text-sm text-cream/40 text-center">
                © {new Date().getFullYear()} Stanley. Todos los derechos reservados.
            </span>
        </footer>
    );
}
