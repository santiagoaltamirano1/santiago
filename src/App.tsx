import { BrowserRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import FloatingButtons from './components/FloatingButtons';

// Pages
import Home from './pages/Home';
import Shop from './pages/Shop';
import Opinions from './pages/Opinions';
import Product from './pages/Product';
import Customization from './pages/Customization';
import Story from './pages/Story';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Quiz from './pages/Quiz';
import SuccessPage from './pages/SuccessPage';
import FailurePage from './pages/FailurePage';
import PendingPage from './pages/PendingPage';

// Main layout with Header and Footer
const MainLayout = () => {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  return (
    <>
      <Navbar />
      {/* bg-black on Home so Hero section has no cream gap; bg-cream on all other pages */}
      <div className={`w-full relative overflow-hidden min-h-screen ${isHome ? 'bg-black' : 'bg-cream'}`}>
        <Outlet />
      </div>
      <Footer />
      <Cart />
      <FloatingButtons />
    </>
  );
};

// Checkout layout without Header and Footer for distraction-free flow
const CheckoutLayout = () => {
  return (
    <div className="w-full relative overflow-hidden bg-cream min-h-screen">
      <Outlet />
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/opiniones" element={<Opinions />} />
          <Route path="/producto/:slug" element={<Product />} />
          <Route path="/personalizacion" element={<Customization />} />
          <Route path="/historia" element={<Story />} />
          <Route path="/descubre-tu-stanley" element={<Quiz />} />
        </Route>

        <Route element={<CheckoutLayout />}>
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/success" element={<SuccessPage />} />
          <Route path="/failure" element={<FailurePage />} />
          <Route path="/pending" element={<PendingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
