import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { LexiconProvider } from "./data/Lexicon.tsx";
import { routerBasename } from "./lib/basename.ts";
import { ArchivePage } from "./pages/ArchivePage.tsx";
import { GamePage } from "./pages/GamePage.tsx";

export default function App() {
  return (
    <LexiconProvider>
      <BrowserRouter basename={routerBasename()}>
        <Routes>
          <Route path="/" element={<Navigate to="/daily" replace />} />
          <Route path="/daily" element={<GamePage mode="daily" />} />
          <Route path="/practice" element={<GamePage mode="practice" />} />
          <Route path="/previous" element={<ArchivePage />} />
          <Route path="/day/:iso" element={<GamePage mode="archive" />} />
          <Route path="*" element={<Navigate to="/daily" replace />} />
        </Routes>
      </BrowserRouter>
    </LexiconProvider>
  );
}
