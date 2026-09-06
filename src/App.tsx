import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppLayout } from './components/Layout/AppLayout';
import { HomePage } from './pages/HomePage';
import { GraphPage } from './pages/GraphPage';
import { ChatPage } from './pages/ChatPage';
import './styles/index.css';

function App() {
  console.log('App component rendering');

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/graph" element={<GraphPage />} />
          <Route path="/chat" element={<ChatPage />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}

export default App;
